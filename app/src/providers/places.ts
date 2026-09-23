import type { FrontierLocation } from '../core/types/location';
import { haversineKm } from '../core/util/geo';

/**
 * Resolve a provider's place NAMES to a reference point, honestly.
 *
 * Some catalogs (the Library of Congress film catalog is the model) publish
 * where a film was made as a list of names - "san diego, california", "new
 * york harbor, new jersey, new york" - and no coordinates. This turns those
 * names into the Natural Earth label point for the most specific place the
 * names agree on, and says so: accuracy 'region', a coordinateSource naming
 * the gazetteer feature, and the words "reference point, not the filming
 * position". When the names disagree (a film shot in four states), or name
 * nothing the gazetteer knows, the answer is no point at all.
 *
 * The gazetteer file is built by tools/places/build.ts from Natural Earth,
 * which is public domain.
 */

export interface Gazetteer {
  source: string;
  /** [name, admin1, country, lat, lon, population] */
  cities: Array<[string, string, string, number, number, number]>;
  /** [name, country, lat, lon] */
  admin1: Array<[string, string, number, number]>;
  /** [name, lat, lon, iso_a2] */
  countries: Array<[string, number, number, string]>;
}

interface City { name: string; admin1: string; country: string; lat: number; lon: number; pop: number }
interface Admin1 { name: string; country: string; lat: number; lon: number }
interface Country { name: string; lat: number; lon: number }

export function normalizePlaceName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bst\.?\s/g, 'saint ')
    .replace(/\bft\.?\s/g, 'fort ')
    .replace(/\bmt\.?\s/g, 'mount ')
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Names providers use that the gazetteer spells differently. */
const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'united states of america',
  usa: 'united states of america',
  'u s': 'united states of america',
  us: 'united states of america',
  america: 'united states of america',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  'great britain': 'united kingdom',
  britain: 'united kingdom',
  'northern ireland': 'united kingdom',
  russia: 'russia',
  'soviet union': 'russia',
  holland: 'netherlands',
  burma: 'myanmar',
  'czech republic': 'czechia',
};

const CITY_ALIASES: Record<string, string> = {
  'washington d c': 'washington dc',
  'district of columbia': 'washington dc',
  'new york city': 'new york',
  'new york n y': 'new york',
};

/**
 * Countries so large that their label point says nothing about where a film
 * was made. A film filed only under one of these gets no pin.
 */
const TOO_LARGE_FOR_A_POINT = new Set([
  'united states of america', 'canada', 'russia', 'china', 'brazil', 'australia',
  'india', 'argentina', 'kazakhstan', 'algeria', 'antarctica', 'greenland',
]);

/** Two resolved places further apart than this are two places, not one. */
const AGREEMENT_KM = 150;

export class PlaceResolver {
  private readonly cities = new Map<string, City[]>();
  private readonly admin1 = new Map<string, Admin1[]>();
  private readonly countries = new Map<string, Country>();
  readonly source: string;

  constructor(g: Gazetteer) {
    this.source = g.source;
    for (const [name, admin1, country, lat, lon, pop] of g.cities) {
      const key = normalizePlaceName(name);
      const list = this.cities.get(key) || [];
      list.push({ name: name.replace(/\s+/g, ' ').trim(), admin1, country, lat, lon, pop });
      this.cities.set(key, list);
    }
    for (const [name, country, lat, lon] of g.admin1) {
      const key = normalizePlaceName(name);
      const list = this.admin1.get(key) || [];
      list.push({ name, country, lat, lon });
      this.admin1.set(key, list);
    }
    for (const [name, lat, lon] of g.countries) this.countries.set(normalizePlaceName(name), { name, lat, lon });
  }

  private country(term: string): Country | undefined {
    return this.countries.get(COUNTRY_ALIASES[term] ?? term);
  }

