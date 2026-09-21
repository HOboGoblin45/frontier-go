import type { FrontierLocation } from '../types/location';
import { isPlottable, isOffEarth } from '../types/location';

export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Half the Earth's circumference — the largest possible surface separation. */
export const MAX_SURFACE_KM = Math.PI * EARTH_RADIUS_KM;

/**
 * Separation between two Frontier locations, normalised to 0..1.
 *
 * Anything off-Earth is treated as maximally distant from anything on Earth,
 * which is both true and exactly the jump the shuffle engine wants to reward.
 * Missing coordinates produce a neutral 0.5 rather than a fake 0 or 1.
 */
export function locationSeparation(
  a: FrontierLocation | undefined,
  b: FrontierLocation | undefined,
): number {
  if (!a || !b) return 0.5;

  const aOff = isOffEarth(a);
  const bOff = isOffEarth(b);
  if (aOff !== bOff) return 1;
  if (aOff && bOff) {
    const sameBody = (a.celestialBody || a.type) === (b.celestialBody || b.type);
    return sameBody ? 0.25 : 1;
  }

  if (!isPlottable(a) || !isPlottable(b)) {
    if (a.regionName && b.regionName) return a.regionName === b.regionName ? 0.15 : 0.7;
    return 0.5;
  }

  const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  return Math.min(1, km / MAX_SURFACE_KM);
}

/** Stable key so repeat visits to the same place collapse into one point. */
export function placeKey(loc: FrontierLocation | undefined): string | undefined {
  if (!loc || loc.type === 'unknown') return undefined;
  if (isPlottable(loc)) {
    // ~11 km grid. Finer than this would scatter one expedition across
    // several points on the globe for no informational gain.
    return `geo:${loc.latitude.toFixed(1)},${loc.longitude.toFixed(1)}`;
  }
  const name = loc.displayName || loc.regionName;
  if (name) return `name:${name.toLowerCase().replace(/\s+/g, '-')}`;
  return `type:${loc.type}`;
}

/** Latitude/longitude to a unit vector on a sphere (Three.js Y-up frame). */
export function latLonToUnitVector(latDeg: number, lonDeg: number): [number, number, number] {
  const phi = toRad(90 - latDeg);
  const theta = toRad(lonDeg + 180);
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}
