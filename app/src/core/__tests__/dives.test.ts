import { describe, expect, it } from 'vitest';
import type { DiveDetail, DiveSummary } from '../dives/types';
import { cruiseCodes, diveNumberIn, findDive, linkClipsToDives } from '../dives/link';
import { buildGroupAtlas, diveTitle, isNamedPlace, shortExpedition, sightingLabel } from '../dives/atlas';
import { diveTime, instrumentsAt, locate, nearestTemperature, nextSighting, sampleIndex } from '../dives/telemetry';
import type { FrontierMediaItem } from '../types/media';

const dive = (over: Partial<DiveSummary>): DiveSummary => ({
  id: 'EX2104-DIVE05', cruise: 'EX2104', dive: 5, date: '2021-07-08', latitude: 35.81691, longitude: -52.30754,
  maxDepthMeters: 4187, durationSeconds: 30676, sightingCount: 104, groups: [], videoSeconds: 30418, ...over,
});

const DIVES = [
  dive({}),
  dive({ id: 'EX2104-DIVE06', dive: 6 }),
  dive({ id: 'EX2204-DIVE06', cruise: 'EX2204', dive: 6 }),
  dive({ id: 'EX2206-DIVE06', cruise: 'EX2206', dive: 6 }),
  dive({ id: 'EX2206-DIVE09', cruise: 'EX2206', dive: 9 }),
  dive({ id: 'EX1504L2-DIVE03', cruise: 'EX1504L2', dive: 3 }),
];

function clip(title: string, expedition?: string, description = ''): FrontierMediaItem {
  return {
    id: title, provider: 'noaa_ocean_exploration', providerAssetId: '1', title, description,
    stream: { url: 'https://x/y.mp4', type: 'mp4' }, imagery: {}, temporal: {}, channel: 'deep_sea', tags: [],
    environment: 'deep_ocean', availability: 'on_demand',
    location: { type: 'underwater', latitude: 0, longitude: -25, accuracy: 'region', coordinateSource: 'basin', depthMeters: 2000 },
    source: { organization: 'NOAA', ...(expedition ? { expedition } : {}) },
    rights: {} as FrontierMediaItem['rights'], safety: {} as FrontierMediaItem['safety'],
    ranking: { contentQuality: 0.5, freshness: 0.5, baseWeight: 1 },
  };
}

describe('linking clips to dives', () => {
  it('reads cruise codes, including ranges and legs', () => {
    expect(cruiseCodes('2021 North Atlantic Stepping Stones (EX2104)')).toEqual(['EX2104']);
    expect(cruiseCodes('Voyage to the Ridge 2022 (EX2204-EX2206)')).toEqual(['EX2204', 'EX2205', 'EX2206']);
    expect(cruiseCodes('Hohonu Moana (EX1504L2)')).toEqual(['EX1504']);
    expect(cruiseCodes(undefined)).toEqual([]);
  });

  it('reads the dive number from the title or text', () => {
    expect(diveNumberIn('Big Jellyfish: Dive 08')).toBe(8);
    expect(diveNumberIn('During dive #3 the team')).toBe(3);
    expect(diveNumberIn('A deep dive into corals')).toBeUndefined();
  });

  it('links only when exactly one dive matches', () => {
    expect(findDive(clip('Squat lobster, Dive 05', '(EX2104)'), DIVES)?.id).toBe('EX2104-DIVE05');
    // Dive 06 exists in two of the three cruises the expedition spans.
    expect(findDive(clip('False Boarfish', 'Voyage to the Ridge 2022 (EX2204-EX2206)', 'seen on Dive 06'), DIVES)).toBeUndefined();
    expect(findDive(clip('Dive 09 highlight', 'Voyage to the Ridge 2022 (EX2204-EX2206)'), DIVES)?.id).toBe('EX2206-DIVE09');
    expect(findDive(clip('Dive 03', 'Hohonu Moana (EX1504)'), DIVES)?.id).toBe('EX1504L2-DIVE03');
    expect(findDive(clip('Dive 05'), DIVES)).toBeUndefined();
  });

  it('gives the clip the dive site, labelled as a site and sourced, and keeps its own depth', () => {
    const items = [clip('Squat lobster, Dive 05', '(EX2104)'), clip('Something else', '(EX2104)')];
    expect(linkClipsToDives(items, [dive({ site: 'Rockaway Seamount' })])).toBe(1);
    expect(items[0].source.diveId).toBe('EX2104-DIVE05');
    expect(items[0].location).toMatchObject({ latitude: 35.81691, longitude: -52.30754, accuracy: 'site', displayName: 'Rockaway Seamount', depthMeters: 2000 });
    expect(items[0].location?.coordinateSource).toContain('EX2104 dive 5');
    expect(items[1].location?.accuracy).toBe('region');
  });
});

