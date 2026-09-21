import type { FrontierCatalog, FrontierMediaItem, FrontierChannel } from '../types/media';
import { inChannel } from '../types/media';
import { evaluateEligibility } from './eligibility';
import { isPlottable } from '../types/location';
import { placeKey } from '../util/geo';

/**
 * Client-side catalog. The file is bundled with the app, so the first frame
 * never waits on a network round trip — and a phone with no signal still has a
 * channel to play.
 */

export const CATALOG_URL = 'catalog/frontier-catalog.json';

export interface LoadedCatalog {
  generatedAt: string;
  items: FrontierMediaItem[];
  byId: Map<string, FrontierMediaItem>;
  /** Only items the client's own eligibility pass accepted. */
  eligible: FrontierMediaItem[];
  stats: FrontierCatalog['stats'];
}

export function indexCatalog(catalog: FrontierCatalog): LoadedCatalog {
  const items = catalog.items || [];
  const eligible = items.filter((i) => evaluateEligibility(i).eligible);
  return {
    generatedAt: catalog.generatedAt,
    items,
    eligible,
    byId: new Map(items.map((i) => [i.id, i])),
    stats: catalog.stats,
  };
}

export async function loadCatalog(url = CATALOG_URL, fetchImpl: typeof fetch = fetch): Promise<LoadedCatalog> {
  const res = await fetchImpl(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Catalog unavailable (HTTP ${res.status})`);
  const json = (await res.json()) as FrontierCatalog;
  return indexCatalog(json);
}

export interface GlobePoint {
  key: string;
  latitude: number;
  longitude: number;
  displayName: string;
  accuracy: string;
  count: number;
  itemIds: string[];
  environments: string[];
}

/**
 * Collapse the catalog into globe markers. Items sharing a place key become one
 * marker; items with no coordinates are deliberately absent rather than dropped
 * somewhere plausible.
 */
export function globePoints(items: FrontierMediaItem[], channel: FrontierChannel = 'everything'): GlobePoint[] {
  const byKey = new Map<string, GlobePoint>();
  for (const item of items) {
    if (!inChannel(item, channel)) continue;
    const loc = item.location;
    if (!loc || !isPlottable(loc)) continue;
    const key = placeKey(loc);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.itemIds.push(item.id);
      if (!existing.environments.includes(item.environment)) existing.environments.push(item.environment);
      continue;
    }
    byKey.set(key, {
      key,
      latitude: loc.latitude,
      longitude: loc.longitude,
      displayName: loc.displayName || loc.regionName || 'Unnamed location',
      accuracy: loc.accuracy,
      count: 1,
      itemIds: [item.id],
      environments: [item.environment],
    });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count);
}

/** Off-Earth items, grouped for the space scenes rather than the Earth globe. */
export function offEarthGroups(items: FrontierMediaItem[]): Array<{ key: string; label: string; itemIds: string[] }> {
  const groups = new Map<string, { key: string; label: string; itemIds: string[] }>();
  for (const item of items) {
    const loc = item.location;
    if (!loc) continue;
    const body = loc.celestialBody;
    const off = loc.type === 'earth_orbit' || loc.type === 'moon' || loc.type === 'mars' || loc.type === 'deep_space';
    if (!off) continue;
    const key = `${loc.type}:${body || 'other'}`;
    const g = groups.get(key) || { key, label: loc.regionName || loc.displayName || 'Beyond Earth', itemIds: [] };
    g.itemIds.push(item.id);
    groups.set(key, g);
  }
  return [...groups.values()];
}
