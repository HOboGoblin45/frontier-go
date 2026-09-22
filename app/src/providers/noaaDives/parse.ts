import type { DiveEvent, DiveSegment, DiveSighting, DiveTrack } from '../../core/dives/types';
import { groupFor, OTHER_LIFE, TAXON_GROUPS } from '../../core/dives/groups';

/**
 * Parsers for the files NOAA archives for every Okeanos Explorer ROV dive.
 * Pure functions over text, so every rule is tested against the real files'
 * shapes (fixtures in providers/__tests__/noaaDives.test.ts).
 *
 * Formats seen across 2011-2025, all handled here:
 *   - dive summary .txt: decimal ("35.8177 ; -52.3041") and degree-minute
 *     ("39°, 42.414' N ; 071°, 35.914' W") positions; "Max Vehicle Depth" and
 *     "Max. depth" spellings.
 *   - RovTrack1Hz.csv: "DATE,TIME,UNIXTIME,DEPTH,ALT,LAT_DD,LON_DD" (2021+) and
 *     "date(mm/dd/yyyy),time(...),time (unix sec),lat (dec. deg.), ..." (earlier).
 *   - annotations: SeaTube v3 exports (2021+) with WoRMS taxonomy and CTD
 *     columns, and the 2018-19 exports with the lineage in the description.
 */

/* ------------------------------------------------------------------ */
/* Dive summary text                                                   */
/* ------------------------------------------------------------------ */

export interface ParsedSummary {
  events: { kind: DiveEvent['kind']; unix: number; lat?: number; lon?: number }[];
  maxDepthMeters?: number;
  bottomSeconds?: number;
}

const EVENT_LABELS: [RegExp, DiveEvent['kind']][] = [
  [/^\s*In Water(?: at)?:/i, 'in_water'],
  [/^\s*On Bottom(?: at)?:/i, 'on_bottom'],
  [/^\s*Off Bottom(?: at)?:/i, 'off_bottom'],
  [/^\s*Out Water(?: at)?:/i, 'out_water'],
];

/** "2021-07-08T12:29:21.504715" is UTC in every NOAA file; it carries no zone. */
export function isoUtcToUnix(iso: string): number | undefined {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?/);
  if (!m) return undefined;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return ms / 1000 + (m[7] ? Number(m[7]) : 0);
}

/** A position line in either of NOAA's two spellings. */
export function parsePosition(line: string): { lat: number; lon: number } | undefined {
  const dec = line.match(/(-?\d{1,2}\.\d+)\s*;\s*(-?\d{1,3}\.\d+)/);
  if (dec) return { lat: Number(dec[1]), lon: Number(dec[2]) };
  const dm = line.match(/(\d{1,2})\D{1,4}?,\s*(\d{1,2}(?:\.\d+)?)'\s*([NS])\s*;\s*(\d{1,3})\D{1,4}?,\s*(\d{1,2}(?:\.\d+)?)'\s*([EW])/);
  if (dm) {
    const lat = (Number(dm[1]) + Number(dm[2]) / 60) * (dm[3] === 'S' ? -1 : 1);
    const lon = (Number(dm[4]) + Number(dm[5]) / 60) * (dm[6] === 'W' ? -1 : 1);
    return { lat, lon };
  }
  return undefined;
}

