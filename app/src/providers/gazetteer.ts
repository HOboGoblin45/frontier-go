import type { FrontierLocation } from '../core/types/location';

/**
 * Region reference points.
 *
 * None of these is a position for any particular piece of footage, and none is
 * presented as one: every entry resolves to `accuracy: 'region'` (or
 * 'approximate' for a fixed facility) and carries the basis for the number.
 * This file exists so the globe can put an expedition somewhere truthful when
 * the provider publishes a named operating area and no coordinates — which is
 * the normal case. An expedition whose region is not listed here gets no point
 * at all rather than a guessed one.
 */

export interface GazetteerEntry {
  /** Lower-case substrings matched against provider titles and taxonomies. */
  match: string[];
  displayName: string;
  regionName: string;
  latitude?: number;
  longitude?: number;
  /** What the coordinate actually is. Shown nowhere; kept for review. */
  basis: string;
  accuracy: FrontierLocation['accuracy'];
  type: FrontierLocation['type'];
  celestialBody?: FrontierLocation['celestialBody'];
  altitudeMeters?: number;
}

/** Ocean basins, keyed to NOAA Ocean Exploration's own `location` taxonomy. */
export const OCEAN_BASINS: Record<string, GazetteerEntry> = {
  'pacific ocean': {
    match: ['pacific ocean'],
    displayName: 'Pacific Ocean', regionName: 'Pacific Ocean',
    latitude: 0, longitude: -160,
    basis: 'Central Pacific basin reference point (equator, 160 W)',
    accuracy: 'region', type: 'underwater',
  },
  'atlantic ocean': {
    match: ['atlantic ocean'],
    displayName: 'Atlantic Ocean', regionName: 'Atlantic Ocean',
    latitude: 0, longitude: -25,
    basis: 'Central Atlantic basin reference point (equator, 25 W)',
    accuracy: 'region', type: 'underwater',
  },
  arctic: {
    match: ['arctic'],
    displayName: 'Arctic Ocean', regionName: 'Arctic Ocean',
    latitude: 85, longitude: 0,
    basis: 'High-Arctic basin reference point (85 N)',
    accuracy: 'region', type: 'underwater',
  },
  'great lakes': {
    match: ['great lakes'],
    displayName: 'Great Lakes', regionName: 'Great Lakes',
    latitude: 45.5, longitude: -84.5,
    basis: 'Straits of Mackinac, centre of the Great Lakes system',
    accuracy: 'region', type: 'underwater',
  },
  'gulf of mexico/caribbean': {
    match: ['gulf of mexico/caribbean', 'gulf of america/caribbean'],
    displayName: 'Gulf and Caribbean', regionName: 'Gulf and Caribbean',
    latitude: 21.5, longitude: -84,
    basis: 'Between the Gulf basin and the Caribbean Sea',
    accuracy: 'region', type: 'underwater',
  },
};

/**
 * Named operating areas that appear in expedition titles. Each coordinate is a
 * published reference point for the named place, never for a dive.
 */
