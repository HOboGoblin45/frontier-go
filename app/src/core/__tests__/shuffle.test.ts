import { describe, it, expect } from 'vitest';
import { buildDeck, eligibleUniverse, geographicContrastWeight, environmentContrastWeight, noveltyWeight, qualityWeight } from '../shuffle/engine';
import { constraintForItem, matchesConstraint } from '../shuffle/constraint';
import { makeItem, seededRandom } from './fixtures';
import type { FrontierMediaItem } from '../types/media';

function pool(): FrontierMediaItem[] {
  return [
    makeItem({ id: 'pacific-1', location: { type: 'underwater', latitude: 0, longitude: -160, accuracy: 'region', displayName: 'Pacific Ocean', regionName: 'Pacific Ocean' } }),
    makeItem({ id: 'pacific-2', location: { type: 'underwater', latitude: 2, longitude: -159, accuracy: 'region', displayName: 'Pacific Ocean', regionName: 'Pacific Ocean' } }),
    makeItem({ id: 'atlantic-1', location: { type: 'underwater', latitude: 0, longitude: -25, accuracy: 'region', displayName: 'Atlantic Ocean', regionName: 'Atlantic Ocean' } }),
    makeItem({ id: 'orbit-1', channel: 'space', environment: 'orbit', location: { type: 'earth_orbit', accuracy: 'mission', altitudeMeters: 408000, displayName: 'Low Earth Orbit', regionName: 'International Space Station', celestialBody: 'earth' } }),
    makeItem({ id: 'polar-1', channel: 'wild_earth', environment: 'polar', location: { type: 'earth_surface', latitude: -77.85, longitude: 166.67, accuracy: 'region', displayName: 'Antarctica', regionName: 'Antarctica' } }),
    makeItem({ id: 'volcano-1', channel: 'wild_earth', environment: 'volcanic', location: { type: 'underwater', latitude: 17, longitude: 145, accuracy: 'region', displayName: 'Mariana Region', regionName: 'Mariana Region' } }),
  ];
}

describe('shuffle universe', () => {
  it('excludes items already played this session', () => {
    const { pool: p } = eligibleUniverse(pool(), {
      channel: 'everything', sessionPlayedIds: ['pacific-1', 'orbit-1'],
    });
    expect(p.map((i) => i.id)).not.toContain('pacific-1');
    expect(p.map((i) => i.id)).not.toContain('orbit-1');
  });

  it('reopens the session-played set only when the universe is otherwise empty', () => {
    const all = pool().map((i) => i.id);
    const { pool: p, exhausted } = eligibleUniverse(pool(), { channel: 'everything', sessionPlayedIds: all });
    expect(exhausted).toBe(true);
    expect(p).toHaveLength(all.length);
  });

  it('honours the channel filter', () => {
    const { pool: p } = eligibleUniverse(pool(), { channel: 'space', sessionPlayedIds: [] });
    expect(p.map((i) => i.id)).toEqual(['orbit-1']);
  });
});

describe('contrast weighting', () => {
  it('rewards a long jump over a short one', () => {
    const items = pool();
    const from = items[0];
    const near = geographicContrastWeight(items[1], from);
    const far = geographicContrastWeight(items[2], from);
    expect(far).toBeGreaterThan(near);
  });

  it('treats leaving Earth as the largest jump available', () => {
    const items = pool();
    expect(geographicContrastWeight(items[3], items[0])).toBeCloseTo(1.4, 5);
  });

  it('penalises staying in the same kind of place', () => {
    const items = pool();
    expect(environmentContrastWeight(items[1], items[0])).toBeLessThan(1);
    expect(environmentContrastWeight(items[4], items[0])).toBeGreaterThan(1);
  });

  it('demotes anything played recently, most recent hardest', () => {
    const items = pool();
    const justSeen = noveltyWeight(items[0], ['pacific-1', 'atlantic-1']);
    const longAgo = noveltyWeight(items[2], ['pacific-1', 'atlantic-1']);
    expect(justSeen).toBeLessThan(longAgo);
    expect(noveltyWeight(items[0], [])).toBe(1);
  });

  it('demotes content that nearly everyone leaves in the first seconds', () => {
    const good = makeItem({ id: 'good' });
    const bad = makeItem({ id: 'bad' });
    bad.health = { productionEligible: true, earlyShuffleRate: 0.92, completionRate: 0.02 };
    expect(qualityWeight(bad)).toBeLessThan(qualityWeight(good));
  });
});