describe('dive titles', () => {
  it('uses a named site, then the area, then the expedition', () => {
    expect(isNamedPlace('Rockaway Seamount')).toBe(true);
    expect(isNamedPlace('4aE')).toBe(false);
    expect(isNamedPlace('GB648')).toBe(false);
    expect(isNamedPlace('AT 251')).toBe(false);
    expect(isNamedPlace('Pao Pao')).toBe(true);
    expect(diveTitle({ site: '2a', area: 'Mid-Cayman Rise', dive: 3 })).toBe('Mid-Cayman Rise, dive 3');
    expect(diveTitle({ site: 'GB648', expedition: 'Okeanos Explorer Gulf of Mexico 2014: Mapping and ROV (EX1402L3)', dive: 3 })).toBe('Okeanos Explorer Gulf of Mexico 2014, dive 3');
    expect(diveTitle({ dive: 7 })).toBe('Dive 7');
    expect(shortExpedition('2021 North Atlantic Stepping Stones: New England and Corner Rise Seamounts')).toBe('2021 North Atlantic Stepping Stones');
  });

  it('labels a sighting by its common name, with the scientific name beside it', () => {
    expect(sightingLabel({ t: 0, group: 'Squat lobsters', taxon: 'Galatheidae', common: 'squat lobsters' })).toEqual({ primary: 'Squat lobsters', secondary: 'Galatheidae' });
    expect(sightingLabel({ t: 0, group: 'Glass sponges', taxon: 'Euplectellidae' })).toEqual({ primary: 'Glass sponges', secondary: 'Euplectellidae' });
    expect(sightingLabel({ t: 0, group: 'Other life', taxon: 'Animalia' })).toEqual({ primary: 'Animalia' });
  });
});

const TRACK = { t: [0, 30, 60, 90], depth: [0, 300, 600, 600], lat: [null, 35, 35.5, 36], lon: [null, -52, -52.5, -53] };
const SIGHTINGS = [
  { t: 40, group: 'Fish', tempC: 5 },
  { t: 70, group: 'Octopus' },
  { t: 900, group: 'Fish', tempC: 2 },
];
const SEGMENTS = [
  { t: 10, duration: 300, file: 'a', bytes: 1 },
  { t: 310, duration: 300, file: 'b', bytes: 1 },
  { t: 700, duration: 100, file: 'c', bytes: 1 },
];

describe('dive telemetry', () => {
  it('finds the sample at or before a time', () => {
    expect(sampleIndex(TRACK.t, -5)).toBe(0);
    expect(sampleIndex(TRACK.t, 45)).toBe(1);
    expect(sampleIndex(TRACK.t, 999)).toBe(3);
  });

  it('interpolates depth and position between samples', () => {
    const i = instrumentsAt(TRACK, SIGHTINGS, 45);
    expect(i.depth).toBeCloseTo(450, 5);
    expect(i.lat).toBeCloseTo(35.25, 5);
    expect(i.lon).toBeCloseTo(-52.25, 5);
  });

  it('does not invent a position where the track has none', () => {
    const i = instrumentsAt(TRACK, SIGHTINGS, 0);
    expect(i.lat).toBe(35); // the nearest real fix, never 0,0
  });

  it('takes temperature from the nearest log within ten minutes only', () => {
    expect(nearestTemperature(SIGHTINGS, 60)).toBe(5);
    expect(nearestTemperature(SIGHTINGS, 850)).toBe(2);
    expect(nearestTemperature([{ t: 0, group: 'Fish', tempC: 4 }], 700)).toBeNull();
  });

  it('maps dive time to a segment and back, starting the next recording across a gap', () => {
    expect(locate(SEGMENTS, 5)).toEqual({ index: 0, offset: 0 });
    expect(locate(SEGMENTS, 100)).toEqual({ index: 0, offset: 90 });
    expect(locate(SEGMENTS, 650)).toEqual({ index: 2, offset: 0 });
    expect(locate(SEGMENTS, 5000)).toEqual({ index: 2, offset: 100 });
    expect(diveTime(SEGMENTS, 1, 20)).toBe(330);
    expect(locate([], 10)).toBeNull();
  });

  it('finds the next sighting, optionally within a group', () => {
    expect(nextSighting(SIGHTINGS, 40)?.t).toBe(70);
    expect(nextSighting(SIGHTINGS, 40, 'Fish')?.t).toBe(900);
    expect(nextSighting(SIGHTINGS, 900)).toBeNull();
  });
});

describe('group atlas', () => {
  it('aggregates across dives with one highlight per dive, deepest first', () => {
    const d = (id: string, sightings: DiveDetail['sightings']) => ({ ...dive({ id }), startUnix: 0, events: [], track: TRACK, segments: [], stills: [], sightings, source: { landingPage: '', credit: '' } }) as DiveDetail;
    const atlas = buildGroupAtlas([
      d('A', [{ t: 1, group: 'Octopus', taxon: 'Grimpoteuthis', depth: 3000 }, { t: 2, group: 'Octopus', taxon: 'Grimpoteuthis', depth: 3100 }, { t: 3, group: 'Fish', depth: 100 }]),
      d('B', [{ t: 1, group: 'Octopus', taxon: 'Octopodidae', depth: 1000 }]),
    ]);
    const octo = atlas.find((g) => g.slug === 'octopus')!;
    expect(octo).toMatchObject({ count: 3, dives: 2, deepest: 3100, shallowest: 1000 });
    expect(octo.highlights.map((h) => h.diveId)).toEqual(['A', 'B']);
    expect(octo.taxa[0]).toEqual({ taxon: 'Grimpoteuthis', count: 2 });
    expect(atlas[0].slug).toBe('octopus');
  });
});

describe('dive links', () => {
  it('reads app and web links to a dive, and nothing else', async () => {
    const { parseDiveLink } = await import('../dives/atlas');
    const site = 'https://hobogoblin45.github.io/frontier-go';
    expect(parseDiveLink('frontiergo://dive/EX2104-DIVE05', site)).toBe('EX2104-DIVE05');
    expect(parseDiveLink(`${site}/dives/ex1504l2-dive03/`, site)).toBe('EX1504L2-DIVE03');
    expect(parseDiveLink(`${site}/dives/`, site)).toBeNull();
    expect(parseDiveLink('frontiergo://discovery/abc', site)).toBeNull();
    expect(parseDiveLink('https://example.com/dives/ex2104-dive05/', site)).toBeNull();
  });
});
