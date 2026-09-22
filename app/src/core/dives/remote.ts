import type { DiveDetail, DiveIndex, DiveSegment } from './types';
import { SITE_URL } from '../platform/site';

/**
 * Dive data is not bundled with the app: 528 dives is 27 MB, and the
 * website already serves it, versioned with each deploy. The index is small
 * and fetched once per session; a dive's detail is fetched when it is opened.
 */

export const DIVE_DATA_URL = `${SITE_URL}/dives/data`;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

let indexPromise: Promise<DiveIndex | null> | null = null;
const details = new Map<string, Promise<DiveDetail | null>>();

async function getJson<T>(url: string, fetchImpl: Fetch, timeoutMs: number): Promise<T | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isDiveIndex(v: unknown): v is DiveIndex {
  const x = v as DiveIndex;
  return !!x && x.version === 1 && Array.isArray(x.dives) && x.dives.every((d) => typeof d.id === 'string' && Number.isFinite(d.latitude) && Number.isFinite(d.longitude));
}

export function isDiveDetail(v: unknown): v is DiveDetail {
  const x = v as DiveDetail;
  return !!x && typeof x.id === 'string' && !!x.track && Array.isArray(x.track.t) && Array.isArray(x.sightings) && Array.isArray(x.segments);
}

export function loadDiveIndex(fetchImpl: Fetch = fetch, timeoutMs = 15_000): Promise<DiveIndex | null> {
  if (!indexPromise) {
    indexPromise = getJson<unknown>(`${DIVE_DATA_URL}/index.json`, fetchImpl, timeoutMs)
      .then((v) => (isDiveIndex(v) ? v : null));
    // A failed load may be a moment without signal; let the next open retry.
    void indexPromise.then((v) => { if (!v) indexPromise = null; });
  }
  return indexPromise;
}

export function loadDive(id: string, fetchImpl: Fetch = fetch, timeoutMs = 20_000): Promise<DiveDetail | null> {
  if (!/^EX[0-9A-Z]+-DIVE\d{2}$/.test(id)) return Promise.resolve(null);
  let p = details.get(id);
  if (!p) {
    p = getJson<unknown>(`${DIVE_DATA_URL}/${id}.json`, fetchImpl, timeoutMs).then((v) => (isDiveDetail(v) ? v : null));
    details.set(id, p);
    void p.then((v) => { if (!v) details.delete(id); });
  }
  return p;
}

/** Segments that can actually be played: mirrored, and only when the dive has a video base. */
export function playableSegments(d: DiveDetail): DiveSegment[] {
  if (!d.videoBase) return [];
  return d.segments.filter((s) => s.mirrored);
}

export function segmentUrl(d: DiveDetail, s: DiveSegment): string {
  return `${d.videoBase!.replace(/\/?$/, '/')}${encodeURIComponent(s.file)}`;
}

/** For tests: forget cached loads. */
export function resetDiveCache(): void {
  indexPromise = null;
  details.clear();
}
