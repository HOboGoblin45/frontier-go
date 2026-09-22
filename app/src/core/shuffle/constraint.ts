import type { FrontierMediaItem } from '../types/media';
import type { FrontierLocation } from '../types/location';
import { isPlottable } from '../types/location';
import { haversineKm } from '../util/geo';

/**
 * "Keep Exploring Here" — a temporary narrowing of the shuffle universe, not a
 * filter interface. One value, one label, one way out ("Go Anywhere").
 */

export type ConstraintKind = 'expedition' | 'mission' | 'region' | 'nearby' | 'environment' | 'tag' | 'collection';

export interface ExplorationConstraint {
  kind: ConstraintKind;
  /** Shown verbatim in the UI: "Keep exploring EX2605". */
  label: string;
  value: string;
  radiusKm?: number;
  origin?: FrontierLocation;
  /**
   * For a collection: the exact membership. A collection is chosen, so it
   * supersedes the channel - opening "Octopus and squid" while the channel is
   * Space should play octopus, not nothing.
   */
  memberIds?: ReadonlySet<string>;
}

export const DEFAULT_NEARBY_RADIUS_KM = 400;

/**
 * Derive the most specific honest constraint available for an item. Prefers the
 * expedition or mission (a real, named operation) over a coordinate radius,
 * because "this expedition" is something the viewer can understand and the
 * metadata actually asserts.
 */
export function constraintForItem(item: FrontierMediaItem): ExplorationConstraint | null {
  const { source, location } = item;
  if (source.expedition) {
    return { kind: 'expedition', label: source.expedition, value: source.expedition };
  }
  if (source.mission) {
    return { kind: 'mission', label: source.mission, value: source.mission };
  }
  if (location && isPlottable(location) && location.accuracy !== 'region') {
    return {
      kind: 'nearby',
      label: location.displayName || location.regionName || 'this area',
      value: `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`,
      radiusKm: DEFAULT_NEARBY_RADIUS_KM,
      origin: location,
    };
  }
  if (location?.regionName) {
    return { kind: 'region', label: location.regionName, value: location.regionName };
  }
  if (item.environment && item.environment !== 'unknown') {
    return { kind: 'environment', label: environmentLabel(item.environment), value: item.environment };
  }
  if (item.tags.length > 0) {
    return { kind: 'tag', label: item.tags[0], value: item.tags[0] };
  }
  return null;
}

export function matchesConstraint(item: FrontierMediaItem, c: ExplorationConstraint | null | undefined): boolean {
  if (!c) return true;
  switch (c.kind) {
    case 'expedition': return item.source.expedition === c.value;
    case 'mission': return item.source.mission === c.value;
    case 'region': return item.location?.regionName === c.value;
    case 'environment': return item.environment === c.value;
    case 'tag': return item.tags.includes(c.value);
    case 'collection': return c.memberIds?.has(item.id) ?? false;
    case 'nearby': {
      const o = c.origin;
      const l = item.location;
      if (!o || !isPlottable(o) || !l || !isPlottable(l)) return false;
      return haversineKm(o.latitude, o.longitude, l.latitude, l.longitude) <= (c.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM);
    }
    default: return true;
  }
}

export function environmentLabel(env: string): string {
  switch (env) {
    case 'deep_ocean': return 'the deep ocean';
    case 'shallow_ocean': return 'coastal waters';
    case 'surface_vessel': return 'research vessels';
    case 'polar': return 'the polar regions';
    case 'volcanic': return 'volcanic terrain';
    case 'wilderness': return 'wild places';
    case 'orbit': return 'Earth orbit';
    case 'lunar': return 'the Moon';
    case 'martian': return 'Mars';
    case 'deep_space': return 'deep space';
    case 'laboratory': return 'the lab';
    case 'launch_site': return 'the pad';
    default: return 'here';
  }
}
