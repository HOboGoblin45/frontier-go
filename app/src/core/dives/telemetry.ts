import type { DiveDetail, DiveSegment, DiveSighting, DiveTrack } from './types';

/**
 * One clock for the picture, the instruments and the log.
 *
 * Everything in a DiveDetail is keyed to seconds since `startUnix`. The
 * camera segments carry their own start times from NOAA's file names, so
 * "12 seconds into segment 31" and "3 h 41 min into the dive" are the same
 * instant, and the depth shown is the vehicle's depth at that instant.
 */

export interface Instruments {
  depth: number;
  lat: number | null;
  lon: number | null;
  /** Nearest logged water temperature within ten minutes, if any. */
  tempC: number | null;
}

/** Index of the last sample at or before t (binary search). */
export function sampleIndex(t: readonly number[], at: number): number {
  if (t.length === 0 || at <= t[0]) return 0;
  if (at >= t[t.length - 1]) return t.length - 1;
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= at) lo = mid;
    else hi = mid;
  }
  return lo;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpNullable(a: number | null, b: number | null, f: number): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return lerp(a, b, f);
}

/** The vehicle's instruments at a dive time, interpolated between samples. */
export function instrumentsAt(track: DiveTrack, sightings: readonly DiveSighting[], at: number): Instruments {
  const i = sampleIndex(track.t, at);
  const j = Math.min(i + 1, track.t.length - 1);
  const span = track.t[j] - track.t[i];
  const f = span > 0 ? Math.min(1, Math.max(0, (at - track.t[i]) / span)) : 0;
  return {
    depth: track.t.length ? lerp(track.depth[i], track.depth[j], f) : 0,
    lat: track.t.length ? lerpNullable(track.lat[i], track.lat[j], f) : null,
    lon: track.t.length ? lerpNullable(track.lon[i], track.lon[j], f) : null,
    tempC: nearestTemperature(sightings, at),
  };
}

const TEMP_WINDOW = 600;

export function nearestTemperature(sightings: readonly DiveSighting[], at: number): number | null {
  let best: DiveSighting | null = null;
  for (const s of sightings) {
    if (typeof s.tempC !== 'number') continue;
    if (!best || Math.abs(s.t - at) < Math.abs(best.t - at)) best = s;
  }
  return best && Math.abs(best.t - at) <= TEMP_WINDOW ? best.tempC! : null;
}

/** Which segment holds a dive time, and how far into it. */
export function locate(segments: readonly DiveSegment[], at: number): { index: number; offset: number } | null {
  if (!segments.length) return null;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const s = segments[i];
    if (at >= s.t) {
      const offset = at - s.t;
      if (offset <= s.duration) return { index: i, offset };
      // In a gap between recordings: start the next one.
      return i + 1 < segments.length ? { index: i + 1, offset: 0 } : { index: i, offset: s.duration };
    }
  }
  return { index: 0, offset: 0 };
}

/** The dive time for a position within a segment. */
export function diveTime(segments: readonly DiveSegment[], index: number, offset: number): number {
  const s = segments[Math.max(0, Math.min(index, segments.length - 1))];
  return s ? s.t + Math.max(0, Math.min(offset, s.duration)) : 0;
}

/** The next sighting strictly after `at`, optionally within one group. */
export function nextSighting(sightings: readonly DiveSighting[], at: number, group?: string): DiveSighting | null {
  for (const s of sightings) {
    if (s.t > at + 0.5 && (!group || s.group === group)) return s;
  }
  return null;
}

/** Sightings whose moment is on screen now (logged within the last `window` seconds). */
export function currentSightings(sightings: readonly DiveSighting[], at: number, window = 20): DiveSighting[] {
  return sightings.filter((s) => s.t <= at + 1 && at - s.t <= window);
}

export function formatDepth(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Degrees to "35.8178 N, 52.3041 W". */
export function formatPosition(lat: number | null, lon: number | null): string | null {
  if (lat === null || lon === null) return null;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)} ${ns}, ${Math.abs(lon).toFixed(4)} ${ew}`;
}

/** Time the dive's camera footage covers, the gaps between recordings excluded. */
export function recordedSeconds(detail: Pick<DiveDetail, 'segments'>): number {
  return detail.segments.reduce((sum, s) => sum + s.duration, 0);
}
