/**
 * Frontier Go catalog ingestion.
 *
 *   npm run ingest              # full run, writes public/catalog/
 *   npm run ingest -- --limit 40 --providers noaa
 *   npm run ingest -- --providers nps,loc --keep-others   # refresh two, keep the rest
 *
 * Runs on a schedule in GitHub Actions and commits the result, so the app ships
 * with a catalog and never has to query a provider API to decide what to play.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, stampAddedAt, type StreamProbe } from '../../src/core/catalog/pipeline';
import type { FrontierCatalog, FrontierMediaItem } from '../../src/core/types/media';
import { isAgencyTitleCard } from '../../src/core/catalog/artwork';
import { subjectsFor } from '../../src/core/catalog/subjects';
import jpeg from 'jpeg-js';
import { ADAPTERS } from '../../src/providers/index';
import type { DiveIndex } from '../../src/core/dives/types';
import { linkClipsToDives } from '../../src/core/dives/link';
import type { FrontierProviderAdapter } from '../../src/providers/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../../public/catalog');
const DOCS_DIR = resolve(HERE, '../../../docs');

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const logger = {
  info: (m: string) => console.log(`  ${m}`),
  warn: (m: string, e?: unknown) => console.warn(`  ! ${m}${e ? ` (${String(e)})` : ''}`),
};

/**
 * HEAD every chosen stream before publishing it. A catalog entry pointing at a
 * 404 is a black screen on someone's television, and it is cheap to find here.
 */
/**
 * Hosts that publish a rate limit get their HEADs spaced to it. The Library
 * of Congress allows 60 requests a minute to its streaming service.
 */
const HOST_INTERVAL_MS: Record<string, number> = { 'tile.loc.gov': 1100 };
const hostQueue = new Map<string, Promise<void>>();
function spaced(url: string): Promise<void> {
  let host = '';
  try { host = new URL(url).host; } catch { return Promise.resolve(); }
  const gap = HOST_INTERVAL_MS[host];
  if (!gap) return Promise.resolve();
  const prev = hostQueue.get(host) || Promise.resolve();
  const next = prev.then(() => new Promise<void>((r) => setTimeout(r, gap)));
  hostQueue.set(host, next);
  return prev;
}

const probe: StreamProbe = async (url) => {
  try {
    await spaced(url);
    // A HEAD that hangs would hold one of the eight probe slots for minutes.
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    const len = Number(res.headers.get('content-length') || '0');
    return {
      // MP4 answers video/*; an HLS playlist answers one of the mpegurl types.
      ok: res.ok && /^(video\/|application\/(vnd\.apple\.mpegurl|x-mpegurl))/i.test(res.headers.get('content-type') || 'video/'),
      status: res.status,
      bytes: Number.isFinite(len) ? len : undefined,
      contentType: res.headers.get('content-type') || undefined,
    };
  } catch {
    return { ok: false };
  }
};

/**
 * Look at every NOAA poster and flag the ones that are the agency's emblem
 * title card rather than a frame of the dive. See core/catalog/artwork.ts.
 * Failures leave the item unflagged: this can only ever hide a poster, never
 * a clip.
 */