describe('buildDeck', () => {
  it('never repeats within a deck', () => {
    const deck = buildDeck(pool(), { channel: 'everything', sessionPlayedIds: [], random: seededRandom(7) }, 5);
    expect(new Set(deck.map((i) => i.id)).size).toBe(deck.length);
  });

  it('never returns an item already played this session while alternatives exist', () => {
    const deck = buildDeck(pool(), {
      channel: 'everything', sessionPlayedIds: ['pacific-1', 'pacific-2'], random: seededRandom(11),
    }, 4);
    expect(deck.map((i) => i.id)).not.toContain('pacific-1');
    expect(deck.map((i) => i.id)).not.toContain('pacific-2');
  });

  it('produces a varied route rather than a run of one environment', () => {
    // Twelve deep-sea items and three of everything else: a naive random draw
    // lands on deep sea nearly every time. Contrast weighting should not.
    const skewed = [
      ...Array.from({ length: 12 }, (_, i) => makeItem({ id: `deep-${i}` })),
      makeItem({ id: 'orbit', channel: 'space', environment: 'orbit' }),
      makeItem({ id: 'polar', channel: 'wild_earth', environment: 'polar' }),
      makeItem({ id: 'volcano', channel: 'wild_earth', environment: 'volcanic' }),
    ];
    const deck = buildDeck(skewed, { channel: 'everything', sessionPlayedIds: [], random: seededRandom(3) }, 6);
    const environments = new Set(deck.map((i) => i.environment));
    expect(environments.size).toBeGreaterThan(1);
  });

  it('stays inside an active constraint', () => {
    const items = pool().map((i) => ({ ...i, source: { ...i.source, expedition: i.id.startsWith('pacific') ? 'EX2605' : 'OTHER' } }));
    const deck = buildDeck(items, {
      channel: 'everything', sessionPlayedIds: [],
      constraint: { kind: 'expedition', label: 'EX2605', value: 'EX2605' },
      random: seededRandom(5),
    }, 4);
    expect(deck.every((i) => i.source.expedition === 'EX2605')).toBe(true);
  });

  it('returns an empty deck rather than throwing when nothing is eligible', () => {
    expect(buildDeck([], { channel: 'everything', sessionPlayedIds: [] }, 4)).toEqual([]);
  });
});

describe('keep exploring here', () => {
  it('prefers a named expedition over a coordinate radius', () => {
    const item = makeItem({ id: 'x', source: { organization: 'NOAA Ocean Exploration', expedition: 'EX2605' } });
    expect(constraintForItem(item)).toMatchObject({ kind: 'expedition', value: 'EX2605' });
  });

  it('falls back to a nearby radius only for a precise position', () => {
    const item = makeItem({
      id: 'y',
      location: { type: 'underwater', latitude: 36.6, longitude: -122, accuracy: 'approximate', displayName: 'Monterey Canyon' },
    });
    expect(constraintForItem(item)?.kind).toBe('nearby');
  });

  it('does not build a radius around a region reference point', () => {
    const item = makeItem({ id: 'z' });
    expect(constraintForItem(item)?.kind).toBe('region');
  });

  it('matches only items inside the radius', () => {
    const origin = { type: 'underwater' as const, latitude: 36.6, longitude: -122, accuracy: 'approximate' as const };
    const constraint = { kind: 'nearby' as const, label: 'Monterey', value: '36.6,-122', radiusKm: 400, origin };
    const near = makeItem({ id: 'near', location: { ...origin, latitude: 37.5 } });
    const far = makeItem({ id: 'far', location: { ...origin, latitude: 0, longitude: -25 } });
    expect(matchesConstraint(near, constraint)).toBe(true);
    expect(matchesConstraint(far, constraint)).toBe(false);
  });
});
