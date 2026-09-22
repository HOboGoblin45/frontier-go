/**
 * Photographs for the Deep Atlas pages: the ROV's own framegrabs.
 *
 * NOAA saves a full-resolution still from the main camera whenever the team
 * sees something worth keeping, and names it with the second it was taken.
 * 94% of logged sightings have one within 90 seconds, so a sighting can be
 * shown with the picture the scientists took of it.
 *
 * The stills live inside each dive's images zip. This reads just the members
 * it needs over range requests, shrinks them to web size in pure JS (jpeg-js,
 * no native dependency), and caches the result so a deploy only fetches what
 * is new.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import jpeg from 'jpeg-js';
import type { DiveDetail, DiveSighting, DiveStill } from '../../src/core/dives/types';
import type { ZipEntry } from '../../src/providers/noaaDives/zip';
import { dataOffset, locateCentralDirectory, parseCentralDirectory, readZip64Record } from '../../src/providers/noaaDives/zip';

const ARCHIVE = 'https://oer.hpc.msstate.edu/okeanos/';
const UA = 'frontier-go-dive-index/1.0 (+https://hobogoblin45.github.io/frontier-go/support)';
export const STILL_WIDTH = 480;
const NEAR = 90;

/** The still nearest to a dive time, within 90 seconds. */
export function stillNear(stills: readonly DiveStill[], t: number, within = NEAR): DiveStill | undefined {
  let best: DiveStill | undefined;
  for (const s of stills) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best && Math.abs(best.t - t) <= within ? best : undefined;
}

function gap(stills: readonly DiveStill[], t: number): number {
  const s = stillNear(stills, t);
  return s ? Math.abs(s.t - t) : Infinity;
}

/**
 * Of several sightings, the one whose framegrab was taken closest to it. A
 * scientist saves a still when something is on screen, so the tightest pair
 * is the likeliest to actually show the animal.
 */
export function bestPictured(stills: readonly DiveStill[], sightings: readonly DiveSighting[]): DiveSighting | undefined {
  let best: DiveSighting | undefined;
  let bestGap = Infinity;
  for (const s of sightings) {
    const g = gap(stills, s.t);
    if (g < bestGap) { best = s; bestGap = g; }
  }
  return bestGap <= NEAR ? best : undefined;
}

/** Groups people come for first; a dive's cover shows the rarest thing it met. */
const COVER_PRIORITY = [
  'Octopus', 'Squid', 'Octopus and squid', 'Anglerfish', 'Sharks, rays and chimaeras', 'Siphonophores', 'Comb jellies',
  'Jellyfish', 'Sea spiders', 'Crabs', 'Lobsters', 'Squat lobsters', 'Sea stars', 'Black corals', 'Bamboo corals',
  'Stony corals', 'Glass sponges', 'Fish', 'Sea lilies and feather stars',
];

export function coverSighting(d: DiveDetail): DiveSighting | undefined {
  for (const g of COVER_PRIORITY) {
    const hit = bestPictured(d.stills, d.sightings.filter((s) => s.group === g));
    if (hit && gap(d.stills, hit.t) <= 30) return hit;
  }
  return bestPictured(d.stills, d.sightings);
}

/** The still that represents a dive: its best sighting's, else the middle of its bottom time. */
export function coverStill(d: DiveDetail): DiveStill | undefined {
  const s = coverSighting(d);
  if (s) return stillNear(d.stills, s.t);
  if (!d.stills.length) return undefined;
  const on = d.events.find((e) => e.kind === 'on_bottom')?.t ?? 0;
  const off = d.events.find((e) => e.kind === 'off_bottom')?.t ?? d.durationSeconds;
  const mid = (on + off) / 2;
  return [...d.stills].sort((a, b) => Math.abs(a.t - mid) - Math.abs(b.t - mid))[0];
}

/** Up to `n` sightings with stills, one per group, rarest first: the photo strip on a dive page. */
export function stripSightings(d: DiveDetail, n = 6): { sighting: DiveSighting; still: DiveStill }[] {
  const out: { sighting: DiveSighting; still: DiveStill }[] = [];
  const seen = new Set<string>();
  const order = [...COVER_PRIORITY, ...new Set(d.sightings.map((s) => s.group))];
  for (const g of order) {
    if (out.length >= n) break;
    if (seen.has(g)) continue;
    seen.add(g);
    const s = bestPictured(d.stills, d.sightings.filter((x) => x.group === g));
    if (s) out.push({ sighting: s, still: stillNear(d.stills, s.t)! });
  }
  return out;
}

