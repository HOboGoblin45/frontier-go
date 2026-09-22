/**
 * Build the frontier go website for GitHub Pages.
 *
 *   npx tsx tools/site/build.ts      -> app/site-dist/
 *
 * Static pages from landing-page/, the current catalog (which the app fetches
 * for new footage), and one pre-rendered share page per clip. Run by
 * deploy-site.yml on every change to the site or the catalog.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexCatalog } from '../../src/core/catalog/catalog';
import type { FrontierCatalog } from '../../src/core/types/media';
import { SITE_URL } from '../../src/core/platform/site';
import { renderNotFound, renderSharePage, sharePagePath } from './share-page';
import type { DiveDetail, DiveIndex } from '../../src/core/dives/types';
import { buildGroupAtlas } from '../../src/core/dives/atlas';
import { atlasUrls, diveCoverPath, landSvg, renderAtlasHome, renderDivePage, renderGroupPage } from './atlas';
import { coverStill, ensureStills, pictureFor, stillNear, stillPath, stripSightings, type StillRequest } from '../dives/stills';

function stillPathFor(d: DiveDetail, t: number): string | undefined {
  const s = stillNear(d.stills, t);
  return s ? stillPath(d.id, s.file) : undefined;
}
import { shareSlug } from '../../src/core/history/saved';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../..');
const SOURCE = resolve(APP, '../landing-page');
const OUT = resolve(APP, 'site-dist');
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, ''); // "/frontier-go"

/** The hand-written pages use root-relative links; the site lives under a path. */
function rebase(html: string): string {
  return html
    // Link previews need absolute image URLs.
    .replace(/content="\/(?!\/)/g, `content="${SITE_URL}/`)
    .replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const name of await readdir(SOURCE)) {
    if (name === 'README.md') continue;
    const from = resolve(SOURCE, name);
    if (name.endsWith('.html')) {
      const html = rebase(await readFile(from, 'utf8'));
      await writeFile(resolve(OUT, name), html);
      // Extensionless URLs (/privacy, /support) as directories too, so the
      // links in the app work whichever way the host resolves them.
      if (name !== 'index.html') {
        const dir = resolve(OUT, name.replace(/\.html$/, ''));
        await mkdir(dir, { recursive: true });
        await writeFile(resolve(dir, 'index.html'), html);
      }
    } else {
      await cp(from, resolve(OUT, name), { recursive: true });
    }
  }

  // GitHub Pages runs Jekyll unless told not to, which hides underscore paths.
  await writeFile(resolve(OUT, '.nojekyll'), '');

  const raw = await readFile(resolve(APP, 'public/catalog/frontier-catalog.json'), 'utf8');
  const catalog = JSON.parse(raw) as FrontierCatalog;
  await mkdir(resolve(OUT, 'catalog'), { recursive: true });
  await writeFile(resolve(OUT, 'catalog/frontier-catalog.json'), raw);
  await cp(resolve(APP, 'public/catalog/catalog-meta.json'), resolve(OUT, 'catalog/catalog-meta.json'));

  // One page per clip that passes the client's own gate - the same gate the
  // app applies - so a link never advertises something the app would refuse.
  const { eligible } = indexCatalog(catalog);
  const seen = new Set<string>();
  for (const item of eligible) {
    const path = sharePagePath(item);
    if (seen.has(path)) throw new Error(`share slug collision: ${path}`);
    seen.add(path);
    await mkdir(resolve(OUT, dirname(path)), { recursive: true });
    await writeFile(resolve(OUT, path), renderSharePage(item));
  }
  await writeFile(resolve(OUT, '404.html'), renderNotFound());

  const atlas = await buildAtlas();

  // Everything a search engine should find.
  const urls = [
    `${SITE_URL}/`, `${SITE_URL}/support/`, `${SITE_URL}/privacy/`,
    ...atlas,
    ...eligible.map((i) => `${SITE_URL}/d/${shareSlug(i.id)}/`),
  ];
  await writeFile(resolve(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(resolve(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log(`site: ${eligible.length} share pages, ${atlas.length} atlas pages, catalog ${catalog.generatedAt}, base ${BASE_PATH}`);
}

/**
 * The Deep Atlas: dive pages, life pages, the map, and the dive data the app
 * reads. Stills come from NOAA's archive through a cache (STILLS_CACHE, or
 * app/.cache/stills), so a deploy only fetches new ones; --no-stills skips them.
 */
async function buildAtlas(): Promise<string[]> {
  const dataDir = resolve(APP, 'data/dives');
  let index: DiveIndex;
  try {
    index = JSON.parse(await readFile(resolve(dataDir, 'index.json'), 'utf8')) as DiveIndex;
  } catch {
    console.log('no dive index; Deep Atlas skipped');
    return [];
  }
  const details = new Map<string, DiveDetail>();
  for (const d of index.dives) {
    details.set(d.id, JSON.parse(await readFile(resolve(dataDir, `${d.id}.json`), 'utf8')) as DiveDetail);
  }
  const all = [...details.values()];
  const groups = buildGroupAtlas(all, 36);

  const requests: StillRequest[] = [];
  const want = (d: DiveDetail, file: string | undefined) => { if (file) requests.push({ diveId: d.id, cruise: d.cruise, dive: d.dive, file }); };
  for (const d of all) {
    want(d, coverStill(d)?.file);
    for (const { still } of stripSightings(d, 6)) want(d, still.file);
  }
  for (const g of groups) {
    for (const h of g.highlights) {
      const d = details.get(h.diveId)!;
      want(d, stillNear(d.stills, pictureFor(d, g.name, h.sighting).t)?.file);
    }
  }
  const cacheDir = process.env.STILLS_CACHE || resolve(APP, '.cache/stills');
  const stills = process.argv.includes('--no-stills') ? new Set<string>() : await ensureStills(requests, cacheDir);
  // Only the stills this build uses; the cache may hold pictures a previous choice needed.
  for (const p of stills) {
    await mkdir(dirname(resolve(OUT, p)), { recursive: true });
    await cp(resolve(cacheDir, p), resolve(OUT, p));
  }

  const ctx = { stills };
  await mkdir(resolve(OUT, 'dives/data'), { recursive: true });
  // The app reads these: the site's copy adds the pictures this build published.
  const published = (p: string | undefined) => (p && stills.has(p) ? `${SITE_URL}/${p}` : undefined);
  const withCover = {
    ...index,
    dives: index.dives.map((s) => {
      const cover = published(diveCoverPath(details.get(s.id)!, ctx));
      return cover ? { ...s, cover } : s;
    }),
  };
  await writeFile(resolve(OUT, 'dives/data/index.json'), JSON.stringify(withCover));
  for (const d of all) {
    const photos = d.sightings
      .map((s) => ({ t: s.t, url: published(stillPathFor(d, s.t)) }))
      .filter((p): p is { t: number; url: string } => !!p.url);
    const cover = published(diveCoverPath(d, ctx));
    await writeFile(resolve(OUT, `dives/data/${d.id}.json`), JSON.stringify({ ...d, ...(cover ? { cover } : {}), ...(photos.length ? { photos } : {}) }));
    const dir = resolve(OUT, `dives/${d.id.toLowerCase()}`);
    await mkdir(dir, { recursive: true });
    const neighbours = index.dives.filter((x) => x.cruise.slice(0, 6) === d.cruise.slice(0, 6));
    await writeFile(resolve(dir, 'index.html'), renderDivePage(d, ctx, neighbours));
  }
  for (const g of groups) {
    const dir = resolve(OUT, `life/${g.slug}`);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'index.html'), renderGroupPage(g, details, ctx));
  }
  await writeFile(resolve(OUT, 'dives/index.html'), renderAtlasHome(index.dives, groups, details, ctx));
  await writeFile(resolve(OUT, 'dives/land.svg'), landSvg());
  console.log(`atlas: ${all.length} dives, ${groups.length} groups, ${stills.size} stills of ${new Set(requests.map((r) => r.file)).size} wanted`);
  return atlasUrls(index.dives, groups);
}

main().catch((err) => { console.error(err); process.exit(1); });