  /**
   * The location a list of names supports, or null when it supports none.
   * `type` is what the caller knows about the footage (surface or underwater).
   */
  resolve(names: readonly string[], type: FrontierLocation['type'] = 'earth_surface'): FrontierLocation | null {
    const terms = [...new Set(names.map(normalizePlaceName).filter(Boolean))];
    if (terms.length === 0) return null;

    // "Georgia" is a state and a country. A catalog of American films means
    // the state unless another name says otherwise.
    const countryTerms = terms.filter((t) => {
      if (!this.country(t)) return false;
      const asAdmin = this.admin1.get(t) || [];
      if (asAdmin.length === 0) return true;
      const others = terms.filter((o) => o !== t).map((o) => this.country(o)?.name).filter(Boolean);
      if (others.length > 0) return !asAdmin.some((a) => others.includes(a.country));
      return !asAdmin.some((a) => a.country === 'United States of America');
    });
    const countries = countryTerms.map((t) => this.country(t)).filter((c): c is Country => !!c);
    const countryNames = new Set(countries.map((c) => normalizePlaceName(c.name)));
    const admins = terms.flatMap((t) => (this.admin1.get(t) || [])
      .filter((a) => countryNames.size === 0 || countryNames.has(normalizePlaceName(a.country))));
    // A state in one country and a named different country ("california, san
    // francisco, japan") is two stories. No point.
    if (countryNames.size > 0) {
      const foreign = terms.some((t) => {
        const asAdmin = this.admin1.get(t) || [];
        return asAdmin.length > 0 && !this.country(t)
          && !asAdmin.some((a) => countryNames.has(normalizePlaceName(a.country)));
      });
      if (foreign) return null;
    }
    const adminKeys = new Set(admins.map((a) => `${normalizePlaceName(a.name)}|${normalizePlaceName(a.country)}`));

    const inContext = (c: City) => {
      if (adminKeys.size > 0 && ![...adminKeys].some((k) => k.startsWith(`${normalizePlaceName(c.admin1)}|`))) {
        // A city named in a state the names also mention.
        return false;
      }
      if (countryNames.size > 0 && !countryNames.has(normalizePlaceName(c.country))) return false;
      return true;
    };

    const cities: City[] = [];
    for (const t of terms) {
      const key = CITY_ALIASES[t] ?? t;
      const all = this.cities.get(key) || [];
      // A name that is both a state and a large city in that state ("new
      // york", "washington" is not: its city is "washington d c") is the city.
      const matching = all.filter(inContext).sort((a, b) => b.pop - a.pop);
      if (matching.length === 0) continue;
      const [best, next] = matching;
      const hasContext = adminKeys.size > 0 || countryNames.size > 0;
      const alsoAdmin = (this.admin1.get(t) || []).some((a) => normalizePlaceName(a.country) === normalizePlaceName(best.country));
      if (alsoAdmin && !(best.pop >= 1_000_000 && normalizePlaceName(best.admin1) === t)) continue;
      // Without a state or country to pin it down, a name shared by several
      // towns resolves only when one of them dwarfs the rest.
      if (!hasContext && next && best.pop < next.pop * 5) continue;
      cities.push(best);
    }

    if (cities.length > 0) {
      const agree = cities.every((c) => haversineKm(c.lat, c.lon, cities[0].lat, cities[0].lon) <= AGREEMENT_KM);
      if (agree) {
        const c = cities.reduce((a, b) => (b.pop > a.pop ? b : a));
        const us = normalizePlaceName(c.country) === 'united states of america';
        const displayName = us && c.admin1 && normalizePlaceName(c.admin1) !== normalizePlaceName(c.name)
          && !/d\.?\s?c\.?$/i.test(c.name)
          ? `${c.name}, ${c.admin1}` : c.name;
        return {
          type,
          celestialBody: 'earth',
          latitude: c.lat,
          longitude: c.lon,
          displayName,
          regionName: us ? c.admin1 : c.country,
          accuracy: 'region',
          coordinateSource: `Natural Earth populated place "${c.name}" (${c.country}): a reference point for the place, not the filming position`,
        };
      }
    }

    const distinctAdmins = new Map(admins.map((a) => [`${a.name}|${a.country}`, a]));
    if (distinctAdmins.size === 1 && cities.length === 0) {
      const a = [...distinctAdmins.values()][0];
      return {
        type,
        celestialBody: 'earth',
        latitude: a.lat,
        longitude: a.lon,
        displayName: a.name,
        regionName: a.country === 'United States of America' ? 'United States' : a.country,
        accuracy: 'region',
        coordinateSource: `Natural Earth admin-1 label point for ${a.name} (${a.country}): a reference point, not the filming position`,
      };
    }
    // Cities that disagree but share one state: the state.
    if (cities.length > 1) {
      const states = new Set(cities.map((c) => `${c.admin1}|${c.country}`));
      if (states.size === 1) {
        const [admin, country] = [...states][0].split('|');
        const a = (this.admin1.get(normalizePlaceName(admin)) || []).find((x) => x.country === country);
        if (a) {
          return {
            type, celestialBody: 'earth', latitude: a.lat, longitude: a.lon,
            displayName: a.name, regionName: country === 'United States of America' ? 'United States' : country,
            accuracy: 'region',
            coordinateSource: `Natural Earth admin-1 label point for ${a.name} (${country}): a reference point, not the filming position`,
          };
        }
      }
      return null;
    }

    const distinctCountries = new Map(countries.map((c) => [c.name, c]));
    if (distinctCountries.size === 1 && distinctAdmins.size === 0) {
      const c = [...distinctCountries.values()][0];
      if (TOO_LARGE_FOR_A_POINT.has(normalizePlaceName(c.name))) return null;
      return {
        type,
        celestialBody: 'earth',
        latitude: c.lat,
        longitude: c.lon,
        displayName: c.name,
        regionName: c.name,
        accuracy: 'region',
        coordinateSource: `Natural Earth country label point for ${c.name}: a reference point, not the filming position`,
      };
    }
    return null;
  }
}
