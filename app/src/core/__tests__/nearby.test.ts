import { describe, expect, it } from 'vitest';
import { itemsNear, matchesGlobeFilter, placeMatches, GLOBE_FILTERS } from '../catalog/nearby';
import { buildCollections, MIN_SITE_COLLECTION } from '../catalog/collections';
import { constraintForItem, matchesConstraint } from '../shuffle/constraint';
import { makeItem } from './fixtures';

const at = (id: string, latitude: number, longitude: number, extra = {}) => makeItem({
  id, location: { type: 'earth_surface', latitude, longitude, accuracy: 'region', displayName: `P${id}`, coordinateSource: 'test' }, ...extra,
});

describe('itemsNear', () => {
  const yellowstone = { latitude: 44.6, longitude: -110.5 };
  const pool = [
    at('far', 36.1, -112.1),          // Grand Canyon, ~960 km
    at('mid', 44.0, -110.7),          // ~70 km
    at('here', 44.6, -110.5),
    makeItem({ id: 'none', location: { type: 'unknown', accuracy: 'unknown' } }),
  ];

  it('lists what is here first, then nearby, and nothing beyond the radius', () => {
    const out = itemsNear(pool, yellowstone, 120);
    expect(out.map((n) => n.item.id)).toEqual(['here', 'mid']);
    expect(out[0].distanceKm).toBeLessThan(1);
    expect(out[1].distanceKm).toBeGreaterThan(50);
  });

  it('never includes an item with no coordinates', () => {
    expect(itemsNear(pool, yellowstone, 20000).map((n) => n.item.id)).not.toContain('none');
  });
});

describe('matchesGlobeFilter', () => {
  it('offers a filter for each kind of thing the brief names', () => {
    expect(GLOBE_FILTERS.map((f) => f.key)).toEqual(['all', 'animals', 'plants', 'landscapes', 'landmarks', 'history', 'ocean', 'space']);
  });

  it('filters by subject, with the old channel rules kept for catalogs without subjects', () => {
    const bird = makeItem({ id: 'b', subjects: ['birds'], channel: 'wild_earth', environment: 'coast' });
    const fort = makeItem({ id: 'f', subjects: ['landmarks', 'history'], channel: 'archives', environment: 'historic_site' });
    const old = makeItem({ id: 'o', channel: 'archives' });
    expect(matchesGlobeFilter(bird, 'animals')).toBe(true);
    expect(matchesGlobeFilter(bird, 'history')).toBe(false);
    expect(matchesGlobeFilter(fort, 'landmarks')).toBe(true);
    expect(matchesGlobeFilter(fort, 'history')).toBe(true);
    expect(matchesGlobeFilter(old, 'history')).toBe(true);
    expect(matchesGlobeFilter(makeItem({ id: 'd' }), 'ocean')).toBe(true);
  });
});

describe('placeMatches', () => {
  it('matches the point name, the region and the site', () => {
    const item = makeItem({ id: 'y', source: { organization: 'NPS', site: 'Yellowstone National Park' }, location: { type: 'earth_surface', latitude: 44.6, longitude: -110.5, accuracy: 'region', regionName: 'Idaho, Montana, Wyoming', displayName: 'Yellowstone National Park', coordinateSource: 't' } });
    expect(placeMatches('yellow', { displayName: 'Yellowstone National Park' }, [item])).toBe(true);
    expect(placeMatches('montana', { displayName: 'Yellowstone National Park' }, [item])).toBe(true);
    expect(placeMatches('ohio', { displayName: 'Yellowstone National Park' }, [item])).toBe(false);
    expect(placeMatches('  ', { displayName: 'x' }, [item])).toBe(false);
  });
});

describe('collections for the wider catalog', () => {
  const birds = Array.from({ length: 6 }, (_, i) => makeItem({ id: `bird${i}`, title: `Heron ${i}`, subjects: ['birds'] }));
  const park = Array.from({ length: MIN_SITE_COLLECTION }, (_, i) => makeItem({ id: `park${i}`, source: { organization: 'NPS', site: 'Acadia National Park' } }));

  it('builds one collection per subject group and one per well-stocked site', () => {
    const cs = buildCollections([...birds, ...park]);
    const group = cs.find((c) => c.id === 'group:birds');
    expect(group?.title).toBe('Birds');
    expect(group?.itemIds).toHaveLength(6);
    const site = cs.find((c) => c.id === 'site:Acadia National Park');
    expect(site?.kind).toBe('site');
    expect(site?.itemIds).toHaveLength(MIN_SITE_COLLECTION);
  });

  it('does not list a site with too few clips', () => {
    const cs = buildCollections(park.slice(0, MIN_SITE_COLLECTION - 1));
    expect(cs.some((c) => c.kind === 'site')).toBe(false);
  });
});

describe('Keep exploring a site', () => {
  it('narrows to the named park or historic site', () => {
    const a = makeItem({ id: 'a', source: { organization: 'NPS', site: 'Acadia National Park' } });
    const b = makeItem({ id: 'b', source: { organization: 'NPS', site: 'Zion National Park' } });
    const c = constraintForItem(a)!;
    expect(c).toMatchObject({ kind: 'site', label: 'Acadia National Park' });
    expect(matchesConstraint(a, c)).toBe(true);
    expect(matchesConstraint(b, c)).toBe(false);
  });
});
