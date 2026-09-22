import type { FrontierMediaItem } from '../types/media';

/**
 * Quality scoring. Rights-clean is the floor, not the bar — a legally perfect
 * 12-second 360p clip of a black water column is still not worth anyone's
 * attention. Everything here is computed from metadata the provider actually
 * published; nothing is inferred from the pixels, because that would need an
 * AI pass and this must not depend on one to ship.
 */

const IDEAL_MIN_SECONDS = 25;
const IDEAL_MAX_SECONDS = 8 * 60;

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

/** 0..1 — resolution, bitrate sanity and duration band. */
export function technicalQualityScore(item: FrontierMediaItem): number {
  const s = item.stream;
  let score = 0;

  const height = s.height ?? 0;
  if (height >= 1080) score += 0.4;
  else if (height >= 720) score += 0.32;
  else if (height >= 480) score += 0.18;
  else if (height >= 360) score += 0.08;

  const bitrate = s.bitrate ?? 0;
  if (bitrate >= 2_000_000 && bitrate <= 12_000_000) score += 0.25;
  else if (bitrate > 0) score += 0.12;
  else score += 0.1; // unknown bitrate is not evidence of bad bitrate

  const d = s.durationSeconds ?? 0;
  if (d >= IDEAL_MIN_SECONDS && d <= IDEAL_MAX_SECONDS) score += 0.35;
  else if (d > 0) {
    const distance = d < IDEAL_MIN_SECONDS
      ? (IDEAL_MIN_SECONDS - d) / IDEAL_MIN_SECONDS
      : Math.min(1, (d - IDEAL_MAX_SECONDS) / (IDEAL_MAX_SECONDS * 2));
    score += 0.35 * (1 - distance);
  }

  return clamp01(score);
}

/** 0..1 — how much the item can actually tell the viewer about where they are. */
export function metadataCompleteness(item: FrontierMediaItem): number {
  let score = 0;
  if (item.description && item.description.length >= 60) score += 0.25;
  else if (item.description) score += 0.12;
  if (item.imagery.posterUrl || item.imagery.thumbnailUrl) score += 0.15;
  if (item.location && item.location.type !== 'unknown') score += 0.2;
  if (item.location?.accuracy === 'exact' || item.location?.accuracy === 'approximate' || item.location?.accuracy === 'site') score += 0.1;
  if (item.tags.length >= 2) score += 0.1;
  if (item.source.expedition || item.source.mission) score += 0.1;
  if (item.captionsUrl) score += 0.1;
  return clamp01(score);
}

/** 0..1 — decays over roughly a decade; archives are never zeroed out. */
export function freshnessScore(item: FrontierMediaItem, now = Date.now()): number {
  const iso = item.temporal.capturedAt || item.temporal.publishedAt;
  if (!iso) return 0.4;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0.4;
  const years = (now - t) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return 1;
  return clamp01(0.15 + 0.85 * Math.exp(-years / 6));
}

/**
 * Editorial base weight. Archive material is wonderful and should not dominate;
 * a mission-level location is less of a "place" than a coordinate, so it is
 * nudged down rather than excluded.
 */
export function baseWeight(item: FrontierMediaItem): number {
  let w = 1;
  if (item.channel === 'archives') w *= 0.75;
  if (item.location?.accuracy === 'mission') w *= 0.9;
  if (item.location?.type === 'unknown') w *= 0.7;
  if (item.environment === 'laboratory') w *= 0.8;
  return Number(w.toFixed(3));
}

/** Fills `ranking` in place-free fashion, returning a new item. */
export function withRanking(item: FrontierMediaItem, now = Date.now()): FrontierMediaItem {
  const technical = technicalQualityScore(item);
  const completeness = metadataCompleteness(item);
  const contentQuality = clamp01(technical * 0.6 + completeness * 0.4);
  return {
    ...item,
    ranking: {
      contentQuality: Number(contentQuality.toFixed(3)),
      freshness: Number(freshnessScore(item, now).toFixed(3)),
      baseWeight: baseWeight(item),
      duplicateGroupId: item.ranking?.duplicateGroupId,
    },
    health: {
      ...(item.health || { productionEligible: false }),
      technicalQualityScore: Number(technical.toFixed(3)),
    },
  };
}
