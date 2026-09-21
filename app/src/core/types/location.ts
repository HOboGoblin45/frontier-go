/**
 * Geography is a product primitive here, so the honesty rule matters more than
 * the precision: an item that only knows which ocean basin it came from says
 * exactly that. `accuracy` drives presentation everywhere — the globe, the
 * overlay, the information sheet — so an approximate point can never be shown
 * as a survey mark.
 */

export type FrontierLocationType =
  | 'earth_surface'
  | 'underwater'
  | 'earth_orbit'
  | 'moon'
  | 'mars'
  | 'deep_space'
  | 'regional'
  | 'mission'
  | 'unknown';

export type FrontierCelestialBody = 'earth' | 'moon' | 'mars' | 'other';

export type FrontierLocationAccuracy =
  | 'exact'       // surveyed coordinates for this footage
  | 'approximate' // a point within the operating area
  | 'region'      // a published reference point for a named region
  | 'mission'     // no point; the mission itself is the location
  | 'unknown';

export interface FrontierLocation {
  type: FrontierLocationType;
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  depthMeters?: number;
  celestialBody?: FrontierCelestialBody;
  displayName?: string;
  regionName?: string;
  accuracy: FrontierLocationAccuracy;
  /** Where the coordinates came from. Present whenever lat/lon are present. */
  coordinateSource?: string;
}

export const UNKNOWN_LOCATION: FrontierLocation = Object.freeze({
  type: 'unknown',
  accuracy: 'unknown',
});

/** True when the item can be pinned on the globe at all. */
export function isPlottable(loc: FrontierLocation | undefined): loc is FrontierLocation & {
  latitude: number; longitude: number;
} {
  return !!loc
    && typeof loc.latitude === 'number'
    && typeof loc.longitude === 'number'
    && Number.isFinite(loc.latitude)
    && Number.isFinite(loc.longitude)
    && Math.abs(loc.latitude) <= 90
    && Math.abs(loc.longitude) <= 180;
}

/** Off-Earth items get a scene of their own rather than a pin on the globe. */
export function isOffEarth(loc: FrontierLocation | undefined): boolean {
  if (!loc) return false;
  if (loc.type === 'earth_orbit' || loc.type === 'moon' || loc.type === 'mars' || loc.type === 'deep_space') return true;
  return !!loc.celestialBody && loc.celestialBody !== 'earth';
}

function formatMetres(m: number): string {
  return `${Math.round(m).toLocaleString('en-US')} m`;
}

/**
 * The one-line place label used on the Watch overlay. Reflects accuracy
 * honestly: a region-level fix never reads like a survey point.
 */
export function locationHeadline(loc: FrontierLocation | undefined): string {
  if (!loc || loc.type === 'unknown') return 'Location not recorded';
  const name = loc.displayName || loc.regionName;
  const parts: string[] = [];
  if (name) parts.push(name);

  if (typeof loc.depthMeters === 'number' && loc.depthMeters > 0) {
    parts.push(`${formatMetres(loc.depthMeters)} below sea level`);
  } else if (typeof loc.altitudeMeters === 'number' && loc.altitudeMeters > 0) {
    const km = loc.altitudeMeters / 1000;
    parts.push(km >= 10 ? `~${Math.round(km).toLocaleString('en-US')} km altitude` : `${formatMetres(loc.altitudeMeters)} altitude`);
  }

  if (parts.length === 0) return 'Location not recorded';
  return parts.join(' · ');
}

/** Qualifier shown beneath the headline when the fix is not exact. */
export function accuracyNote(loc: FrontierLocation | undefined): string | null {
  if (!loc) return null;
  switch (loc.accuracy) {
    case 'exact': return null;
    case 'approximate': return 'Approximate position';
    case 'region': return 'Region reference point';
    case 'mission': return 'Mission location';
    default: return 'Position not recorded';
  }
}

/** The environment used for contrast scoring in the shuffle engine. */
export type FrontierEnvironment =
  | 'deep_ocean'
  | 'shallow_ocean'
  | 'surface_vessel'
  | 'polar'
  | 'volcanic'
  | 'wilderness'
  | 'orbit'
  | 'lunar'
  | 'martian'
  | 'deep_space'
  | 'laboratory'
  | 'unknown';