export const NAMED_REGIONS: GazetteerEntry[] = [
  { match: ['cook islands'], displayName: 'Cook Islands', regionName: 'Cook Islands', latitude: -20.0, longitude: -158.0, basis: 'Centre of the Cook Islands archipelago', accuracy: 'region', type: 'underwater' },
  { match: ['american samoa', 'samoa'], displayName: 'American Samoa', regionName: 'American Samoa', latitude: -14.3, longitude: -170.7, basis: 'Tutuila, American Samoa', accuracy: 'region', type: 'underwater' },
  { match: ['papahanaumokuakea', 'papahānaumokuākea', 'northwestern hawaiian'], displayName: 'Papahanaumokuakea', regionName: 'Northwestern Hawaiian Islands', latitude: 25.0, longitude: -170.0, basis: 'Centre of the Northwestern Hawaiian Islands chain', accuracy: 'region', type: 'underwater' },
  { match: ['hawaii', 'hawaiian'], displayName: 'Hawaiian Islands', regionName: 'Hawaiian Islands', latitude: 20.8, longitude: -156.3, basis: 'Centre of the main Hawaiian Islands', accuracy: 'region', type: 'underwater' },
  { match: ['mariana', 'marianas'], displayName: 'Mariana Region', regionName: 'Mariana Region', latitude: 17.0, longitude: 145.0, basis: 'Mariana Arc, western Pacific', accuracy: 'region', type: 'underwater' },
  { match: ['gulf of alaska'], displayName: 'Gulf of Alaska', regionName: 'Gulf of Alaska', latitude: 57.0, longitude: -146.0, basis: 'Central Gulf of Alaska', accuracy: 'region', type: 'underwater' },
  { match: ['aleutian'], displayName: 'Aleutian Islands', regionName: 'Aleutian Islands', latitude: 52.0, longitude: -175.0, basis: 'Central Aleutian chain', accuracy: 'region', type: 'underwater' },
  { match: ['bering'], displayName: 'Bering Sea', regionName: 'Bering Sea', latitude: 58.0, longitude: -178.0, basis: 'Central Bering Sea', accuracy: 'region', type: 'underwater' },
  { match: ['chukchi'], displayName: 'Chukchi Sea', regionName: 'Chukchi Sea', latitude: 71.0, longitude: -167.0, basis: 'Central Chukchi Sea', accuracy: 'region', type: 'underwater' },
  { match: ['beaufort'], displayName: 'Beaufort Sea', regionName: 'Beaufort Sea', latitude: 72.0, longitude: -140.0, basis: 'Central Beaufort Sea', accuracy: 'region', type: 'underwater' },
  { match: ['puerto rico'], displayName: 'Puerto Rico Trench', regionName: 'Puerto Rico', latitude: 19.5, longitude: -66.0, basis: 'Puerto Rico Trench, north of the island', accuracy: 'region', type: 'underwater' },
  { match: ['blake plateau'], displayName: 'Blake Plateau', regionName: 'Blake Plateau', latitude: 31.0, longitude: -78.5, basis: 'Blake Plateau, US South Atlantic Bight', accuracy: 'region', type: 'underwater' },
  { match: ['monterey'], displayName: 'Monterey Canyon', regionName: 'Monterey Bay', latitude: 36.6, longitude: -122.0, basis: 'Monterey Canyon, central California', accuracy: 'region', type: 'underwater' },
  { match: ['gulf of maine'], displayName: 'Gulf of Maine', regionName: 'Gulf of Maine', latitude: 43.0, longitude: -68.5, basis: 'Central Gulf of Maine', accuracy: 'region', type: 'underwater' },
  { match: ['new england seamount'], displayName: 'New England Seamounts', regionName: 'New England Seamounts', latitude: 39.5, longitude: -66.0, basis: 'New England Seamount chain', accuracy: 'region', type: 'underwater' },
  { match: ['wisconsin shipwreck', 'lake michigan'], displayName: 'Lake Michigan', regionName: 'Wisconsin Shipwreck Coast', latitude: 43.9, longitude: -87.5, basis: 'Wisconsin Shipwreck Coast National Marine Sanctuary, Lake Michigan', accuracy: 'region', type: 'underwater' },
  { match: ['thunder bay', 'lake huron'], displayName: 'Lake Huron', regionName: 'Thunder Bay', latitude: 45.0, longitude: -83.2, basis: 'Thunder Bay National Marine Sanctuary, Lake Huron', accuracy: 'region', type: 'underwater' },
  { match: ['lake ontario'], displayName: 'Lake Ontario', regionName: 'Lake Ontario', latitude: 43.7, longitude: -77.8, basis: 'Central Lake Ontario', accuracy: 'region', type: 'underwater' },
  { match: ['lake superior'], displayName: 'Lake Superior', regionName: 'Lake Superior', latitude: 47.7, longitude: -87.5, basis: 'Central Lake Superior', accuracy: 'region', type: 'underwater' },
  { match: ['lake erie'], displayName: 'Lake Erie', regionName: 'Lake Erie', latitude: 42.2, longitude: -81.2, basis: 'Central Lake Erie', accuracy: 'region', type: 'underwater' },
  { match: ['galapagos', 'galápagos'], displayName: 'Galapagos', regionName: 'Galapagos', latitude: -0.5, longitude: -90.5, basis: 'Galapagos Archipelago', accuracy: 'region', type: 'underwater' },
  { match: ['azores'], displayName: 'Azores', regionName: 'Azores', latitude: 38.5, longitude: -28.0, basis: 'Azores archipelago, North Atlantic', accuracy: 'region', type: 'underwater' },
  { match: ['mid-atlantic ridge'], displayName: 'Mid-Atlantic Ridge', regionName: 'Mid-Atlantic Ridge', latitude: 30.0, longitude: -42.0, basis: 'Mid-Atlantic Ridge, North Atlantic segment', accuracy: 'region', type: 'underwater' },
  { match: ['florida keys', 'straits of florida'], displayName: 'Florida Keys', regionName: 'Florida Keys', latitude: 24.6, longitude: -81.5, basis: 'Florida Keys, Straits of Florida', accuracy: 'region', type: 'underwater' },
  { match: ['west florida', 'florida escarpment'], displayName: 'West Florida Escarpment', regionName: 'West Florida Escarpment', latitude: 26.0, longitude: -85.0, basis: 'West Florida Escarpment, eastern Gulf', accuracy: 'region', type: 'underwater' },
  { match: ['caribbean'], displayName: 'Caribbean Sea', regionName: 'Caribbean Sea', latitude: 15.0, longitude: -75.0, basis: 'Central Caribbean Sea', accuracy: 'region', type: 'underwater' },
  { match: ['gulf of mexico', 'gulf of america'], displayName: 'Gulf of Mexico', regionName: 'Gulf of Mexico', latitude: 25.0, longitude: -90.0, basis: 'Central Gulf basin', accuracy: 'region', type: 'underwater' },
  { match: ['aleutian arc', 'ring of fire'], displayName: 'North Pacific', regionName: 'North Pacific', latitude: 50.0, longitude: -170.0, basis: 'North Pacific reference point', accuracy: 'region', type: 'underwater' },
  { match: ['johnston atoll', 'pacific remote islands'], displayName: 'Pacific Remote Islands', regionName: 'Pacific Remote Islands', latitude: 8.0, longitude: -170.0, basis: 'Pacific Remote Islands Marine National Monument', accuracy: 'region', type: 'underwater' },
  { match: ['howland', 'baker island'], displayName: 'Howland and Baker', regionName: 'Howland and Baker Islands', latitude: 0.5, longitude: -176.5, basis: 'Howland and Baker Islands, central Pacific', accuracy: 'region', type: 'underwater' },
  { match: ['phoenix islands'], displayName: 'Phoenix Islands', regionName: 'Phoenix Islands', latitude: -3.7, longitude: -172.0, basis: 'Phoenix Islands, central Pacific', accuracy: 'region', type: 'underwater' },
  { match: ['okeanos'], displayName: 'Okeanos Explorer operating area', regionName: 'Okeanos Explorer', latitude: undefined, longitude: undefined, basis: 'No published operating area in the metadata', accuracy: 'mission', type: 'mission' },
];

