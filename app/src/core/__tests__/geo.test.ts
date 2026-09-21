import { describe, it, expect } from 'vitest';
import { haversineKm, locationSeparation, placeKey, latLonToUnitVector, MAX_SURFACE_KM } from '../util/geo';
import { locationHeadline, accuracyNote, isPlottable, isOffEarth, UNKNOWN_LOCATION } from '../types/location';
import type { FrontierLocation } from '../types/location';

const pacific: FrontierLocation = { type: 'underwater', latitude: 0, longitude: -160, accuracy: 'region', displayName: 'Pacific Ocean', regionName: 'Pacific Ocean', depthMeters: 3814 };
const atlantic: FrontierLocation = { type: 'underwater', latitude: 0, longitude: -25, accuracy: 'region', displayName: 'Atlantic Ocean', regionName: 'Atlantic Ocean' };
const orbit: FrontierLocation = { type: 'earth_orbit', accuracy: 'mission', altitudeMeters: 408000, displayName: 'Low Earth Orbit', regionName: 'International Space Station', celestialBody: 'earth' };
const moon: FrontierLocation = { type: 'moon', accuracy: 'mission', displayName: 'Taurus-Littrow Valley', regionName: 'Apollo 17', celestialBody: 'moon' };

describe('distance', () => {
  it('measures a known separation', () => {
    // 1 degree of latitude on the equator is about 111 km.
    expect(haversineKm(0, 0, 1, 0)).toBeGreaterThan(110);
    expect(haversineKm(0, 0, 1, 0)).toBeLessThan(112);
  });

  it('is zero for the same point', () => {
    expect(haversineKm(36.6, -122, 36.6, -122)).toBeCloseTo(0, 6);
  });

  it('caps at half the circumference for antipodes', () => {
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(MAX_SURFACE_KM, 0);
  });
});

describe('separation for the shuffle engine', () => {
  it('scores a surface jump between 0 and 1', () => {
    const s = locationSeparation(pacific, atlantic);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it('scores Earth to orbit as maximal', () => {
    expect(locationSeparation(pacific, orbit)).toBe(1);
  });

  it('scores two different off-Earth bodies as maximal and the same body as close', () => {
    expect(locationSeparation(orbit, moon)).toBe(1);
    expect(locationSeparation(moon, { ...moon, displayName: 'Hadley-Apennine' })).toBe(0.25);
  });

  it('returns a neutral score rather than a fabricated one when coordinates are missing', () => {
    expect(locationSeparation(undefined, pacific)).toBe(0.5);
    expect(locationSeparation(UNKNOWN_LOCATION, UNKNOWN_LOCATION)).toBe(0.5);
  });
});

describe('place keys', () => {
  it('collapses nearby points into one place', () => {
    expect(placeKey({ ...pacific, latitude: 0.02, longitude: -160.03 })).toBe(placeKey(pacific));
  });

  it('keys a place by its display name when it has no coordinates', () => {
    expect(placeKey(orbit)).toBe('name:low-earth-orbit');
  });

  it('returns nothing for an unknown location', () => {
    expect(placeKey(UNKNOWN_LOCATION)).toBeUndefined();
  });
});

describe('honesty of presentation', () => {
  it('states depth in the headline', () => {
    expect(locationHeadline(pacific)).toBe('Pacific Ocean · 3,814 m below sea level');
  });

  it('states orbital altitude in kilometres', () => {
    expect(locationHeadline(orbit)).toBe('Low Earth Orbit · ~408 km altitude');
  });

  it('says so plainly when nothing was recorded', () => {
    expect(locationHeadline(UNKNOWN_LOCATION)).toBe('Location not recorded');
    expect(accuracyNote(UNKNOWN_LOCATION)).toBe('Position not recorded');
  });

  it('qualifies anything that is not a surveyed position', () => {
    expect(accuracyNote(pacific)).toBe('Region reference point');
    expect(accuracyNote({ ...pacific, accuracy: 'approximate' })).toBe('Approximate position');
    expect(accuracyNote({ ...pacific, accuracy: 'exact' })).toBeNull();
  });

  it('does not plot a location with no coordinates', () => {
    expect(isPlottable(orbit)).toBe(false);
    expect(isPlottable(pacific)).toBe(true);
    expect(isPlottable({ ...pacific, latitude: 120 })).toBe(false);
  });

  it('keeps off-Earth places off the Earth globe', () => {
    expect(isOffEarth(moon)).toBe(true);
    expect(isOffEarth(orbit)).toBe(true);
    expect(isOffEarth(pacific)).toBe(false);
  });
});

describe('projection', () => {
  it('puts the north pole at the top of the sphere', () => {
    const [, y] = latLonToUnitVector(90, 0);
    expect(y).toBeCloseTo(1, 6);
  });

  it('produces unit vectors', () => {
    const [x, y, z] = latLonToUnitVector(36.6, -122);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });
});
