/**
 * Build the dive index from NOAA's Okeanos Explorer ROV archive.
 *
 *   npx tsx tools/dives/crawl.ts                 new dives only (cached dives are kept)
 *   npx tsx tools/dives/crawl.ts --force         rebuild every dive
 *   npx tsx tools/dives/crawl.ts --cruise ex2104 one cruise
 *   npx tsx tools/dives/crawl.ts --limit 20      stop after 20 new dives (for testing)
 *
 * Source: the archive NOAA's data landing pages link to,
 * https://oer.hpc.msstate.edu/okeanos/<cruise>/. Per dive it reads:
 *   - <cruise>-DIVEnn-ancillary-data.zip  -> DIVEnn.txt and RovTrack1Hz.csv
 *   - <cruise>-DIVEnn-videos.zip          -> the central directory only (segment list)
 *   - the ROV dive summary PDF            -> site, area, purpose (needs pdftotext)
 *   - Eventlogs/<CRUISE>_DIVEnn_ANNOTATIONS.csv -> sightings
 *
 * Writes app/data/dives/index.json and app/data/dives/<id>.json. The archive
 * of past dives does not change, so a dive once built is reused; the weekly
 * run only adds new ones.
 *
 * No fabricated geography: a dive whose files carry no position is skipped
 * and reported, never placed at a guessed point.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { DiveDetail, DiveEvent, DiveIndex, DiveSummary } from '../../src/core/dives/types';
import { DIVE_CREDIT } from '../../src/core/dives/types';
import {
  buildSegments,
  buildStills,
  cleanPlaceName,
  downsampleTrack,
  parseAnnotations,
  parseDiveSummary,
  parseSummaryPdf,
  parseTrack1Hz,
} from '../../src/providers/noaaDives/parse';
import type { ZipEntry } from '../../src/providers/noaaDives/zip';
import { dataOffset, locateCentralDirectory, parseCentralDirectory, readZip64Record } from '../../src/providers/noaaDives/zip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../data/dives');
const CATALOG = path.resolve(HERE, '../../public/catalog/frontier-catalog.json');
const ARCHIVE = 'https://oer.hpc.msstate.edu/okeanos/';
const LANDING = 'https://www.ncei.noaa.gov/waf/okeanos-rov-cruises/';
const UA = 'frontier-go-dive-index/1.0 (+https://hobogoblin45.github.io/frontier-go/support)';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--cruise') ? args[args.indexOf('--cruise') + 1]?.toLowerCase() : undefined;
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const CONCURRENCY = 6;

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(120_000) });
      if (res.ok || res.status === 206) return res;
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { status: 404 });
      last = new Error(`${res.status} ${url}`);
    } catch (e) {
      if ((e as { status?: number }).status === 404) throw e;
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw last;
}

/** UTF-8 when the bytes are valid UTF-8, Latin-1 otherwise (NOAA has both). */
export function decodeText(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  return utf8.includes('\uFFFD') ? buf.toString('latin1') : utf8;
}

async function text(url: string): Promise<string> {
  const res = await fetchWithRetry(url);
  return decodeText(Buffer.from(await res.arrayBuffer()));
}

async function range(url: string, start: number, end: number): Promise<Uint8Array> {
  const res = await fetchWithRetry(url, { headers: { Range: `bytes=${start}-${end}` } });
  return new Uint8Array(await res.arrayBuffer());
}

async function tail(url: string, bytes: number): Promise<Uint8Array> {
  const res = await fetchWithRetry(url, { headers: { Range: `bytes=-${bytes}` } });
  return new Uint8Array(await res.arrayBuffer());
}

async function zipEntries(url: string): Promise<ZipEntry[]> {
  const end = await tail(url, 65_557);
  let loc = locateCentralDirectory(end);
  if (loc.zip64RecordOffset !== undefined) {
    const rec = readZip64Record(await range(url, loc.zip64RecordOffset, loc.zip64RecordOffset + 55));
    loc = { ...loc, ...rec };
  }
  return parseCentralDirectory(await range(url, loc.offset, loc.offset + loc.size - 1));
}

async function zipMember(url: string, entry: ZipEntry): Promise<Buffer> {
  const header = await range(url, entry.offset, entry.offset + 29);
  // The local header's name/extra lengths can differ from the central record's.
  const start = dataOffset(entry, header);
  const data = Buffer.from(await range(url, start, start + entry.compressedSize - 1));
  return entry.method === 0 ? data : zlib.inflateRawSync(data);
}

/* ------------------------------------------------------------------ */
/* Archive listings                                                    */
/* ------------------------------------------------------------------ */