/** The sighting of a group on a dive that is best shown in a picture (falls back to the one given). */
export function pictureFor(d: DiveDetail, group: string, fallback: DiveSighting): DiveSighting {
  return bestPictured(d.stills, d.sightings.filter((s) => s.group === group)) || fallback;
}

export function stillPath(diveId: string, file: string): string {
  return `dives/img/${diveId.toLowerCase()}/${file.replace(/\.jpe?g$/i, '').toLowerCase()}.jpg`;
}

/* ------------------------------------------------------------------ */
/* Fetch and resize                                                    */
/* ------------------------------------------------------------------ */

async function get(url: string, range?: string): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < 4; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...(range ? { Range: range } : {}) }, signal: AbortSignal.timeout(120_000) });
      if (res.ok || res.status === 206) return new Uint8Array(await res.arrayBuffer());
      last = new Error(`${res.status} ${url}`);
      if (res.status === 404) break;
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw last;
}

async function entriesOf(url: string): Promise<Map<string, ZipEntry>> {
  let loc = locateCentralDirectory(await get(url, 'bytes=-65557'));
  if (loc.zip64RecordOffset !== undefined) {
    loc = { ...loc, ...readZip64Record(await get(url, `bytes=${loc.zip64RecordOffset}-${loc.zip64RecordOffset + 55}`)) };
  }
  const entries = parseCentralDirectory(await get(url, `bytes=${loc.offset}-${loc.offset + loc.size - 1}`));
  return new Map(entries.map((e) => [e.name.split('/').pop()!, e]));
}

async function member(url: string, e: ZipEntry): Promise<Buffer> {
  const start = dataOffset(e, await get(url, `bytes=${e.offset}-${e.offset + 29}`));
  const data = Buffer.from(await get(url, `bytes=${start}-${start + e.compressedSize - 1}`));
  return e.method === 0 ? data : zlib.inflateRawSync(data);
}

/** Area-average downscale of RGBA pixels to `width`, keeping the aspect ratio. */
export function downscale(rgba: Uint8Array, w: number, h: number, width: number): { data: Uint8Array; width: number; height: number } {
  if (w <= width) return { data: rgba, width: w, height: h };
  const height = Math.max(1, Math.round((h * width) / w));
  const out = new Uint8Array(width * height * 4);
  const sx = w / width;
  const sy = h / height;
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(h, Math.floor((y + 1) * sy));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(w, Math.floor((x + 1) * sx));
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx += 1) { r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n += 1; i += 4; }
      }
      const o = (y * width + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { data: out, width, height };
}

export interface StillRequest {
  diveId: string;
  cruise: string;
  dive: number;
  file: string;
}

/**
 * Make sure every requested still exists in `cacheDir` at web size. Returns
 * the set of site paths that are available (a still that could not be read
 * is simply absent; pages fall back to no picture).
 */
export async function ensureStills(requests: StillRequest[], cacheDir: string, concurrency = 8): Promise<Set<string>> {
  const available = new Set<string>();
  const byDive = new Map<string, StillRequest[]>();
  for (const r of requests) {
    const p = stillPath(r.diveId, r.file);
    if (fs.existsSync(path.join(cacheDir, p))) { available.add(p); continue; }
    const list = byDive.get(r.diveId) || [];
    if (!list.some((x) => x.file === r.file)) list.push(r);
    byDive.set(r.diveId, list);
  }
  const dives = [...byDive.values()];
  let next = 0;
  let fetched = 0;
  const worker = async () => {
    while (next < dives.length) {
      const list = dives[next++];
      const { cruise, dive } = list[0];
      const dir = cruise.toLowerCase();
      const url = `${ARCHIVE}${dir}/${dir}-DIVE${String(dive).padStart(2, '0')}-images.zip`;
      let entries: Map<string, ZipEntry>;
      try { entries = await entriesOf(url); } catch { continue; }
      for (const r of list) {
        const e = entries.get(r.file);
        if (!e) continue;
        try {
          const img = jpeg.decode(await member(url, e), { useTArray: true, maxMemoryUsageInMB: 512 });
          const small = downscale(img.data, img.width, img.height, STILL_WIDTH);
          const out = jpeg.encode({ data: small.data, width: small.width, height: small.height }, 74);
          const p = stillPath(r.diveId, r.file);
          fs.mkdirSync(path.dirname(path.join(cacheDir, p)), { recursive: true });
          fs.writeFileSync(path.join(cacheDir, p), out.data);
          available.add(p);
          fetched += 1;
        } catch { /* unreadable still: skip it */ }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, dives.length) }, worker));
  if (fetched) console.log(`  stills fetched: ${fetched}`);
  return available;
}
