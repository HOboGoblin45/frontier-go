import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FrontierCatalog } from '../types/media';
import { evaluateEligibility } from '../catalog/eligibility';
import { rightsAreClear } from '../types/rights';
import { safetyIsClear } from '../types/safety';
import { isPlottable } from '../types/location';
import { globePoints } from '../catalog/catalog';
import { buildDeck } from '../shuffle/engine';
import { seededRandom } from './fixtures';

/**
 * The catalog that actually ships.
 *
 * Unit tests prove the gates work; this proves they were applied to the file
 * in the bundle. A regenerated catalog that quietly includes a copyrighted
 * clip, a dead URL shape, or a coordinate with no stated basis fails here
 * before it reaches a runner, never mind a device.
 */

const catalog = JSON.parse(
  readFileSync(resolve(__dirname, '../../../public/catalog/frontier-catalog.json'), 'utf8'),
) as FrontierCatalog;

describe('shipped catalog', () => {
  it('is present and non-trivial', () => {
    expect(catalog.version).toBe(1);
    expect(catalog.items.length).toBeGreaterThan(50);
    expect(catalog.stats.published).toBe(catalog.items.length);
  });

  it('contains more than one provider, so the channel is not one archive', () => {
    expect(Object.keys(catalog.stats.byProvider).length).toBeGreaterThan(1);
  });

  it('passes the rights gate on every single item', () => {
    const bad = catalog.items.filter((i) => !rightsAreClear(i.rights));
    expect(bad.map((i) => i.id)).toEqual([]);
  });

  it('passes the safety gate on every single item', () => {
    const bad = catalog.items.filter((i) => !safetyIsClear(i.safety));
    expect(bad.map((i) => i.id)).toEqual([]);
  });

  it('passes the full eligibility gate on every single item', () => {
    const bad = catalog.items
      .map((i) => ({ id: i.id, reasons: evaluateEligibility(i).reasons }))
      .filter((r) => r.reasons.length > 0);
    expect(bad).toEqual([]);
  });

  it('streams only over https', () => {
    expect(catalog.items.every((i) => i.stream.url.startsWith('https://'))).toBe(true);
  });

  it('has no whitespace or unescaped characters in a stream URL', () => {
    const malformed = catalog.items.filter((i) => /\s/.test(i.stream.url));
    expect(malformed.map((i) => i.stream.url)).toEqual([]);
  });

  it('records an attribution line for every item', () => {
    expect(catalog.items.every((i) => !!i.rights.attributionText)).toBe(true);
  });

  it('never claims the right to cache source media', () => {
    expect(catalog.items.some((i) => i.rights.cachingAllowed === true)).toBe(false);
  });

  it('states where every coordinate came from', () => {
    const plotted = catalog.items.filter((i) => isPlottable(i.location));
    expect(plotted.length).toBeGreaterThan(0);
    const unsourced = plotted.filter((i) => !i.location?.coordinateSource);
    expect(unsourced.map((i) => i.id)).toEqual([]);
  });

  it('never presents a region reference point as an exact position', () => {
    const overclaimed = catalog.items.filter(
      (i) => i.location?.accuracy === 'exact' && !i.location?.coordinateSource,
    );
    expect(overclaimed.map((i) => i.id)).toEqual([]);
  });

  it('has enough plotted places to make a globe worth opening', () => {
    expect(globePoints(catalog.items).length).toBeGreaterThan(3);
  });

  it('can build a varied deck from the real data', () => {
    const deck = buildDeck(catalog.items, {
      channel: 'everything', sessionPlayedIds: [], random: seededRandom(1234),
    }, 8);
    expect(deck).toHaveLength(8);
    expect(new Set(deck.map((i) => i.id)).size).toBe(8);
    // A deck drawn from a catalog this varied should not be eight of one thing.
    expect(new Set(deck.map((i) => i.environment)).size).toBeGreaterThan(1);
  });

  it('keeps every channel it advertises non-empty', () => {
    for (const [channel, count] of Object.entries(catalog.stats.byChannel)) {
      expect(count, `channel ${channel}`).toBeGreaterThan(0);
    }
  });
});