function links(html: string): string[] {
  return [...html.matchAll(/href="([^"?/][^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
}

interface DivePlan {
  cruiseDir: string;   // "ex2104"
  cruise: string;      // "EX2104"
  dive: number;
  ancillary?: string;
  videos?: string;
  images?: string;
  pdf?: string;
  annotations?: string;
}

function diveNumberOfPdf(name: string): number | undefined {
  const u = name.toUpperCase();
  if (!u.endsWith('.PDF') || !u.includes('SUMMARY') || u.includes('MAP')) return undefined;
  const m = u.match(/DIVE[_\-\s]*(\d{1,2})(?!\d)/) || u.match(/SUMMARY[_\-\s]*(\d{2})\.PDF$/) || u.match(/D(\d{2})\.PDF$/);
  return m ? Number(m[1]) : undefined;
}

export async function planCruise(cruiseDir: string): Promise<DivePlan[]> {
  const base = `${ARCHIVE}${cruiseDir}/`;
  const names = links(await text(base));
  const cruise = cruiseDir.toUpperCase();
  const dives = new Map<number, DivePlan>();
  const get = (n: number) => {
    if (!dives.has(n)) dives.set(n, { cruiseDir, cruise, dive: n });
    return dives.get(n)!;
  };
  for (const n of names) {
    const m = n.match(/-DIVE(\d{2})-(ancillary-data|videos|images)\.zip$/i);
    if (m) {
      const p = get(Number(m[1]));
      const kind = m[2].toLowerCase();
      if (kind === 'videos') p.videos = base + n;
      else if (kind === 'images') p.images = base + n;
      else p.ancillary = base + n;
      continue;
    }
    const pd = diveNumberOfPdf(n);
    if (pd !== undefined && pd > 0) get(pd).pdf ||= base + encodeURI(n);
  }
  // Some cruises publish their dive summaries under repository names
  // ("noaa_48487_DS2.pdf"); the dive number is only in the PDF's own heading.
  const repository = names.filter((n) => /^noaa_\d+_DS\d+\.pdf$/i.test(n));
  if (repository.length && [...dives.values()].some((d) => !d.pdf)) {
    for (const n of repository) {
      try {
        const t = pdfText(Buffer.from(await (await fetchWithRetry(base + n)).arrayBuffer()), 1);
        const m = t?.match(/ROV Dive Summary,?\s*EX-?\d{2}-?\d{2}(?:L\d)?,?\s*Dive\s*0?(\d{1,2})/i);
        if (m && dives.has(Number(m[1]))) get(Number(m[1])).pdf ||= base + n;
      } catch { /* not a dive summary */ }
    }
  }
  if (names.some((n) => n.startsWith('Eventlogs'))) {
    try {
      const ev = links(await text(`${base}Eventlogs/`));
      for (const n of ev) {
        const m = n.match(/_DIVE(\d{2})_ANNOTATIONS\.csv$/i);
        if (m && dives.has(Number(m[1]))) get(Number(m[1])).annotations = `${base}Eventlogs/${n}`;
      }
    } catch { /* no event logs for this cruise */ }
  }
  return [...dives.values()].filter((d) => d.ancillary).sort((a, b) => a.dive - b.dive);
}

/* ------------------------------------------------------------------ */
/* Expedition names (from the catalog NOAA already published)          */
/* ------------------------------------------------------------------ */

/**
 * Expedition titles from NCEI's index of Okeanos Explorer ROV cruises:
 * "Okeanos Explorer (EX2104): 2021 North Atlantic Stepping Stones: ...".
 * Keyed by the cruise directory ("ex2104", "ex1504l3").
 */
export function parseLandingIndex(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /okeanos-rov-cruises\/(ex[0-9a-z]+)"[^>]*>\s*<p[^>]*>\s*Okeanos Explorer \([^)]*\):\s*([^<]+?)\s*<\/p>/gi;
  for (const m of html.matchAll(re)) out.set(m[1].toLowerCase(), m[2].replace(/\s+/g, ' ').trim());
  return out;
}

async function landingTitles(): Promise<Map<string, string>> {
  try {
    return parseLandingIndex(await text(LANDING));
  } catch (e) {
    console.warn(`expedition titles unavailable: ${(e as Error).message}`);
    return new Map();
  }
}

function expeditionNames(): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: { source: { expedition?: string } }[] };
    for (const item of cat.items) {
      const name = item.source.expedition;
      if (!name) continue;
      // "(EX2104)", "(EX2204-EX2206)"
      for (const m of name.matchAll(/EX(\d{4})(?:\s*-\s*EX(\d{4}))?/g)) {
        const from = Number(m[1]);
        const to = m[2] ? Number(m[2]) : from;
        for (let c = from; c <= to && c - from < 10; c += 1) if (!out.has(`EX${c}`)) out.set(`EX${c}`, name);
      }
    }
  } catch { /* the catalog is optional here */ }
  return out;
}

/* ------------------------------------------------------------------ */
/* One dive                                                            */
/* ------------------------------------------------------------------ */

