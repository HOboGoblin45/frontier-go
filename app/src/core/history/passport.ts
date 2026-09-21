import type { DiscoveryHistory, DiscoveryVisit, VisitedPlace } from '../types/history';
import { EMPTY_HISTORY } from '../types/history';
import type { FrontierMediaItem } from '../types/media';
import { placeKey } from '../util/geo';
import { isPlottable } from '../types/location';

/**
 * The Discovery Passport.
 *
 * A record of where someone has been, not a score. No points, no streaks, no
 * badges — the reward for exploring is the map filling in, which is the only
 * reward this product should be offering.
 */

const MAX_VISITS = 400;

export function recordVisit(
  history: DiscoveryHistory,
  item: FrontierMediaItem,
  outcome: { watchedSeconds: number; completed: boolean; at?: string },
): DiscoveryHistory {
  const at = outcome.at || new Date().toISOString();
  const key = placeKey(item.location);

  const visit: DiscoveryVisit = {
    itemId: item.id,
    at,
    watchedSeconds: Math.max(0, Math.round(outcome.watchedSeconds)),
    completed: outcome.completed,
    provider: item.provider,
    channel: item.channel,
    placeKey: key,
  };

  const places = { ...history.places };
  if (key) {
    const loc = item.location;
    const existing = places[key];
    const displayName = loc?.displayName || loc?.regionName || 'Unnamed location';
    places[key] = existing
      ? { ...existing, visits: existing.visits + 1, lastVisitedAt: at }
      : {
        key,
        displayName,
        latitude: loc && isPlottable(loc) ? loc.latitude : undefined,
        longitude: loc && isPlottable(loc) ? loc.longitude : undefined,
        accuracy: loc?.accuracy || 'unknown',
        visits: 1,
        firstVisitedAt: at,
        lastVisitedAt: at,
      };
  }

  return {
    version: 1,
    visits: [visit, ...history.visits].slice(0, MAX_VISITS),
    places,
  };
}

export function recentIds(history: DiscoveryHistory, limit = 120): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of history.visits) {
    if (seen.has(v.itemId)) continue;
    seen.add(v.itemId);
    out.push(v.itemId);
    if (out.length >= limit) break;
  }
  return out;
}

export function visitedPlaces(history: DiscoveryHistory): VisitedPlace[] {
  return Object.values(history.places).sort((a, b) => b.visits - a.visits);
}

export function passportTotals(history: DiscoveryHistory, savedCount: number) {
  return {
    placesVisited: Object.keys(history.places).length,
    saved: savedCount,
    discoveries: new Set(history.visits.map((v) => v.itemId)).size,
  };
}

/**
 * Per-item behavioural signal, fed back into the shuffle engine's quality
 * weighting. This is content quality measurement, not personalisation: it
 * cannot narrow what someone is shown towards what they already watched, only
 * demote assets that nobody stays for.
 */
export interface ItemHealthLocal {
  plays: number;
  earlyLeaves: number;
  completions: number;
  totalWatchedSeconds: number;
  failures: number;
}

export type LocalHealthMap = Record<string, ItemHealthLocal>;

export const EARLY_LEAVE_SECONDS = 5;

export function applyOutcome(
  map: LocalHealthMap,
  itemId: string,
  outcome: { watchedSeconds: number; completed: boolean; failed?: boolean },
): LocalHealthMap {
  const prev = map[itemId] || { plays: 0, earlyLeaves: 0, completions: 0, totalWatchedSeconds: 0, failures: 0 };
  return {
    ...map,
    [itemId]: {
      plays: prev.plays + 1,
      earlyLeaves: prev.earlyLeaves + (!outcome.completed && outcome.watchedSeconds < EARLY_LEAVE_SECONDS ? 1 : 0),
      completions: prev.completions + (outcome.completed ? 1 : 0),
      totalWatchedSeconds: prev.totalWatchedSeconds + Math.max(0, outcome.watchedSeconds),
      failures: prev.failures + (outcome.failed ? 1 : 0),
    },
  };
}

/** Merge local behaviour into catalog health so the engine sees one view. */
export function mergeHealth(items: FrontierMediaItem[], map: LocalHealthMap): FrontierMediaItem[] {
  if (!map || Object.keys(map).length === 0) return items;
  return items.map((item) => {
    const local = map[item.id];
    if (!local || local.plays < 2) return item;
    return {
      ...item,
      health: {
        ...(item.health || { productionEligible: true }),
        earlyShuffleRate: Number((local.earlyLeaves / local.plays).toFixed(3)),
        completionRate: Number((local.completions / local.plays).toFixed(3)),
        averageWatchSeconds: Number((local.totalWatchedSeconds / local.plays).toFixed(1)),
        startupFailureRate: Number((local.failures / local.plays).toFixed(3)),
        engagementScore: Number(Math.max(0, Math.min(1, local.completions / local.plays)).toFixed(3)),
      },
    };
  });
}

export { EMPTY_HISTORY };
