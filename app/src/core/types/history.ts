import type { FrontierChannel, MediaProvider } from './media';

/**
 * The Discovery Passport: a passive record of where the viewer has been. No
 * points, no streaks, no badges — it exists so the globe can show a personal
 * map, and so the shuffle engine can avoid repeating itself.
 */

export interface DiscoveryVisit {
  itemId: string;
  /** ISO-8601. */
  at: string;
  /** Seconds actually watched, as reported by the player at the time. */
  watchedSeconds: number;
  /** True when playback reached the end rather than being shuffled away. */
  completed: boolean;
  provider: MediaProvider;
  channel: FrontierChannel;
  /** Stable key for the place, so repeat visits collapse into one point. */
  placeKey?: string;
}

export interface VisitedPlace {
  key: string;
  displayName: string;
  latitude?: number;
  longitude?: number;
  /** 'region' | 'mission' | ... — carried through so the globe can style it. */
  accuracy: string;
  visits: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
}

export interface SavedDiscovery {
  itemId: string;
  savedAt: string;
  title: string;
  placeLabel: string;
  organization: string;
  thumbnailUrl?: string;
}

export interface DiscoveryHistory {
  version: number;
  visits: DiscoveryVisit[];
  places: Record<string, VisitedPlace>;
}

export const EMPTY_HISTORY: DiscoveryHistory = Object.freeze({
  version: 1,
  visits: [],
  places: {},
});