function hms(text: string): number | undefined {
  const m = text.match(/(\d+):(\d+):(\d+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
}

export function parseDiveSummary(text: string): ParsedSummary {
  const lines = text.split(/\r?\n/);
  const out: ParsedSummary = { events: [] };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const ev = EVENT_LABELS.find(([re]) => re.test(line));
    if (ev) {
      const unix = isoUtcToUnix(line.replace(ev[0], '').trim());
      if (unix !== undefined) {
        const pos = parsePosition(lines[i + 1] || '');
        out.events.push({ kind: ev[1], unix, ...(pos || {}) });
      }
      continue;
    }
    if (/Max(?:imum)?\.?\s*(?:Vehicle\s*)?depth/i.test(line) && out.maxDepthMeters === undefined) {
      // The value can wrap onto the following line in the PDF-derived text.
      const m = [line, lines[i + 1] || '', lines[i + 2] || ''].join(' ').replace(/^.*?depth:?/i, '').match(/([\d.]+)\s*m\b/);
      const v = m ? Number(m[1]) : NaN;
      if (Number.isFinite(v) && v > 0 && v < 11000) out.maxDepthMeters = v;
      continue;
    }
    if (/Bottom Time:/i.test(line)) out.bottomSeconds = hms(line);
  }
  out.events.sort((a, b) => a.unix - b.unix);
  return out;
}

/* ------------------------------------------------------------------ */
/* Dive summary PDF (pdftotext -layout)                                */
/* ------------------------------------------------------------------ */

export interface ParsedSummaryPdf {
  site?: string;
  area?: string;
  purpose?: string;
}

function tidy(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  return t && !/^(n\/?a|none|tbd)$/i.test(t) ? t : undefined;
}

/**
 * The "Dive Information" table. With -layout, a label and its value share a
 * line ("  Site Name       Rockaway Seamount"); a value that wraps continues on
 * the next lines under the value column.
 */
export function parseSummaryPdf(layoutText: string): ParsedSummaryPdf {
  const lines = layoutText.split(/\r?\n/);
  const valueAfter = (label: RegExp, stop: RegExp): string | undefined => {
    const i = lines.findIndex((l) => label.test(l));
    if (i < 0) return undefined;
    const first = lines[i].replace(label, '');
    const col = lines[i].length - first.trimStart().length;
    const parts = [first.trim()];
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      const l = lines[j];
      if (!l.trim() || stop.test(l)) break;
      // Continuation lines are indented to the value column; a wrapped label
      // (e.g. "Descriptor" under "General Area") sits at the label column.
      if (l.length - l.trimStart().length < col - 2) continue;
      parts.push(l.trim());
    }
    return tidy(parts.join(' '));
  };
  const STOP = /^\s*(General Area|Science Team|Expedition|ROV Dive|Mapping Lead|Dive Purpose|Was the dive|Descriptor|Leads|Coordinator|Supervisor|Underwater|Summary Data)/i;
  return {
    site: valueAfter(/^\s*Site Name\s+/i, STOP),
    area: valueAfter(/^\s*General Area\s+/i, STOP),
    purpose: valueAfter(/^\s*Dive Purpose\s+/i, /^\s*(Was the dive|Underwater|ROV Dive|restricted)/i),
  };
}

/**
 * A place name from the dive summary, without what older layouts let run into
 * it: the next row's people ("... Daniel Wagner (Biology) Adam Skarke
 * (Geology)"), or depth and coordinate notes the site field sometimes carries.
 */
export function cleanPlaceName(s: string | undefined): string | undefined {
  let t = tidy(s);
  if (!t) return undefined;
  // A wrapped table label ("General Area / Descriptor") lands in front of the value.
  t = t.replace(/^Descriptor\b:?\s*/i, '').replace(/[;,]\s*$/, '');
  // "Dive 02 - East of Formigas Rift": the dive number is not part of the place.
  t = t.replace(/^Dive\s*\d+\s*[-\u2013:]\s*/i, '');
  t = t.replace(/\s+[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z'-]+\s*\((?:Biology|Geology|Bio|Geo|Chemistry|Archaeology|Science)[^)]*\).*$/, '');
  t = t.replace(/\s*\((?:[^)]*\b(?:m water depth|ROV on bottom|-?\d+\.\d{3,})[^)]*)\)/gi, '');
  t = t.replace(/,\s*ROV on bottom at .*$/i, '');
  t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2013|\u2014/g, '-');
  return tidy(t);
}

/* ------------------------------------------------------------------ */
/* 1 Hz ROV track                                                      */
/* ------------------------------------------------------------------ */

function splitCsvLine(line: string): string[] {
  return line.split(',').map((c) => c.trim());
}

function column(header: string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

export interface RawTrack {
  unix: number[];
  depth: number[];
  lat: (number | null)[];
  lon: (number | null)[];
}

export function parseTrack1Hz(csv: string): RawTrack {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0] || '').map((h) => h.toLowerCase());
  const iT = column(header, /^unixtime$/, /unix/);
  const iD = column(header, /^depth$/, /^depth/);
  const iLat = column(header, /^lat_dd$/, /^lat/);
  const iLon = column(header, /^lon_dd$/, /^lon/);
  if (iT < 0 || iD < 0) throw new Error(`track: unrecognised header "${lines[0]}"`);
  const out: RawTrack = { unix: [], depth: [], lat: [], lon: [] };
  for (let k = 1; k < lines.length; k += 1) {
    const f = splitCsvLine(lines[k]);
    const t = Number(f[iT]);
    const d = Number(f[iD]);
    if (!Number.isFinite(t) || !Number.isFinite(d)) continue;
    const la = iLat >= 0 && f[iLat] !== '' ? Number(f[iLat]) : NaN;
    const lo = iLon >= 0 && f[iLon] !== '' ? Number(f[iLon]) : NaN;
    const valid = Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0);
    out.unix.push(t);
    // 2021 onwards logs depth as a negative elevation; earlier files as positive depth.
    out.depth.push(Math.abs(d));
    out.lat.push(valid ? la : null);
    out.lon.push(valid ? lo : null);
  }
  return out;
}

