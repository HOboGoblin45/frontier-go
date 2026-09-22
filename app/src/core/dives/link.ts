import type { FrontierMediaItem } from '../types/media';
import type { DiveSummary } from './types';
import { diveTitle } from './atlas';

/**
 * Tie published NOAA clips to the dives they were cut from.
 *
 * NOAA's clip pages name the expedition ("... (EX2104)") and very often the
 * dive ("During Dive 05 ..."). When both are present and exactly one dive in
 * the index matches, the clip gets that dive's site as its place: the
 * position where the vehicle reached the bottom, labelled as the dive site,
 * never as the spot the clip was filmed. An expedition that spans several
 * cruises ("EX2204-EX2206") with the same dive number in more than one is
 * ambiguous and left alone.
 */

const DIVE_NUMBER = /\bDive\s*#?\s*0?(\d{1,2})\b/i;

export function cruiseCodes(expedition: string | undefined): string[] {
  if (!expedition) return [];
  const out: string[] = [];
  for (const m of expedition.matchAll(/\bEX(\d{4})(L\d)?(?:\s*[-–]\s*EX(\d{4}))?\b/gi)) {
    const from = Number(m[1]);
    const to = m[3] ? Number(m[3]) : from;
    for (let c = from; c <= to && c - from < 10; c += 1) out.push(`EX${c}`);
  }
  return out;
}

export function diveNumberIn(text: string): number | undefined {
  const m = text.match(DIVE_NUMBER);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 ? n : undefined;
}

/** The single dive a clip names, or undefined. */
export function findDive(item: Pick<FrontierMediaItem, 'title' | 'description' | 'source'>, dives: readonly DiveSummary[]): DiveSummary | undefined {
  const codes = cruiseCodes(item.source.expedition);
  if (!codes.length) return undefined;
  const n = diveNumberIn(item.title) ?? diveNumberIn(item.description || '');
  if (n === undefined) return undefined;
  // "EX1504" also covers its legs ("EX1504L2"); the dive number has to settle which.
  const matches = dives.filter((d) => d.dive === n && codes.some((c) => d.cruise === c || d.cruise.startsWith(`${c}L`)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function linkClipsToDives(items: FrontierMediaItem[], dives: readonly DiveSummary[]): number {
  let linked = 0;
  for (const item of items) {
    if (item.provider !== 'noaa_ocean_exploration') continue;
    const dive = findDive(item, dives);
    if (!dive) continue;
    const place = diveTitle(dive);
    item.source = { ...item.source, diveId: dive.id };
    item.location = {
      ...(item.location || { type: 'underwater' }),
      type: 'underwater',
      latitude: dive.latitude,
      longitude: dive.longitude,
      displayName: place,
      accuracy: 'site',
      coordinateSource: `NOAA ROV dive summary: on-bottom position of ${dive.cruise} dive ${dive.dive}`,
    };
    linked += 1;
  }
  return linked;
}
