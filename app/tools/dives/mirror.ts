/**
 * Publish dive camera footage so Dive Replay can stream it.
 *
 * NOAA archives each dive's recordings inside one zip of 3-23 GB, compressed,
 * so a player cannot stream from it. This takes the main camera's five-minute
 * segments out of the archive one at a time (range requests, no full
 * download), remuxes each for streaming (video only, moov atom first, no
 * re-encode, no audio: the audio track is the team's intercom), and uploads
 * it to S3-compatible storage frontier go controls. Then it marks the
 * segments as mirrored in app/data/dives/<id>.json, which the site deploy
 * publishes and the app reads.
 *
 *   npx tsx tools/dives/mirror.ts --dives EX2104-DIVE05,EX2107-DIVE02
 *   npx tsx tools/dives/mirror.ts --top 20 --bottom-only
 *   npx tsx tools/dives/mirror.ts --top 20 --bottom-only --dry-run
 *
 * Environment (all required except MIRROR_REGION):
 *   MIRROR_ENDPOINT          e.g. https://<account>.r2.cloudflarestorage.com
 *   MIRROR_BUCKET            bucket name
 *   MIRROR_ACCESS_KEY_ID     access key with write access to the bucket
 *   MIRROR_SECRET_ACCESS_KEY
 *   MIRROR_PUBLIC_BASE       public URL of the bucket, e.g. https://media.example.com
 *   MIRROR_REGION            default "auto" (R2); "us-east-1" etc. for S3
 *
 * Needs ffmpeg and ffprobe on PATH. Idempotent: a segment already in the
 * bucket is not uploaded again. Stops when --max-gb has been uploaded.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import type { DiveDetail, DiveIndex, DiveSegment } from '../../src/core/dives/types';
import type { ZipEntry } from '../../src/providers/noaaDives/zip';
import { dataOffset, locateCentralDirectory, parseCentralDirectory, readZip64Record } from '../../src/providers/noaaDives/zip';
import { signRequest } from './sigv4';
import { summarise } from './crawl';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DIVES_DATA || path.resolve(HERE, '../../data/dives');
const ARCHIVE = 'https://oer.hpc.msstate.edu/okeanos/';
const UA = 'frontier-go-dive-mirror/1.0 (+https://hobogoblin45.github.io/frontier-go/support)';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const DRY = args.includes('--dry-run');
const BOTTOM_ONLY = args.includes('--bottom-only');
const MAX_BYTES = Number(opt('max-gb') || '50') * 1e9;

/** The stretch of a dive worth mirroring first: on the bottom, with ten minutes either side. */
export function bottomWindow(d: DiveDetail): [number, number] {
  const on = d.events.find((e) => e.kind === 'on_bottom')?.t;
  const off = d.events.find((e) => e.kind === 'off_bottom')?.t;
  if (on === undefined || off === undefined || off <= on) return [-Infinity, Infinity];
  return [on - 600, off + 600];
}

export function segmentsToMirror(d: DiveDetail, bottomOnly: boolean): DiveSegment[] {
  const [a, b] = bottomOnly ? bottomWindow(d) : [-Infinity, Infinity];
  return d.segments.filter((s) => s.t + s.duration >= a && s.t <= b);
}

/** Dives to mirror, most sightings first: the ones with the most to show. */
export function chooseDives(index: DiveIndex, opts: { ids?: string[]; top?: number }): string[] {
  if (opts.ids?.length) return opts.ids;
  return [...index.dives]
    .filter((d) => d.videoSeconds > 0)
    .sort((x, y) => y.sightingCount - x.sightingCount || y.maxDepthMeters - x.maxDepthMeters)
    .slice(0, opts.top ?? 10)
    .map((d) => d.id);
}

export function objectKey(diveId: string, file: string): string {
  return `dives/${diveId}/${file}`;
}

/* ------------------------------------------------------------------ */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function fetchRetry(url: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
      if (res.ok || res.status === 206 || res.status === 404) return res;
      last = new Error(`${res.status} ${url}`);
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw last;
}

