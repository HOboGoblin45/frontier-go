import type { FrontierLocation, FrontierEnvironment } from './location';
import type { FrontierRightsMetadata } from './rights';
import type { FrontierSafetyMetadata } from './safety';

/**
 * The canonical content model. Every provider normalises into this shape and
 * nothing downstream — shuffle, globe, player, passport — knows which provider
 * an item came from beyond the `provider` tag it carries for provenance.
 */

export type MediaProvider = 'noaa_ocean_exploration' | 'nasa' | 'nps' | 'usgs' | 'dvids' | 'loc' | 'archives';

export type FrontierChannel = 'everything' | 'deep_sea' | 'space' | 'wild_earth' | 'field_science' | 'archives' | 'live';

export type StreamType = 'hls' | 'mp4';

export type Availability = 'on_demand' | 'live';

export interface FrontierStream {
  url: string;
  type: StreamType;
  fallbackUrl?: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface FrontierImagery {
  thumbnailUrl?: string;
  posterUrl?: string;
}

export interface FrontierTemporal {
  capturedAt?: string;
  publishedAt?: string;
}

export interface FrontierSource {
  organization: string;
  assetUrl?: string;
  metadataUrl?: string;
  expedition?: string;
  mission?: string;
  vessel?: string;
}

export interface FrontierHealthMetadata {
  lastValidatedAt?: string;
  streamReachable?: boolean;
  startupFailureRate?: number;
  medianStartupMs?: number;
  earlyShuffleRate?: number;
  averageWatchSeconds?: number;
  completionRate?: number;
  duplicateGroupId?: string;
  technicalQualityScore?: number;
  visualInterestScore?: number;
  engagementScore?: number;
  productionEligible: boolean;
  /** Why the item is (or is not) eligible. Written by the pipeline. */
  eligibilityNotes?: string[];
}

export interface FrontierRankingMetadata {
  /** 0..1 — technical + metadata completeness, computed at ingest. */
  contentQuality: number;
  /** 0..1 — how recently the footage was captured or published. */
  freshness: number;
  /** 0..1 — editorial weight; lets one provider or topic be dialled back. */
  baseWeight: number;
  /** Used to suppress near-duplicates within a session. */
  duplicateGroupId?: string;
}

export interface FrontierMediaItem {
  id: string;
  provider: MediaProvider;
  providerAssetId: string;
  title: string;
  subtitle?: string;
  description?: string;
  stream: FrontierStream;
  imagery: FrontierImagery;
  temporal: FrontierTemporal;
  channel: FrontierChannel;
  /** Secondary channels this item also belongs to. `channel` is its primary. */
  channels?: FrontierChannel[];
  tags: string[];
  environment: FrontierEnvironment;
  availability: Availability;
  location?: FrontierLocation;
  source: FrontierSource;
  rights: FrontierRightsMetadata;
  safety: FrontierSafetyMetadata;
  ranking: FrontierRankingMetadata;
  health?: FrontierHealthMetadata;
  /** Optional WebVTT captions, when the provider publishes them. */
  captionsUrl?: string;
}

export interface FrontierCatalog {
  version: number;
  generatedAt: string;
  /** Counts by stage, so a shrinking catalog is visible rather than silent. */
  stats: {
    fetched: number;
    normalized: number;
    rightsRejected: number;
    safetyRejected: number;
    qualityRejected: number;
    duplicatesCollapsed: number;
    published: number;
    byProvider: Record<string, number>;
    byChannel: Record<string, number>;
  };
  items: FrontierMediaItem[];
}

export const ALL_CHANNELS: ReadonlyArray<FrontierChannel> = [
  'everything', 'deep_sea', 'space', 'wild_earth', 'field_science', 'archives', 'live',
];

export const CHANNEL_LABELS: Readonly<Record<FrontierChannel, string>> = Object.freeze({
  everything: 'Everything',
  deep_sea: 'Deep Sea',
  space: 'Space',
  wild_earth: 'Wild Earth',
  field_science: 'Field Science',
  archives: 'Archives',
  live: 'Live',
});

export const PROVIDER_LABELS: Readonly<Record<MediaProvider, string>> = Object.freeze({
  noaa_ocean_exploration: 'NOAA Ocean Exploration',
  nasa: 'NASA',
  nps: 'National Park Service',
  usgs: 'USGS',
  dvids: 'DVIDS',
  loc: 'Library of Congress',
  archives: 'National Archives',
});

/** True when the item belongs to the given channel. `everything` matches all. */
export function inChannel(item: FrontierMediaItem, channel: FrontierChannel): boolean {
  if (channel === 'everything') return true;
  if (item.channel === channel) return true;
  return !!item.channels && item.channels.includes(channel);
}