/** Fixed NASA facilities. Published site locations, hence 'approximate'. */
export const NASA_FACILITIES: GazetteerEntry[] = [
  { match: ['kennedy space center', 'launch complex 39', 'cape canaveral'], displayName: 'Kennedy Space Center', regionName: 'Florida', latitude: 28.5729, longitude: -80.6490, basis: 'Kennedy Space Center, Merritt Island, Florida', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['stennis', 'green run', 'rs-25 engine test'], displayName: 'Stennis Space Center', regionName: 'Mississippi', latitude: 30.3628, longitude: -89.6006, basis: 'Stennis Space Center, Hancock County, Mississippi', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['marshall space flight'], displayName: 'Marshall Space Flight Center', regionName: 'Alabama', latitude: 34.6420, longitude: -86.6656, basis: 'Marshall Space Flight Center, Huntsville, Alabama', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['johnson space center'], displayName: 'Johnson Space Center', regionName: 'Texas', latitude: 29.5583, longitude: -95.0900, basis: 'Johnson Space Center, Houston, Texas', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['jet propulsion laboratory'], displayName: 'Jet Propulsion Laboratory', regionName: 'California', latitude: 34.2013, longitude: -118.1714, basis: 'Jet Propulsion Laboratory, Pasadena, California', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['wallops'], displayName: 'Wallops Flight Facility', regionName: 'Virginia', latitude: 37.9401, longitude: -75.4664, basis: 'Wallops Flight Facility, Virginia', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['armstrong flight research', 'edwards air force'], displayName: 'Armstrong Flight Research Center', regionName: 'California', latitude: 34.9055, longitude: -117.8839, basis: 'Armstrong Flight Research Center, Edwards, California', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['goddard space flight'], displayName: 'Goddard Space Flight Center', regionName: 'Maryland', latitude: 38.9967, longitude: -76.8483, basis: 'Goddard Space Flight Center, Greenbelt, Maryland', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['langley research'], displayName: 'Langley Research Center', regionName: 'Virginia', latitude: 37.0862, longitude: -76.3800, basis: 'Langley Research Center, Hampton, Virginia', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['glenn research'], displayName: 'Glenn Research Center', regionName: 'Ohio', latitude: 41.4150, longitude: -81.8614, basis: 'Glenn Research Center, Cleveland, Ohio', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['ames research'], displayName: 'Ames Research Center', regionName: 'California', latitude: 37.4143, longitude: -122.0640, basis: 'Ames Research Center, Moffett Field, California', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['michoud'], displayName: 'Michoud Assembly Facility', regionName: 'Louisiana', latitude: 29.9950, longitude: -89.9200, basis: 'Michoud Assembly Facility, New Orleans, Louisiana', accuracy: 'approximate', type: 'earth_surface' },
  { match: ['mcmurdo', 'antarctic', 'antarctica'], displayName: 'Antarctica', regionName: 'Antarctica', latitude: -77.85, longitude: 166.67, basis: 'McMurdo Station, Ross Island, Antarctica', accuracy: 'region', type: 'earth_surface' },
  { match: ['greenland'], displayName: 'Greenland', regionName: 'Greenland', latitude: 72.0, longitude: -40.0, basis: 'Greenland ice sheet interior', accuracy: 'region', type: 'earth_surface' },
];

