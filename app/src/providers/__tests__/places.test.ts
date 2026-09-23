import { describe, expect, it } from 'vitest';
import { normalizePlaceName, PlaceResolver, type Gazetteer } from '../places';

/** A slice of the Natural Earth gazetteer, with the real label points. */
const G: Gazetteer = {
  source: 'test',
  cities: [
    ['New York', 'New York', 'United States of America', 40.7519, -73.982, 19040000],
    ['Buffalo', 'New York', 'United States of America', 42.8819, -78.8819, 1016000],
    ['San Francisco', 'California', 'United States of America', 37.7407, -122.4598, 3450000],
    ['Washington,  D.C.', 'District of Columbia', 'United States of America', 38.9015, -77.0114, 4338000],
    ['London', 'Westminster', 'United Kingdom', 51.5019, -0.1187, 8567000],
    ['London', 'Ontario', 'Canada', 42.97, -81.25, 346765],
    ['London', 'Kentucky', 'United States of America', 37.1289, -84.0834, 7844],
    ['Plymouth', 'Massachusetts', 'United States of America', 41.9584, -70.6673, 7000],
    ['Marion', 'Ohio', 'United States of America', 40.5887, -83.1286, 37000],
    ['Havana', 'Ciudad de la Habana', 'Cuba', 23.1339, -82.3661, 2174000],
  ],
  admin1: [
    ['New York', 'United States of America', 43.1988, -75.3242],
    ['California', 'United States of America', 36.7496, -119.591],
    ['Georgia', 'United States of America', 32.8547, -83.4078],
    ['Washington', 'United States of America', 47.4865, -120.361],
    ['Massachusetts', 'United States of America', 42.3, -71.8],
    ['Ohio', 'United States of America', 40.3, -82.8],
    ['Hesse', 'Germany', 50.6, 9.0],
  ],
  countries: [
    ['United States of America', 39.5385, -97.4826, 'US'],
    ['United Kingdom', 54.0, -2.0, 'GB'],
    ['France', 46.6961, 2.5523, 'FR'],
    ['Georgia', 42.1685, 43.5085, 'GE'],
    ['Japan', 36.1425, 138.4422, 'JP'],
    ['Cuba', 21.3, -78.9, 'CU'],
  ],
};
const r = new PlaceResolver(G);

describe('PlaceResolver', () => {
  it('normalises the ways catalogs spell places', () => {
    expect(normalizePlaceName('St. Paul (Minn.)')).toBe('saint paul');
    expect(normalizePlaceName('Washington, D.C.')).toBe('washington dc');
  });

  it('resolves a city in the state the record also names', () => {
    const l = r.resolve(['california', 'san francisco'])!;
    expect(l.displayName).toBe('San Francisco, California');
    expect(l.latitude).toBeCloseTo(37.74, 2);
    expect(l.accuracy).toBe('region');
    expect(l.coordinateSource).toMatch(/Natural Earth populated place "San Francisco".*not the filming position/);
  });

  it('reads "new york" as the city, and "washington" as the state', () => {
    expect(r.resolve(['new york'])!.displayName).toBe('New York');
    expect(r.resolve(['new york'])!.latitude).toBeCloseTo(40.75, 2);
    expect(r.resolve(['washington'])!.coordinateSource).toMatch(/admin-1 label point for Washington/);
    expect(r.resolve(['washington d.c.'])!.displayName).toBe('Washington, D.C.');
  });

  it('reads "georgia" as the state in an American catalog, unless a name says otherwise', () => {
    expect(r.resolve(['georgia'])!.regionName).toBe('United States');
  });

  it('refuses a name shared by several towns with nothing to pick between them', () => {
    // London, England; London, Ontario; London, Kentucky. The biggest does
    // not win unless it dwarfs the rest - here it does, 8.5M to 347k.
    expect(r.resolve(['london'])!.regionName).toBe('United Kingdom');
    // With a context, the context wins.
    expect(r.resolve(['london', 'england'])!.displayName).toBe('London');
  });

  it('gives no point when the names disagree', () => {
    expect(r.resolve(['plymouth', 'massachusetts', 'marion', 'ohio'])).toBeNull();
    expect(r.resolve(['california', 'san francisco', 'japan'])).toBeNull();
  });

  it('gives no point for a country too large for its label point to mean anything', () => {
    expect(r.resolve(['united states'])).toBeNull();
    expect(r.resolve(['cuba'])!.displayName).toBe('Cuba');
  });

  it('falls back from an unknown town to its state or country', () => {
    expect(r.resolve(['new york', 'buffalo'])!.displayName).toMatch(/New York|Buffalo/);
    expect(r.resolve(['france', 'lourdes'])!.displayName).toBe('France');
    expect(r.resolve(['nowhere in particular'])).toBeNull();
    expect(r.resolve([])).toBeNull();
  });
});