async function auditPosters(items: FrontierMediaItem[]): Promise<number> {
  let flagged = 0;
  let next = 0;
  const worker = async () => {
    for (;;) {
      const item = items[next];
      next += 1;
      if (!item) return;
      const url = item.imagery.posterUrl || item.imagery.thumbnailUrl;
      if (!url || !/\.jpe?g(\?|$)/i.test(url)) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const img = jpeg.decode(new Uint8Array(await res.arrayBuffer()), { useTArray: true, maxMemoryUsageInMB: 256 });
        if (isAgencyTitleCard(img.data, img.width, img.height)) {
          item.imagery = { ...item.imagery, titleCard: true };
          flagged += 1;
        }
      } catch { /* unreadable image: leave it alone */ }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return flagged;
}

async function main() {
  const limit = Number(arg('limit', '400'));
  const only = arg('providers');
  const skipProbe = has('no-probe');
  // Refresh some providers and keep the rest of the current catalog as it is.
  const keepOthers = has('keep-others');

  let adapters: FrontierProviderAdapter[] = ADAPTERS;
  if (only) {
    const wanted = only.split(',').map((s) => s.trim().toLowerCase());
    adapters = ADAPTERS.filter((a) => wanted.some((w) => a.provider.includes(w)));
  }

  console.log(`frontier go — catalog ingest`);
  console.log(`providers: ${adapters.map((a) => a.provider).join(', ')}  limit/provider: ${limit}`);

  const started = Date.now();
  const { catalog, rejected } = await runPipeline({
    adapters,
    limitPerProvider: limit,
    logger,
    probe: skipProbe ? undefined : probe,
  });

  // First-seen dates come from the catalog this run is replacing.
  let previous: FrontierCatalog | null = null;
  try {
    previous = JSON.parse(await readFile(resolve(OUT_DIR, 'frontier-catalog.json'), 'utf8')) as FrontierCatalog;
  } catch { /* first ever run */ }
  let keptNote = '';
  if (keepOthers && previous) {
    const refreshed = new Set(adapters.map((a) => a.provider));
    const kept = previous.items
      .filter((i) => !refreshed.has(i.provider))
      .map((i) => ({ ...i, subjects: subjectsFor(i) }));
    catalog.items = [...catalog.items, ...kept].sort((a, b) => a.id.localeCompare(b.id));
    const s = catalog.stats;
    s.published = catalog.items.length;
    s.byProvider = {};
    s.byChannel = {};
    for (const i of catalog.items) {
      s.byProvider[i.provider] = (s.byProvider[i.provider] || 0) + 1;
      s.byChannel[i.channel] = (s.byChannel[i.channel] || 0) + 1;
    }
    console.log(`  kept from the previous catalog: ${kept.length} (${[...new Set(kept.map((i) => i.provider))].join(', ')})`);
    keptNote = `This run refreshed ${adapters.map((a) => a.provider).join(', ')} only and kept ${kept.length} items `
      + `from the previous catalog (${[...new Set(kept.map((i) => i.provider))].join(', ')}). The fetch, normalise and `
      + 'rejection counts below are for the refreshed providers; "published" is the whole catalog.';
  }
  catalog.items = stampAddedAt(catalog.items, previous, catalog.generatedAt);
  const arrived = catalog.items.filter((i) => i.addedAt === catalog.generatedAt).length;
  console.log(`  new since the previous catalog: ${arrived}`);

  // Clips that name their expedition and dive get that dive's site and a
  // link to the whole dive. The dive index is built by tools/dives/crawl.ts.
  try {
    const index = JSON.parse(await readFile(resolve(HERE, '../../data/dives/index.json'), 'utf8')) as DiveIndex;
    console.log(`  clips linked to their dive: ${linkClipsToDives(catalog.items, index.dives)}`);
  } catch {
    console.log('  dive index not found; clips keep their region-level places');
  }

  if (!skipProbe) {
    const cards = await auditPosters(catalog.items.filter((i) => i.provider === 'noaa_ocean_exploration'));
    console.log(`  NOAA title-card posters flagged: ${cards}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(resolve(OUT_DIR, 'frontier-catalog.json'), `${JSON.stringify(catalog)}\n`, 'utf8');
  await writeFile(
    resolve(OUT_DIR, 'catalog-meta.json'),
    `${JSON.stringify({ version: catalog.version, generatedAt: catalog.generatedAt, stats: catalog.stats }, null, 2)}\n`,
    'utf8',
  );

  // The rejection log is the rights-review artefact. It is the thing a human
  // reads to decide whether the gate is too tight or not tight enough.
  await mkdir(DOCS_DIR, { recursive: true });
  const byReason = new Map<string, number>();
  for (const r of rejected) for (const reason of r.reasons) {
    const head = reason.split(':').slice(0, 2).join(':');
    byReason.set(head, (byReason.get(head) || 0) + 1);
  }
  const lines = [
    '# Catalog rejection log',
    '',
    `Generated ${catalog.generatedAt} by \`npm run ingest\`. Regenerated on every run;`,
    'do not hand-edit. Anything listed here is excluded from the production feed.',
    '',
    ...(keptNote ? [keptNote, ''] : []),
    '## Counts by stage',
    '',
    '| stage | count |',
    '| --- | --- |',
    ...Object.entries(catalog.stats)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Counts by reason',
    '',
    '| reason | count |',
    '| --- | --- |',
    ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| \`${k}\` | ${v} |`),
    '',
    '## Rejected items',
    '',
    '| provider | title | reasons |',
    '| --- | --- | --- |',
    ...rejected.slice(0, 400).map((r) => `| ${r.provider} | ${r.title.replace(/\|/g, '/').slice(0, 90)} | ${r.reasons.join('; ').replace(/\|/g, '/').slice(0, 160)} |`),
    '',
    rejected.length > 400 ? `_${rejected.length - 400} further rejections omitted._` : '',
  ];
  await writeFile(resolve(DOCS_DIR, 'CATALOG-REJECTIONS.md'), `${lines.join('\n')}\n`, 'utf8');

  const s = catalog.stats;
  console.log('');
  console.log(`  fetched              ${s.fetched}`);
  console.log(`  normalized           ${s.normalized}`);
  console.log(`  rejected (rights)    ${s.rightsRejected}`);
  console.log(`  rejected (safety)    ${s.safetyRejected}`);
  console.log(`  rejected (quality)   ${s.qualityRejected}`);
  console.log(`  duplicates collapsed ${s.duplicatesCollapsed}`);
  console.log(`  PUBLISHED            ${s.published}`);
  console.log(`  by provider          ${JSON.stringify(s.byProvider)}`);
  console.log(`  by channel           ${JSON.stringify(s.byChannel)}`);
  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (s.published === 0) {
    console.error('::error::ingest produced an empty catalog');
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