/** Off-Earth places. No latitude/longitude is emitted onto the Earth globe. */
export const OFF_EARTH: GazetteerEntry[] = [
  { match: ['international space station', 'iss', 'spacewalk', 'eva', 'expedition 7', 'expedition 6', 'cupola'], displayName: 'Low Earth Orbit', regionName: 'International Space Station', basis: 'ISS mean orbital altitude, approximately 408 km', accuracy: 'mission', type: 'earth_orbit', celestialBody: 'earth', altitudeMeters: 408000 },
  { match: ['apollo 11'], displayName: 'Sea of Tranquility', regionName: 'Apollo 11', basis: 'Apollo 11 landing site, Mare Tranquillitatis', accuracy: 'mission', type: 'moon', celestialBody: 'moon' },
  { match: ['apollo 17'], displayName: 'Taurus-Littrow Valley', regionName: 'Apollo 17', basis: 'Apollo 17 landing site, Taurus-Littrow', accuracy: 'mission', type: 'moon', celestialBody: 'moon' },
  { match: ['apollo 15'], displayName: 'Hadley-Apennine', regionName: 'Apollo 15', basis: 'Apollo 15 landing site, Hadley Rille', accuracy: 'mission', type: 'moon', celestialBody: 'moon' },
  { match: ['apollo', 'artemis', 'lunar', 'moon landing'], displayName: 'The Moon', regionName: 'The Moon', basis: 'Lunar mission; no published site in the metadata', accuracy: 'mission', type: 'moon', celestialBody: 'moon' },
  { match: ['jezero'], displayName: 'Jezero Crater', regionName: 'Mars', basis: 'Perseverance landing site, Jezero Crater', accuracy: 'mission', type: 'mars', celestialBody: 'mars' },
  { match: ['gale crater'], displayName: 'Gale Crater', regionName: 'Mars', basis: 'Curiosity landing site, Gale Crater', accuracy: 'mission', type: 'mars', celestialBody: 'mars' },
  { match: ['perseverance', 'curiosity', 'ingenuity', 'mars'], displayName: 'Mars', regionName: 'Mars', basis: 'Mars surface mission; no published site in the metadata', accuracy: 'mission', type: 'mars', celestialBody: 'mars' },
  { match: ['voyager', 'new horizons', 'interstellar', 'deep space network'], displayName: 'Deep space', regionName: 'Deep space', basis: 'Deep-space mission; no surface location applies', accuracy: 'mission', type: 'deep_space', celestialBody: 'other' },
  { match: ['hubble', 'james webb', 'jwst', 'telescope'], displayName: 'Orbital observatory', regionName: 'Orbital observatory', basis: 'Space-based observatory; no surface location applies', accuracy: 'mission', type: 'deep_space', celestialBody: 'other' },
];

