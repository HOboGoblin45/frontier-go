import { describe, it, expect } from 'vitest';
import { indexCatalog, globePoints, offEarthGroups } from '../catalog/catalog';
import { collapseDuplicates, normalizeTitle, duplicateKey } from '../catalog/dedupe';
import { technicalQualityScore, metadataCompleteness, freshnessScore, baseWeight, withRanking } from '../catalog/quality';
import { runPipeline } from '../catalog/pipeline';
import { makeItem } from './fixtures';
import type { FrontierProviderAdapter, RawProviderItem } from '../../providers/types';
import type { FrontierCatalog } from '../types/media';

describe('globe points', () => {
  it('collapses items at the same place into one marker', () => {
    const points = globePoints([
      makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].count).toBe(3);
  });

  it('leaves un-plottable items off the globe entirely rather than guessing', () => {
    const mission = makeItem({
      id: 'iss',
      location: { type: 'earth_orbit', accuracy: 'mission', displayName: 'Low Earth Orbit', celestialBody: 'earth' },
    });
    expect(globePoints([mission])).toHaveLength(0);
    expect(offEarthGroups([mission])).toHaveLength(1);
  });

  it('respects the channel filter', () => {
    const deep = makeItem({ id: 'deep' });
    const space = makeItem({ id: 'space', channel: 'space' });
    expect(globePoints([deep, space], 'space')).toHaveLength(1);
  });
});

describe('duplicate collapse', () => {
  it('strips resolution and format noise from a title', () => {
    expect(normalizeTitle('Dive 06 Cusk Eel 1280x720 HD mp4')).toBe('cusk eel');
    expect(normalizeTitle('EX2605 Dive06 Octopus')).toBe('octopus');
  });

  it('groups the same footage published at two resolutions', () => {
    const a = makeItem({ id: 'a', title: 'Hydrothermal Vent 1280x720' });
    const b = makeItem({ id: 'b', title: 'Hydrothermal Vent 640x360' });
    expect(duplicateKey(a)).toBe(duplicateKey(b));
    const { kept, collapsed } = collapseDuplicates([a, b]);
    expect(kept).toHaveLength(1);
    expect(collapsed).toBe(1);
    expect(kept[0].ranking.duplicateGroupId).toBeTruthy();
  });

  it('keeps the better copy', () => {
    const low = makeItem({ id: 'low', title: 'Vent Field' });
    low.stream.height = 360; low.ranking.contentQuality = 0.3;
    const high = makeItem({ id: 'high', title: 'Vent Field' });
    high.ranking.contentQuality = 0.9;
    expect(collapseDuplicates([low, high]).kept[0].id).toBe('high');
  });

  it('does not collapse different footage of different lengths', () => {
    const a = makeItem({ id: 'a', title: 'Octopus' });
    const b = makeItem({ id: 'b', title: 'Octopus' });
    b.stream.durationSeconds = 600;
    expect(collapseDuplicates([a, b]).kept).toHaveLength(2);
  });
});

