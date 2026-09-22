import { describe, expect, it } from 'vitest';
import { buildCollections, expeditionTitle, formatRuntime, MIN_COLLECTION } from '../catalog/collections';
import { matchesConstraint } from '../shuffle/constraint';
import { eligibleUniverse } from '../shuffle/engine';
import type { FrontierMediaItem } from '../types/media';
import { makeItem } from './fixtures';

const many = (n: number, over: (i: number) => Partial<FrontierMediaItem>) =>
  Array.from({ length: n }, (_, i) => makeItem({ id: `x${i}`, ...over(i) }));

describe('collections', () => {
  it('names NOAA expeditions the way a person would say them', () => {
    expect(expeditionTitle('2021 North Atlantic Stepping Stones: New England and Corner Rise Seamounts (EX2104)'))
      .toEqual({ title: 'North Atlantic Stepping Stones', year: '2021' });
    expect(expeditionTitle('Voyage to the Ridge 2022 (EX2204-EX2206)')).toEqual({ title: 'Voyage to the Ridge', year: '2022' });
    expect(expeditionTitle('Seascape Alaska 5: Gulf of Alaska Remotely Operated Vehicle Exploration and Mapping (EX2306)'))
      .toEqual({ title: 'Seascape Alaska 5', year: undefined });
  });

  it('formats runtime for a list, not a stopwatch', () => {
    expect(formatRuntime(20)).toBe('1 min');
    expect(formatRuntime(44 * 60)).toBe('44 min');
    expect(formatRuntime(8 * 3600 + 34 * 60)).toBe('8 h 34 min');
    expect(formatRuntime(2 * 3600)).toBe('2 h');
  });

  it('builds subjects from published metadata and drops thin ones', () => {
    const octopus = many(MIN_COLLECTION, (i) => ({ title: `Dumbo Octopus ${i}` }));
    const thin = many(MIN_COLLECTION - 1, (i) => ({ id: `w${i}`, title: `Shipwreck ${i}` }));
    const cols = buildCollections([...octopus, ...thin]);
    expect(cols.map((c) => c.title)).toContain('Octopus and squid');
    expect(cols.map((c) => c.title)).not.toContain('Shipwrecks');
    const oct = cols.find((c) => c.title === 'Octopus and squid')!;
    expect(oct.itemIds).toHaveLength(MIN_COLLECTION);
    expect(oct.subtitle).toMatch(/5 clips/);
  });

  it('keeps two cruises of the same programme apart', () => {
    const a = many(5, (i) => ({ id: `a${i}`, source: { organization: 'NOAA', expedition: 'Beyond the Blue: Papahānaumokuākea Mapping (EX2403, EX2404, EX2501)' } }));
    const b = many(5, (i) => ({ id: `b${i}`, source: { organization: 'NOAA', expedition: 'Beyond the Blue: Papahānaumokuākea ROV and Mapping (EX2503)' } }));
    const titles = buildCollections([...a, ...b]).filter((c) => c.kind === 'expedition').map((c) => c.title);
    expect(new Set(titles).size).toBe(2);
  });

  it('puts New this week first, and only once there is something new', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const fresh = many(3, (i) => ({ id: `n${i}`, addedAt: '2026-10-08T00:00:00Z' }));
    expect(buildCollections(fresh, now)[0]?.title).toBe('New this week');
    expect(buildCollections(fresh.slice(0, 2), now).find((c) => c.kind === 'new')).toBeUndefined();
  });

  it('plays a collection regardless of the channel, because it was chosen', () => {
    const items = [makeItem({ id: 'deep', channel: 'deep_sea' }), makeItem({ id: 'orbit', channel: 'space' })];
    const constraint = { kind: 'collection' as const, label: 'x', value: 'x', memberIds: new Set(['deep']) };
    expect(matchesConstraint(items[0], constraint)).toBe(true);
    expect(matchesConstraint(items[1], constraint)).toBe(false);
    const { pool } = eligibleUniverse(items, { channel: 'space', constraint, sessionPlayedIds: [] } as never);
    expect(pool.map((i) => i.id)).toEqual(['deep']);
  });
});