function toLocation(e: GazetteerEntry): FrontierLocation {
  return {
    type: e.type,
    latitude: e.latitude,
    longitude: e.longitude,
    altitudeMeters: e.altitudeMeters,
    celestialBody: e.celestialBody,
    displayName: e.displayName,
    regionName: e.regionName,
    accuracy: typeof e.latitude === 'number' ? e.accuracy : 'mission',
    coordinateSource: typeof e.latitude === 'number' ? e.basis : undefined,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whole-word matching, not substring matching.
 *
 * The first real ingest filed a Stennis engine test as "Low Earth Orbit"
 * because the token `iss` is inside the word `mission`. Short tokens are the
 * useful ones (ISS, EVA, JPL, KSC) and also the dangerous ones, so every match
 * is anchored to word boundaries rather than the short ones being dropped.
 */
const matcherCache = new Map<string, RegExp>();
function matcher(token: string): RegExp {
  let re = matcherCache.get(token);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapeRe(token)}([^a-z0-9]|$)`, 'i');
    matcherCache.set(token, re);
  }
  return re;
}

/**
 * The entry whose LONGEST ACTUALLY-MATCHING token is longest wins.
 *
 * Ranking entries by their longest declared token instead put any text
 * containing `mars` into Low Earth Orbit, because the ISS entry happened to
 * declare `international space station` and was therefore always tested first.
 * What matters is which token matched, not which token exists.
 */
function findIn(entries: GazetteerEntry[], haystack: string): FrontierLocation | null {
  const h = haystack.toLowerCase();
  let best: { entry: GazetteerEntry; len: number } | null = null;
  for (const e of entries) {
    let longest = 0;
    for (const token of e.match) {
      if (token.length > longest && matcher(token).test(h)) longest = token.length;
    }
    if (longest > 0 && (!best || longest > best.len)) best = { entry: e, len: longest };
  }
  return best ? toLocation(best.entry) : null;
}

export function lookupOffEarth(text: string): FrontierLocation | null {
  return findIn(OFF_EARTH, text);
}

export function lookupNamedRegion(text: string): FrontierLocation | null {
  return findIn(NAMED_REGIONS, text);
}

export function lookupNasaFacility(text: string): FrontierLocation | null {
  return findIn(NASA_FACILITIES, text);
}

export function lookupOceanBasin(taxonomyName: string): FrontierLocation | null {
  const key = taxonomyName.trim().toLowerCase();
  const direct = OCEAN_BASINS[key];
  if (direct) return toLocation(direct);
  return findIn(Object.values(OCEAN_BASINS), key);
}
