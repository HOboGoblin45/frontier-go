import type { FrontierMediaItem } from '../types/media';
import { isPlottable } from '../types/location';
import type { FrontierSubject } from '../types/subjects';
import { ANIMAL_SUBJECTS } from '../types/subjects';
import { haversineKm } from '../util/geo';

/**
 * Finding footage by place: "what is there to see here, and near here".
 *
 * The globe answers where; this answers what. Items at the chosen point come
 * first, then everything within the radius, nearest first. Region-level
 * points are treated exactly like the others here - the list shows distance
 * from the point, not a claim about where each clip was filmed.
 */

export const DEFAULT_PLACE_RADIUS_KM = 120;

export interface NearbyItem {
  item: FrontierMediaItem;
  distanceKm: number;
}

export function itemsNear(
  pool: readonly FrontierMediaItem[],
  point: { latitude: number; longitude: number },
  radiusKm = DEFAULT_PLACE_RADIUS_KM,
): NearbyItem[] {
  const out: NearbyItem[] = [];
  for (const item of pool) {
    const l = item.location;
    if (!l || !isPlottable(l)) continue;
    const d = haversineKm(point.latitude, point.longitude, l.latitude, l.longitude);
    if (d <= radiusKm) out.push({ item, distanceKm: d });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm
    || (b.item.ranking?.contentQuality ?? 0) - (a.item.ranking?.contentQuality ?? 0));
}

/** The globe's filter: a few words wide, and every word a kind of thing. */
export type GlobeFilter = 'all' | 'animals' | 'plants' | 'landscapes' | 'landmarks' | 'history' | 'ocean' | 'space';

export const GLOBE_FILTERS: ReadonlyArray<{ key: GlobeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'animals', label: 'Animals' },
  { key: 'plants', label: 'Plants' },
  { key: 'landscapes', label: 'Landscapes' },
  { key: 'landmarks', label: 'Landmarks' },
  { key: 'history', label: 'History' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'space', label: 'Space' },
];

function has(item: FrontierMediaItem, subjects: ReadonlyArray<FrontierSubject>): boolean {
  return !!item.subjects && item.subjects.some((s) => subjects.includes(s));
}

export function matchesGlobeFilter(item: FrontierMediaItem, filter: GlobeFilter): boolean {
  switch (filter) {
    case 'animals': return has(item, ANIMAL_SUBJECTS);
    case 'plants': return has(item, ['plants']);
    case 'landscapes': return has(item, ['landscapes']);
    case 'landmarks': return has(item, ['landmarks']);
    case 'history': return has(item, ['history', 'native_heritage'])
      || item.channel === 'archives' || (item.channels?.includes('archives') ?? false);
    case 'ocean': return item.channel === 'deep_sea' || item.environment === 'deep_ocean'
      || item.environment === 'shallow_ocean' || has(item, ['deep_sea', 'sea_life']);
    case 'space': return item.channel === 'space' || ['orbit', 'lunar', 'martian', 'deep_space'].includes(item.environment);
    default: return true;
  }
}

/** Place search: the point's name, its region and the site names under it. */
export function placeMatches(query: string, point: { displayName: string }, items: readonly FrontierMediaItem[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (point.displayName.toLowerCase().includes(q)) return true;
  return items.some((i) => (i.location?.regionName || '').toLowerCase().includes(q)
    || (i.source.site || '').toLowerCase().includes(q));
}