async function bytes(url: string, range: string): Promise<Uint8Array> {
  const res = await fetchRetry(url, { headers: { Range: range } });
  if (!(res.ok || res.status === 206)) throw new Error(`${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function zipEntries(url: string): Promise<Map<string, ZipEntry>> {
  let loc = locateCentralDirectory(await bytes(url, 'bytes=-65557'));
  if (loc.zip64RecordOffset !== undefined) {
    loc = { ...loc, ...readZip64Record(await bytes(url, `bytes=${loc.zip64RecordOffset}-${loc.zip64RecordOffset + 55}`)) };
  }
  const entries = parseCentralDirectory(await bytes(url, `bytes=${loc.offset}-${loc.offset + loc.size - 1}`));
  return new Map(entries.map((e) => [e.name.split('/').pop()!, e]));
}

/** Stream one member out of the archive to a file, inflating on the way. */
async function extractTo(url: string, e: ZipEntry, file: string): Promise<void> {
  const start = dataOffset(e, await bytes(url, `bytes=${e.offset}-${e.offset + 29}`));
  const res = await fetchRetry(url, { headers: { Range: `bytes=${start}-${start + e.compressedSize - 1}` } });
  if (!res.body) throw new Error(`empty body for ${e.name}`);
  const src = Readable.fromWeb(res.body as never);
  if (e.method === 0) await pipeline(src, fs.createWriteStream(file));
  else await pipeline(src, zlib.createInflateRaw(), fs.createWriteStream(file));
}

function remux(input: string, output: string): number {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-map', '0:v:0', '-c', 'copy', '-an', '-movflags', '+faststart', output]);
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output], { encoding: 'utf8' });
  return Number(out.trim());
}

interface Store {
  exists(key: string): Promise<boolean>;
  put(key: string, file: string): Promise<void>;
}

function s3Store(): Store {
  const endpoint = new URL(env('MIRROR_ENDPOINT'));
  const bucket = env('MIRROR_BUCKET');
  const credentials = {
    accessKeyId: env('MIRROR_ACCESS_KEY_ID'),
    secretAccessKey: env('MIRROR_SECRET_ACCESS_KEY'),
    region: process.env.MIRROR_REGION || 'auto',
    service: 's3',
  };
  const urlFor = (key: string) => new URL(`${endpoint.origin}/${bucket}/${key}`);
  return {
    async exists(key) {
      const url = urlFor(key);
      const headers = signRequest({ method: 'HEAD', url, headers: { host: url.host }, payloadHash: 'UNSIGNED-PAYLOAD', credentials });
      const res = await fetch(url, { method: 'HEAD', headers });
      return res.ok;
    },
    async put(key, file) {
      const url = urlFor(key);
      const size = fs.statSync(file).size;
      const headers = signRequest({
        method: 'PUT',
        url,
        headers: {
          host: url.host,
          'content-type': 'video/mp4',
          'content-length': String(size),
          'cache-control': 'public, max-age=31536000, immutable',
        },
        payloadHash: 'UNSIGNED-PAYLOAD',
        credentials,
      });
      const res = await fetch(url, { method: 'PUT', headers, body: Readable.toWeb(fs.createReadStream(file)) as never, duplex: 'half' } as RequestInit);
      if (!res.ok) throw new Error(`upload ${key}: ${res.status} ${await res.text()}`);
    },
  };
}

async function mirrorDive(id: string, store: Store | null, budget: { bytes: number }): Promise<number> {
  const file = path.join(DATA, `${id}.json`);
  const d = JSON.parse(fs.readFileSync(file, 'utf8')) as DiveDetail;
  const want = segmentsToMirror(d, BOTTOM_ONLY).filter((s) => !s.mirrored);
  const gb = want.reduce((sum, s) => sum + s.bytes, 0) / 1e9;
  console.log(`${id}: ${want.length} segments to mirror (~${gb.toFixed(1)} GB before remux)`);
  if (DRY || !store || !want.length) return 0;

  const base = env('MIRROR_PUBLIC_BASE').replace(/\/$/, '');
  const dir = d.cruise.toLowerCase();
  const zip = `${ARCHIVE}${dir}/${dir}-DIVE${String(d.dive).padStart(2, '0')}-videos.zip`;
  const entries = await zipEntries(zip);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dive-'));
  let done = 0;
  try {
    for (const seg of want) {
      if (budget.bytes <= 0) { console.log('  budget reached'); break; }
      const key = objectKey(id, seg.file);
      const raw = path.join(tmp, 'in.mp4');
      const out = path.join(tmp, 'out.mp4');
      if (!(await store.exists(key))) {
        const e = entries.get(seg.file);
        if (!e) { console.log(`  missing in archive: ${seg.file}`); continue; }
        await extractTo(zip, e, raw);
        const seconds = remux(raw, out);
        await store.put(key, out);
        budget.bytes -= fs.statSync(out).size;
        if (Number.isFinite(seconds) && seconds > 0) seg.duration = Math.round(seconds * 10) / 10;
      }
      seg.mirrored = true;
      done += 1;
      // Record progress as it happens, so an interrupted run keeps what it did.
      d.videoBase = `${base}/dives/${id}/`;
      fs.writeFileSync(file, JSON.stringify(d));
      process.stdout.write(`  ${done}/${want.length}\r`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`  ${done} mirrored`);
  return done;
}

async function main() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')) as DiveIndex;
  const ids = chooseDives(index, { ids: opt('dives')?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean), top: opt('top') ? Number(opt('top')) : undefined });
  const store = DRY ? null : s3Store();
  const budget = { bytes: MAX_BYTES };
  let total = 0;
  for (const id of ids) {
    if (budget.bytes <= 0) break;
    total += await mirrorDive(id, store, budget);
  }
  // The index says which dives can be replayed.
  index.dives = index.dives.map((s) => {
    try { return summarise(JSON.parse(fs.readFileSync(path.join(DATA, `${s.id}.json`), 'utf8')) as DiveDetail); } catch { return s; }
  });
  if (!DRY) fs.writeFileSync(path.join(DATA, 'index.json'), JSON.stringify(index));
  console.log(`${total} segments mirrored across ${ids.length} dives${DRY ? ' (dry run)' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
