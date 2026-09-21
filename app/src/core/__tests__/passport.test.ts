import { describe, it, expect } from 'vitest';
import { recordVisit, recentIds, visitedPlaces, passportTotals, applyOutcome, mergeHealth, EMPTY_HISTORY } from '../history/passport';
import { toggleSaved, isSaved, shareable, deepLink, parseDeepLink, toSaved } from '../history/saved';
import { makeItem } from './fixtures';

describe('discovery passport', () => {
  it('records a visit and opens the place', () => {
    const item = makeItem({ id: 'a' });
    const h = recordVisit(EMPTY_HISTORY, item, { watchedSeconds: 42, completed: false, at: '2026-09-21T10:00:00.000Z' });
    expect(h.visits).toHaveLength(1);
    expect(Object.keys(h.places)).toHaveLength(1);
    expect(visitedPlaces(h)[0].visits).toBe(1);
  });

  it('counts repeat visits to one place rather than scattering points', () => {
    let h = recordVisit(EMPTY_HISTORY, makeItem({ id: 'a' }), { watchedSeconds: 10, completed: true, at: '2026-09-20T10:00:00.000Z' });
    h = recordVisit(h, makeItem({ id: 'b' }), { watchedSeconds: 10, completed: true, at: '2026-09-21T10:00:00.000Z' });
    expect(Object.keys(h.places)).toHaveLength(1);
    expect(visitedPlaces(h)[0].visits).toBe(2);
    expect(visitedPlaces(h)[0].firstVisitedAt).toBe('2026-09-20T10:00:00.000Z');
    expect(visitedPlaces(h)[0].lastVisitedAt).toBe('2026-09-21T10:00:00.000Z');
  });

  it('does not create a place for an item with no location', () => {
    const nowhere = makeItem({ id: 'n', location: { type: 'unknown', accuracy: 'unknown' } });
    const h = recordVisit(EMPTY_HISTORY, nowhere, { watchedSeconds: 5, completed: false });
    expect(Object.keys(h.places)).toHaveLength(0);
    expect(h.visits).toHaveLength(1);
  });

  it('returns recent ids newest first, without duplicates', () => {
    let h = recordVisit(EMPTY_HISTORY, makeItem({ id: 'a' }), { watchedSeconds: 1, completed: false });
    h = recordVisit(h, makeItem({ id: 'b' }), { watchedSeconds: 1, completed: false });
    h = recordVisit(h, makeItem({ id: 'a' }), { watchedSeconds: 1, completed: false });
    expect(recentIds(h)).toEqual(['a', 'b']);
  });

  it('reports totals without inventing a score', () => {
    const h = recordVisit(EMPTY_HISTORY, makeItem({ id: 'a' }), { watchedSeconds: 1, completed: false });
    expect(passportTotals(h, 3)).toEqual({ placesVisited: 1, saved: 3, discoveries: 1 });
  });
});

describe('behavioural health', () => {
  it('accumulates plays, early leaves and completions', () => {
    let m = applyOutcome({}, 'x', { watchedSeconds: 2, completed: false });
    m = applyOutcome(m, 'x', { watchedSeconds: 90, completed: true });
    expect(m.x).toMatchObject({ plays: 2, earlyLeaves: 1, completions: 1 });
  });

  it('does not weight an item on a single play', () => {
    const map = applyOutcome({}, 'a', { watchedSeconds: 1, completed: false });
    const [merged] = mergeHealth([makeItem({ id: 'a' })], map);
    expect(merged.health?.earlyShuffleRate).toBeUndefined();
  });

  it('feeds the engine once there is enough evidence', () => {
    let map = applyOutcome({}, 'a', { watchedSeconds: 1, completed: false });
    map = applyOutcome(map, 'a', { watchedSeconds: 2, completed: false });
    map = applyOutcome(map, 'a', { watchedSeconds: 1, completed: false });
    const [merged] = mergeHealth([makeItem({ id: 'a' })], map);
    expect(merged.health?.earlyShuffleRate).toBe(1);
    expect(merged.health?.completionRate).toBe(0);
  });
});

describe('saved discoveries', () => {
  it('toggles on and off', () => {
    const item = makeItem({ id: 'a' });
    const once = toggleSaved([], item);
    expect(isSaved(once, 'a')).toBe(true);
    expect(isSaved(toggleSaved(once, item), 'a')).toBe(false);
  });

  it('keeps enough to show the row without the catalog', () => {
    const saved = toSaved(makeItem({ id: 'a' }));
    expect(saved.title).toBeTruthy();
    expect(saved.placeLabel).toBe('Pacific Ocean');
    expect(saved.organization).toBe('NOAA Ocean Exploration');
  });

  it('shares a reference and provenance, never the media file', () => {
    const item = makeItem({ id: 'a', source: { organization: 'NOAA Ocean Exploration', assetUrl: 'https://oceanexplorer.noaa.gov/multimedia/a/' } });
    const payload = shareable(item);
    expect(payload.url).toBe('https://oceanexplorer.noaa.gov/multimedia/a/');
    expect(payload.url).not.toContain('.mp4');
    expect(payload.text).toContain('NOAA Ocean Exploration');
  });

  it('round-trips a deep link', () => {
    const link = deepLink('noaa:123:456');
    expect(parseDeepLink(link)).toBe('noaa:123:456');
  });

  it('ignores a link that is not one of ours', () => {
    expect(parseDeepLink('https://example.com/nope')).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
  });
});