let pdftotextAvailable: boolean | undefined;
function pdfText(buf: Buffer, pages = 3): string | undefined {
  if (pdftotextAvailable === false) return undefined;
  const file = path.join(os.tmpdir(), `dive-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(file, buf);
    const out = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', '-l', String(pages), file, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    pdftotextAvailable = true;
    return out;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      pdftotextAvailable = false;
      console.warn('pdftotext not found: dive site names will be missing. Install poppler-utils.');
    }
    return undefined;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

export function diveId(cruise: string, dive: number): string {
  return `${cruise}-DIVE${String(dive).padStart(2, '0')}`;
}

async function buildDive(plan: DivePlan, expeditions: Map<string, string>, titles: Map<string, string>): Promise<DiveDetail | { skipped: string }> {
  const id = diveId(plan.cruise, plan.dive);
  const anc = await zipEntries(plan.ancillary!);
  const trackEntry = anc.find((e) => /RovTrack1Hz\.csv$/i.test(e.name));
  const summaryEntry = anc.find((e) => /_DIVE\d{2}\.txt$/i.test(e.name));
  if (!trackEntry) return { skipped: `${id}: no 1 Hz track` };

  const raw = parseTrack1Hz(decodeText(await zipMember(plan.ancillary!, trackEntry)));
  if (raw.unix.length < 60) return { skipped: `${id}: track too short` };
  const summary = summaryEntry ? parseDiveSummary(decodeText(await zipMember(plan.ancillary!, summaryEntry))) : { events: [] };

  const startUnix = Math.floor(raw.unix[0]);
  const track = downsampleTrack(raw, startUnix, 30);

  // Position: where the vehicle reached the bottom, else its deepest fixed point.
  const onBottom = summary.events.find((e) => e.kind === 'on_bottom' && typeof e.lat === 'number');
  let lat = onBottom?.lat;
  let lon = onBottom?.lon;
  if (lat === undefined || lon === undefined) {
    let best = -1;
    for (let i = 0; i < raw.unix.length; i += 1) {
      if (raw.lat[i] !== null && (best < 0 || raw.depth[i] > raw.depth[best])) best = i;
    }
    if (best >= 0) { lat = raw.lat[best]!; lon = raw.lon[best]!; }
  }
  if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { skipped: `${id}: no published position` };
  }

  const maxTrack = raw.depth.reduce((m, d) => (d < 11000 && d > m ? d : m), 0);
  const maxDepthMeters = Math.round(summary.maxDepthMeters ?? maxTrack);

  let site: string | undefined;
  let area: string | undefined;
  let purpose: string | undefined;
  const pdfEntry = anc.find((e) => /summary.*\.pdf$/i.test(e.name));
  try {
    const pdf = plan.pdf
      ? Buffer.from(await (await fetchWithRetry(plan.pdf)).arrayBuffer())
      : pdfEntry ? await zipMember(plan.ancillary!, pdfEntry) : undefined;
    const t = pdf ? pdfText(pdf) : undefined;
    if (t) ({ site, area, purpose } = parseSummaryPdf(t));
    site = cleanPlaceName(site);
    area = cleanPlaceName(area);
  } catch { /* a missing PDF costs the site name, nothing else */ }

  let sightings: DiveDetail['sightings'] = [];
  if (plan.annotations) {
    try {
      sightings = parseAnnotations(await text(plan.annotations), startUnix);
    } catch { /* no log */ }
  }
  const lastT = track.t[track.t.length - 1];
  sightings = sightings.filter((s) => s.t >= 0 && s.t <= lastT + 600);

  let segments: DiveDetail['segments'] = [];
  if (plan.videos) {
    try {
      segments = buildSegments((await zipEntries(plan.videos)).map((e) => ({ name: e.name, size: e.size })), startUnix)
        .filter((s) => s.t > -600 && s.t < lastT + 1800);
    } catch { /* video archive unreadable: the dive stays, without replay */ }
  }

  let stills: DiveDetail['stills'] = [];
  if (plan.images) {
    try {
      stills = buildStills((await zipEntries(plan.images)).map((e) => e.name), startUnix)
        .filter((s) => s.t >= 0 && s.t <= lastT + 600);
    } catch { /* no stills */ }
  }

  const events: DiveEvent[] = summary.events.map((e) => ({ kind: e.kind, t: Math.round(e.unix - startUnix) }));
  const groupsCount = new Map<string, number>();
  for (const s of sightings) groupsCount.set(s.group, (groupsCount.get(s.group) || 0) + 1);

  const date = new Date(startUnix * 1000).toISOString().slice(0, 10);
  const detail: DiveDetail = {
    id,
    cruise: plan.cruise,
    dive: plan.dive,
    date,
    ...(site ? { site } : {}),
    ...(area ? { area } : {}),
    ...((titles.get(plan.cruiseDir) || expeditions.get(plan.cruise.slice(0, 6)))
      ? { expedition: titles.get(plan.cruiseDir) || expeditions.get(plan.cruise.slice(0, 6)) }
      : {}),
    latitude: Math.round(lat * 1e5) / 1e5,
    longitude: Math.round(lon * 1e5) / 1e5,
    maxDepthMeters,
    durationSeconds: Math.round(raw.unix[raw.unix.length - 1] - raw.unix[0]),
    ...(summary.bottomSeconds ? { bottomSeconds: summary.bottomSeconds } : {}),
    sightingCount: sightings.length,
    groups: [...groupsCount.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g),
    videoSeconds: segments.reduce((s, x) => s + x.duration, 0),
    startUnix,
    ...(purpose ? { purpose } : {}),
    events,
    track,
    sightings,
    segments,
    stills,
    source: { landingPage: `${LANDING}${plan.cruiseDir}/`, credit: DIVE_CREDIT },
  };
  return detail;
}

/**
 * A rebuild must not forget what the mirror has published: the video base and
 * which segments are live are carried over from the file being replaced.
 */
export function carryMirror(fresh: DiveDetail, existingPath: string): DiveDetail {
  let old: DiveDetail | undefined;
  try { old = JSON.parse(fs.readFileSync(existingPath, 'utf8')) as DiveDetail; } catch { return fresh; }
  if (!old?.videoBase) return fresh;
  const live = new Set(old.segments.filter((s) => s.mirrored).map((s) => s.file));
  return {
    ...fresh,
    videoBase: old.videoBase,
    segments: fresh.segments.map((s) => (live.has(s.file) ? { ...s, mirrored: true } : s)),
  };
}

export function summarise(d: DiveDetail): DiveSummary {
  const { id, cruise, dive, date, site, area, expedition, latitude, longitude, maxDepthMeters, durationSeconds, bottomSeconds, sightingCount, groups, videoSeconds } = d;
  const replay = !!d.videoBase && d.segments.some((s) => s.mirrored);
  return {
    ...(replay ? { replay } : {}),
    id, cruise, dive, date,
    ...(site ? { site } : {}),
    ...(area ? { area } : {}),
    ...(expedition ? { expedition } : {}),
    latitude, longitude, maxDepthMeters, durationSeconds,
    ...(bottomSeconds ? { bottomSeconds } : {}),
    sightingCount, groups, videoSeconds,
  };
}

/* ------------------------------------------------------------------ */

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const root = links(await text(ARCHIVE)).filter((n) => /^ex\d{4}[a-z0-9]*$/i.test(n.replace(/\/$/, ''))).map((n) => n.replace(/\/$/, ''));
  const cruises = ONLY ? root.filter((c) => c === ONLY) : root;
  console.log(`${cruises.length} cruises in the archive`);

  const plans = (await mapLimit(cruises, 6, async (c) => {
    try { return await planCruise(c); } catch (e) { console.warn(`${c}: ${(e as Error).message}`); return []; }
  })).flat();
  console.log(`${plans.length} dives with ancillary data`);

  const expeditions = expeditionNames();
  const titles = await landingTitles();
  const todo = plans.filter((p) => FORCE || !fs.existsSync(path.join(OUT_DIR, `${diveId(p.cruise, p.dive)}.json`))).slice(0, LIMIT);
  console.log(`${todo.length} to build`);

  const skipped: string[] = [];
  let done = 0;
  await mapLimit(todo, CONCURRENCY, async (p) => {
    try {
      const r = await buildDive(p, expeditions, titles);
      if ('skipped' in r) skipped.push(r.skipped);
      else fs.writeFileSync(path.join(OUT_DIR, `${r.id}.json`), JSON.stringify(carryMirror(r, path.join(OUT_DIR, `${r.id}.json`))));
    } catch (e) {
      skipped.push(`${diveId(p.cruise, p.dive)}: ${(e as Error).message}`);
    }
    done += 1;
    if (done % 10 === 0) console.log(`  ${done}/${todo.length}`);
  });

  // The index is rebuilt from every dive file on disk.
  const summaries: DiveSummary[] = fs.readdirSync(OUT_DIR)
    .filter((f) => /^EX.*-DIVE\d{2}\.json$/.test(f))
    .map((f) => summarise(JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8')) as DiveDetail))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const index: DiveIndex = { version: 1, generatedAt: new Date().toISOString(), dives: summaries };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index));

  const hours = summaries.reduce((s, d) => s + d.videoSeconds, 0) / 3600;
  const sightings = summaries.reduce((s, d) => s + d.sightingCount, 0);
  console.log(`index: ${summaries.length} dives, ${Math.round(hours).toLocaleString('en-US')} h of main-camera video, ${sightings.toLocaleString('en-US')} sightings`);
  if (skipped.length) console.log(`skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