describe('quality scoring', () => {
  it('rewards HD over SD', () => {
    const hd = makeItem({ id: 'hd' });
    const sd = makeItem({ id: 'sd' });
    sd.stream.height = 360; sd.stream.width = 640;
    expect(technicalQualityScore(hd)).toBeGreaterThan(technicalQualityScore(sd));
  });

  it('rewards a clip in the watchable band over a very short one', () => {
    const good = makeItem({ id: 'g' });
    const blink = makeItem({ id: 'b' });
    blink.stream.durationSeconds = 9;
    expect(technicalQualityScore(good)).toBeGreaterThan(technicalQualityScore(blink));
  });

  it('rewards metadata that tells the viewer where they are', () => {
    const rich = makeItem({
      id: 'rich',
      description: 'A long description of what is happening in this footage and where it was captured.',
      tags: ['Corals', 'Seamounts'],
      captionsUrl: 'https://example.gov/a.vtt',
      source: { organization: 'NOAA Ocean Exploration', expedition: 'EX2605' },
    });
    const bare = makeItem({ id: 'bare', description: undefined, tags: [], imagery: {} });
    expect(metadataCompleteness(rich)).toBeGreaterThan(metadataCompleteness(bare));
  });

  it('decays freshness with age without zeroing archives', () => {
    const now = Date.parse('2026-09-21T00:00:00.000Z');
    const recent = makeItem({ id: 'r', temporal: { publishedAt: '2026-08-01T00:00:00.000Z' } });
    const old = makeItem({ id: 'o', temporal: { publishedAt: '1972-12-11T00:00:00.000Z' } });
    expect(freshnessScore(recent, now)).toBeGreaterThan(freshnessScore(old, now));
    expect(freshnessScore(old, now)).toBeGreaterThan(0);
  });

  it('dials archives and unplaced items down without excluding them', () => {
    expect(baseWeight(makeItem({ id: 'a', channel: 'archives' }))).toBeLessThan(1);
    expect(baseWeight(makeItem({ id: 'b', location: { type: 'unknown', accuracy: 'unknown' } }))).toBeLessThan(1);
  });

  it('writes a technical score onto health', () => {
    expect(withRanking(makeItem({ id: 'a' })).health?.technicalQualityScore).toBeGreaterThan(0);
  });
});

describe('pipeline', () => {
  function adapter(items: ReturnType<typeof makeItem>[]): FrontierProviderAdapter {
    return {
      provider: 'noaa_ocean_exploration',
      organization: 'NOAA Ocean Exploration',
      rightsUrl: 'https://example.gov/terms',
      async fetchItems() { return items as unknown as RawProviderItem[]; },
      normalize(raw) { return raw as unknown as ReturnType<typeof makeItem>; },
      validateRights() { return true; },
    };
  }

  it('counts every stage and publishes only what survives all of them', async () => {
    const good = makeItem({ id: 'good' });
    const copyrighted = makeItem({ id: 'copyrighted' });
    copyrighted.rights = { ...copyrighted.rights, classification: 'unknown', commercialUseAllowed: false };
    const person = makeItem({ id: 'person' });
    person.safety = { ...person.safety, identifiablePersons: true };
    const tiny = makeItem({ id: 'tiny' });
    tiny.stream.durationSeconds = 3;

    const { catalog, rejected } = await runPipeline({
      adapters: [adapter([good, copyrighted, person, tiny])],
    });

    expect(catalog.stats.normalized).toBe(4);
    expect(catalog.stats.rightsRejected).toBe(1);
    expect(catalog.stats.safetyRejected).toBe(1);
    expect(catalog.stats.qualityRejected).toBe(1);
    expect(catalog.stats.published).toBe(1);
    expect(catalog.items.map((i) => i.id)).toEqual(['good']);
    expect(rejected).toHaveLength(3);
  });

  it('drops an item whose stream does not answer', async () => {
    const item = makeItem({ id: 'dead' });
    const { catalog } = await runPipeline({
      adapters: [adapter([item])],
      probe: async () => ({ ok: false, status: 404 }),
    });
    expect(catalog.stats.published).toBe(0);
  });

  it('recomputes bitrate from what the CDN actually serves', async () => {
    const item = makeItem({ id: 'live' });
    item.stream.durationSeconds = 100;
    const { catalog } = await runPipeline({
      adapters: [adapter([item])],
      probe: async () => ({ ok: true, status: 200, bytes: 12_500_000 }),
    });
    expect(catalog.items[0].stream.bitrate).toBe(1_000_000);
  });
});

describe('client catalog indexing', () => {
  it('separates eligible items from the raw list', () => {
    const bad = makeItem({ id: 'bad' });
    bad.rights = { ...bad.rights, classification: 'unknown' };
    const catalog: FrontierCatalog = {
      version: 1,
      generatedAt: new Date().toISOString(),
      stats: { fetched: 2, normalized: 2, rightsRejected: 0, safetyRejected: 0, qualityRejected: 0, duplicatesCollapsed: 0, published: 2, byProvider: {}, byChannel: {} },
      items: [makeItem({ id: 'ok' }), bad],
    };
    const loaded = indexCatalog(catalog);
    expect(loaded.items).toHaveLength(2);
    expect(loaded.eligible.map((i) => i.id)).toEqual(['ok']);
    expect(loaded.byId.get('bad')).toBeTruthy();
  });
});

