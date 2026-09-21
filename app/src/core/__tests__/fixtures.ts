import type { FrontierMediaItem, FrontierChannel, MediaProvider } from '../types/media';
import type { FrontierEnvironment, FrontierLocation } from '../types/location';
import { SAFE_DEFAULTS } from '../types/safety';

export function makeItem(overrides: Partial<FrontierMediaItem> & { id: string }): FrontierMediaItem {
  const location: FrontierLocation = overrides.location ?? {
    type: 'underwater', latitude: 0, longitude: -160, accuracy: 'region',
    displayName: 'Pacific Ocean', regionName: 'Pacific Ocean',
  };
  return {
    provider: 'noaa_ocean_exploration' as MediaProvider,
    providerAssetId: overrides.id,
    title: `Item ${overrides.id}`,
    stream: {
      url: `https://example.gov/${overrides.id}.mp4`,
      type: 'mp4',
      width: 1920, height: 1080, bitrate: 3_000_000, durationSeconds: 90,
    },
    imagery: { posterUrl: `https://example.gov/${overrides.id}.jpg` },
    temporal: { publishedAt: '2026-01-01T00:00:00.000Z' },
    channel: 'deep_sea' as FrontierChannel,
    tags: ['Corals'],
    environment: 'deep_ocean' as FrontierEnvironment,
    availability: 'on_demand',
    source: { organization: 'NOAA Ocean Exploration' },
    rights: {
      classification: 'government_work',
      commercialUseAllowed: true,
      attributionRequired: true,
      attributionText: 'NOAA Ocean Exploration',
    },
    safety: { ...SAFE_DEFAULTS },
    ranking: { contentQuality: 0.8, freshness: 0.8, baseWeight: 1 },
    ...overrides,
    location,
  };
}

/** Deterministic RNG so shuffle tests assert behaviour, not luck. */
export function seededRandom(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