const round = (v: number, p: number) => Math.round(v * 10 ** p) / 10 ** p;

/**
 * One sample every `step` seconds, relative to `startUnix`. Depth keeps 0.1 m
 * and position 5 decimals (about a metre): the file is for a gauge and a map,
 * not for navigation.
 */
export function downsampleTrack(raw: RawTrack, startUnix: number, step = 30): DiveTrack {
  const out: DiveTrack = { t: [], depth: [], lat: [], lon: [] };
  let next = -Infinity;
  for (let i = 0; i < raw.unix.length; i += 1) {
    const t = raw.unix[i] - startUnix;
    const last = i === raw.unix.length - 1;
    if (t < next && !last) continue;
    out.t.push(Math.round(t));
    out.depth.push(round(raw.depth[i], 1));
    out.lat.push(raw.lat[i] === null ? null : round(raw.lat[i]!, 5));
    out.lon.push(raw.lon[i] === null ? null : round(raw.lon[i]!, 5));
    next = t + step;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Video segments                                                      */
/* ------------------------------------------------------------------ */

/**
 * The main camera's continuous recording: ..._VID_20210708T150459Z_ROVHD_Low.mp4.
 * Named-event clips from before 2017 ("..._ROVHD_WATER_COLUMN_UNK_Low.mov") are
 * not continuous and are left out of replay.
 */
const SEGMENT = /_VID_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z_ROVHD_Low\.mp4$/;

export function segmentStartUnix(file: string): number | undefined {
  const m = file.match(SEGMENT);
  if (!m) return undefined;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
}

/** NOAA cuts every five minutes; a last segment is shorter, never longer. */
export const SEGMENT_SECONDS = 300;

export function buildSegments(
  entries: { name: string; size: number }[],
  startUnix: number,
  bytesPerSecond = 230_000,
): DiveSegment[] {
  const found = entries
    .map((e) => ({ file: e.name.split('/').pop()!, bytes: e.size, unix: segmentStartUnix(e.name) }))
    .filter((e): e is { file: string; bytes: number; unix: number } => e.unix !== undefined && !e.file.startsWith('.'))
    .sort((a, b) => a.unix - b.unix);
  return found.map((e, i) => {
    const gap = i + 1 < found.length ? found[i + 1].unix - e.unix : Infinity;
    // The final segment's length is read from its size at the typical bitrate.
    const bySize = Math.round(e.bytes / bytesPerSecond);
    return {
      t: Math.round(e.unix - startUnix),
      duration: Math.max(1, Math.min(SEGMENT_SECONDS, gap, Number.isFinite(gap) ? gap : bySize)),
      file: e.file,
      bytes: e.bytes,
    };
  });
}

/** Main-camera framegrabs: ..._IMG_20210708T150502Z_ROVHD.jpg (2016 onward naming). */
const STILL = /_IMG_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z_ROVHD\.jpe?g$/i;

export function buildStills(names: string[], startUnix: number): { t: number; file: string }[] {
  const out: { t: number; file: string }[] = [];
  for (const name of names) {
    const file = name.split('/').pop()!;
    const m = file.match(STILL);
    if (!m || file.startsWith('.')) continue;
    out.push({ t: Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000 - startUnix), file });
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ------------------------------------------------------------------ */
/* Annotations                                                         */
/* ------------------------------------------------------------------ */

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** "20210708T150450.638Z" or "16-Jun-2018 18:34:49", both UTC. */
export function annotationTimeToUnix(s: string): number | undefined {
  const a = s.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);
  if (a) return Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]) / 1000 + (a[7] ? Number(a[7]) : 0);
  const b = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (b && MONTHS[b[2].toLowerCase()] !== undefined) {
    return Date.UTC(+b[3], MONTHS[b[2].toLowerCase()], +b[1], +b[4], +b[5], +b[6]) / 1000;
  }
  return isoUtcToUnix(s);
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** First listed common name, as logged ("glass sponges; hexactinellid sponges" -> "glass sponges"). */
function firstCommonName(s: string | undefined): string | undefined {
  const t = tidy(s?.split(/[;,]/)[0]);
  return t ? t.toLowerCase() : undefined;
}

/** Notes worth keeping: a scientist's words, never a test marker or a person's name. */
function cleanNote(s: string | undefined): string | undefined {
  const t = tidy(s?.replace(/:$/, ''));
  if (!t) return undefined;
  if (/\btest\b|\*{2,}|^EX\d{4}/i.test(t)) return undefined;
  return t.length > 140 ? `${t.slice(0, 139).trimEnd()}…` : t;
}

/** Same animal logged repeatedly: keep the first log within this window. */
const DUPLICATE_WINDOW = 45;

/**
 * Living things the science team logged, in time order. Substrate calls,
 * vehicle events, sampling notes and anything unrelated to life are dropped;
 * those are for the scientists, not the audience.
 */
export function parseAnnotations(csv: string, startUnix: number): DiveSighting[] {
  const rows = parseCsv(csv);
  const hi = rows.findIndex((r) => r.includes('Dive ID') || r.includes('Observation Id'));
  if (hi < 0) return [];
  const header = rows[hi];
  const idx = (pred: (h: string) => boolean) => header.findIndex(pred);
  const seatube = header.includes('Dive ID');

  const iTime = seatube ? idx((h) => h === 'Start Date') : idx((h) => h === 'Time (UTC)');
  const iComment = seatube ? idx((h) => h === 'Comment') : idx((h) => h === 'Description');
  const iTaxonomy = idx((h) => h === 'Taxonomy');
  const iTaxon = idx((h) => h === 'Taxon');
  const iCommon = idx((h) => h === 'Taxon Common Names');
  const iPath = idx((h) => h === 'Taxon Path');
  const iTags = idx((h) => h === 'Tags');
  const iDepth = seatube
    ? idx((h) => /SBECTD.*_Depth( \(m\))?$/.test(h))
    : idx((h) => h === 'Depth');
  const iTemp = seatube ? idx((h) => /SBECTD.*_Temperature( \(C\))?$/.test(h)) : -1;

  const out: DiveSighting[] = [];
  for (const r of rows.slice(hi + 1)) {
    if (r.length < 3) continue;
    const unix = annotationTimeToUnix(r[iTime] || '');
    if (unix === undefined) continue;
    let taxon: string | undefined;
    let common: string | undefined;
    let lineage: string | undefined;
    let legacyNote: string | undefined;
    if (seatube) {
      if ((r[iTaxonomy] || '') !== 'WoRMS') continue;
      taxon = tidy(r[iTaxon]);
      common = firstCommonName(r[iCommon]);
      lineage = r[iPath];
    } else {
      if (!/Bio Observation/i.test(r[iTags] || '')) continue;
      // "Porifera Hexactinellida (Glass Sponge):" - lineage words, then the common name.
      const desc = r[iComment] || '';
      lineage = desc;
      const paren = desc.match(/\(([^)]+)\)/);
      common = firstCommonName(paren?.[1]);
      const head = desc.replace(/\(.*$/, '').replace(/:.*$/, '').trim();
      const words = head.split(/\s+/).filter((w) => /^[A-Z][a-z]+$/.test(w));
      taxon = words.length ? words[words.length - 1] : undefined;
      // "Mollusca (Mollusc): Octopoda" - the note after the colon is the
      // scientist narrowing the call; when it names a more specific group,
      // that group and clade are the sighting, not the broad heading.
      const noteText = desc.includes(':') ? desc.slice(desc.indexOf(':') + 1) : '';
      const fromHead = groupFor(head);
      const fromNote = groupFor(noteText);
      if (fromNote && fromNote !== fromHead && TAXON_GROUPS.indexOf(fromNote) < TAXON_GROUPS.indexOf(fromHead ?? OTHER_LIFE)) {
        const clade = noteText.match(new RegExp(`\\b(${fromNote.clades.join('|')})\\b`, 'i'));
        taxon = clade ? clade[1] : taxon;
        common = undefined;
        lineage = noteText;
      }
      legacyNote = cleanNote(noteText);
    }
    const group = groupFor(lineage) || groupFor(taxon) || (taxon || common ? OTHER_LIFE : null);
    if (!group) continue;
    const note = seatube ? cleanNote(r[iComment]) : legacyNote;
    const depth = num(r[iDepth]);
    const tempC = iTemp >= 0 ? num(r[iTemp]) : undefined;
    out.push({
      t: Math.round((unix - startUnix) * 10) / 10,
      ...(taxon ? { taxon } : {}),
      ...(common ? { common } : {}),
      group: group.name,
      ...(note ? { note } : {}),
      ...(depth !== undefined && depth > 0 && depth < 11000 ? { depth: Math.round(depth * 10) / 10 } : {}),
      ...(tempC !== undefined && tempC > -3 && tempC < 40 ? { tempC: Math.round(tempC * 100) / 100 } : {}),
    });
  }
  out.sort((a, b) => a.t - b.t);
  const kept: DiveSighting[] = [];
  const lastSeen = new Map<string, number>();
  for (const s of out) {
    const key = `${s.taxon || ''}|${s.common || ''}|${s.group}`;
    const prev = lastSeen.get(key);
    lastSeen.set(key, s.t);
    if (prev !== undefined && s.t - prev < DUPLICATE_WINDOW) continue;
    kept.push(s);
  }
  return kept;
}