describe('stampAddedAt', () => {
  const item = (id: string, addedAt?: string) => ({ id, addedAt } as unknown as import('../types/media').FrontierMediaItem);
  it('stamps only what the previous catalog did not have', async () => {
    const { stampAddedAt } = await import('../catalog/pipeline');
    const out = stampAddedAt([item('a'), item('b'), item('c')], { items: [item('a'), item('b', '2026-09-01T00:00:00Z')] }, '2026-09-29T06:17:00Z');
    expect(out.map((i) => i.addedAt)).toEqual([undefined, '2026-09-01T00:00:00Z', '2026-09-29T06:17:00Z']);
  });
  it('stamps nothing when there is no previous catalog, so the launch set is not all "new"', async () => {
    const { stampAddedAt } = await import('../catalog/pipeline');
    expect(stampAddedAt([item('a', 'x')], null, 'now').map((i) => i.addedAt)).toEqual([undefined]);
  });
});

describe('remote catalog', () => {
  const loaded = (generatedAt: string, n: number) => ({ generatedAt, eligible: new Array(n).fill(null) } as unknown as import('../catalog/catalog').LoadedCatalog);

  it('adopts a newer catalog of similar size', async () => {
    const { shouldAdopt } = await import('../catalog/catalog');
    expect(shouldAdopt(loaded('2026-09-22T00:00:00Z', 1600), loaded('2026-09-29T00:00:00Z', 1650))).toBe(true);
  });

  it('refuses an older or identical one', async () => {
    const { shouldAdopt } = await import('../catalog/catalog');
    expect(shouldAdopt(loaded('2026-09-22T00:00:00Z', 1600), loaded('2026-09-22T00:00:00Z', 1700))).toBe(false);
    expect(shouldAdopt(loaded('2026-09-22T00:00:00Z', 1600), loaded('2026-09-01T00:00:00Z', 1700))).toBe(false);
  });

  it('refuses a newer catalog that collapsed, so one broken ingest cannot gut every phone', async () => {
    const { shouldAdopt } = await import('../catalog/catalog');
    expect(shouldAdopt(loaded('2026-09-22T00:00:00Z', 1600), loaded('2026-09-29T00:00:00Z', 400))).toBe(false);
  });

  it('returns null rather than throwing on a bad response, and re-gates what it accepts', async () => {
    const { loadRemoteCatalog } = await import('../catalog/catalog');
    const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
    expect(await loadRemoteCatalog('x', reply({}, false))).toBeNull();
    expect(await loadRemoteCatalog('x', reply({ version: 2, items: [], generatedAt: 'x' }))).toBeNull();
    expect(await loadRemoteCatalog('x', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
    const bad = { id: 'x', rights: { classification: 'unknown' } };
    const got = await loadRemoteCatalog('x', reply({ version: 1, generatedAt: '2026-09-29T00:00:00Z', items: [bad], stats: {} }));
    expect(got?.items.length).toBe(1);
    expect(got?.eligible.length).toBe(0);
  });

  it('lists what arrived recently, newest first, and nothing from the launch set', async () => {
    const { recentlyAdded } = await import('../catalog/catalog');
    const now = Date.parse('2026-10-10T00:00:00Z');
    const items = [
      { id: 'launch' },
      { id: 'old', addedAt: '2026-09-01T00:00:00Z' },
      { id: 'a', addedAt: '2026-10-01T00:00:00Z' },
      { id: 'b', addedAt: '2026-10-08T00:00:00Z' },
    ] as unknown as import('../types/media').FrontierMediaItem[];
    expect(recentlyAdded(items, now).map((i) => i.id)).toEqual(['b', 'a']);
  });
});
