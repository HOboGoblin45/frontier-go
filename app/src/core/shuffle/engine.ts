import type { FrontierMediaItem, FrontierChannel, MediaProvider } from '../types/media';
import { inChannel } from '../types/media';
import { locationSeparation } from '../util/geo';
import { evaluateEligibility } from '../catalog/eligibility';
import { matchesConstraint, type ExplorationConstraint } from './constraint';

/**
 * The shuffle engine.
 *
 * The question it answers is "where should we take the viewer next", which is
 * not the same question as "which asset id comes next". Five consecutive
 * jellyfish is a correct answer to the second question and a failure of the
 * product, so distance — geographic, environmental, and topical — is scored
 * explicitly rather than left to chance.
 */

export interface ShuffleContext {
  channel: FrontierChannel;
  /** Ids played in this session, oldest first. Hard-excluded while any remain. */
  sessionPlayedIds: readonly string[];
  /** Ids played in previous sessions, most recent first. Softly penalised. */
  recentlyPlayedIds?: readonly string[];
  /** What we are jumping away from. Drives the contrast terms. */
  lastItem?: FrontierMediaItem | null;
  constraint?: ExplorationConstraint | null;
  /** Injected for deterministic tests. */
  random?: () => number;
}

export interface ScoredItem {
  item: FrontierMediaItem;
  score: number;
  terms: Record<string, number>;
}

const RECENT_MEMORY = 120;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** 0.45..1.35 — content that is technically good and holds attention. */
export function qualityWeight(item: FrontierMediaItem): number {
  const base = clamp(item.ranking?.contentQuality ?? 0.5, 0, 1);
  const h = item.health;
  let behavioural = 1;
  if (h) {
    if (typeof h.earlyShuffleRate === 'number') {
      // If nearly everyone leaves in the first few seconds, stop sending them.
      behavioural *= clamp(1.15 - h.earlyShuffleRate * 1.1, 0.25, 1.15);
    }
    if (typeof h.completionRate === 'number') {
      behavioural *= clamp(0.8 + h.completionRate * 0.45, 0.8, 1.25);
    }
    if (typeof h.startupFailureRate === 'number' && h.startupFailureRate > 0.15) {
      behavioural *= clamp(1 - h.startupFailureRate, 0.1, 1);
    }
  }
  return clamp((0.45 + base * 0.75) * behavioural, 0.05, 1.35);
}

/** 0.85..1.15 — a mild nudge towards newer footage, never a recency feed. */
export function freshnessWeight(item: FrontierMediaItem): number {
  return clamp(0.85 + (item.ranking?.freshness ?? 0.5) * 0.3, 0.85, 1.15);
}

/**
 * 0..1 — session repeats are excluded outright by the caller; this handles the
 * softer "you saw this two sessions ago" case.
 */
export function noveltyWeight(item: FrontierMediaItem, recent: readonly string[] | undefined): number {
  if (!recent || recent.length === 0) return 1;
  const idx = recent.indexOf(item.id);
  if (idx === -1) return 1;
  const depth = Math.min(idx, RECENT_MEMORY) / RECENT_MEMORY;
  return clamp(0.12 + depth * 0.88, 0.12, 1);
}

/** 0.6..1.4 — reward moving a long way from where we just were. */
export function geographicContrastWeight(item: FrontierMediaItem, last?: FrontierMediaItem | null): number {
  if (!last) return 1;
  const sep = locationSeparation(last.location, item.location);
  return clamp(0.6 + sep * 0.8, 0.6, 1.4);
}

/** 0.55..1.25 — a different kind of place, not just a different point. */
export function environmentContrastWeight(item: FrontierMediaItem, last?: FrontierMediaItem | null): number {
  if (!last) return 1;
  if (last.environment === 'unknown' || item.environment === 'unknown') return 1;
  return item.environment === last.environment ? 0.55 : 1.25;
}

/**
 * 0.5..1.2 — keeps one provider or one topic from taking over a session, using
 * only what the session itself has shown.
 */
export function sessionDiversityWeight(
  item: FrontierMediaItem,
  recentItems: readonly FrontierMediaItem[],
): number {
  if (recentItems.length === 0) return 1;
  const window = recentItems.slice(-5);
  const providerShare = window.filter((r) => r.provider === item.provider).length / window.length;
  const tagOverlap = window.filter((r) => r.tags.some((t) => item.tags.includes(t))).length / window.length;
  return clamp(1.2 - providerShare * 0.45 - tagOverlap * 0.35, 0.5, 1.2);
}

export function scoreItem(
  item: FrontierMediaItem,
  ctx: ShuffleContext,
  recentItems: readonly FrontierMediaItem[],
): ScoredItem {
  const terms = {
    base: clamp(item.ranking?.baseWeight ?? 1, 0.05, 3),
    quality: qualityWeight(item),
    freshness: freshnessWeight(item),
    novelty: noveltyWeight(item, ctx.recentlyPlayedIds),
    diversity: sessionDiversityWeight(item, recentItems),
    geographic: geographicContrastWeight(item, ctx.lastItem),
    environment: environmentContrastWeight(item, ctx.lastItem),
  };
  const score = Object.values(terms).reduce((a, b) => a * b, 1);
  return { item, score, terms };
}

/**
 * The eligible universe for a context: production-eligible, in-channel, inside
 * any active constraint, and not already seen this session.
 *
 * Session exclusion is dropped — and only then — when it would leave nothing to
 * play, because a channel that stops is worse than a channel that repeats.
 */
export function eligibleUniverse(
  items: readonly FrontierMediaItem[],
  ctx: ShuffleContext,
): { pool: FrontierMediaItem[]; exhausted: boolean } {
  const played = new Set(ctx.sessionPlayedIds);
  const inScope = items.filter((item) => (
    evaluateEligibility(item).eligible
    && (ctx.constraint?.kind === 'collection' || inChannel(item, ctx.channel))
    && matchesConstraint(item, ctx.constraint)
  ));
  const unseen = inScope.filter((item) => !played.has(item.id));
  if (unseen.length > 0) return { pool: unseen, exhausted: false };
  return { pool: inScope, exhausted: inScope.length > 0 };
}

/** Weighted sample without replacement. */
function drawWeighted(
  scored: ScoredItem[],
  count: number,
  random: () => number,
): FrontierMediaItem[] {
  const pool = [...scored];
  const out: FrontierMediaItem[] = [];
  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((sum, s) => sum + s.score, 0);
    if (total <= 0) {
      out.push(pool.splice(Math.floor(random() * pool.length), 1)[0].item);
      continue;
    }
    let target = random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      target -= pool[i].score;
      if (target <= 0) { idx = i; break; }
    }
    out.push(pool.splice(idx, 1)[0].item);
  }
  return out;
}

/**
 * Build the next `count` items. Each pick becomes the reference point for the
 * next one, so the deck is a route rather than a bag — the second item
 * contrasts with the first, not with whatever happened to play last.
 */
export function buildDeck(
  items: readonly FrontierMediaItem[],
  ctx: ShuffleContext,
  count = 6,
): FrontierMediaItem[] {
  const random = ctx.random ?? Math.random;
  const byId = new Map(items.map((i) => [i.id, i]));
  const recentItems = ctx.sessionPlayedIds
    .slice(-8)
    .map((id) => byId.get(id))
    .filter((x): x is FrontierMediaItem => !!x);

  const deck: FrontierMediaItem[] = [];
  const working: ShuffleContext = { ...ctx, sessionPlayedIds: [...ctx.sessionPlayedIds] };
  const trail = [...recentItems];

  for (let n = 0; n < count; n += 1) {
    const { pool } = eligibleUniverse(items, working);
    const fresh = pool.filter((p) => !deck.some((d) => d.id === p.id));
    const candidates = fresh.length > 0 ? fresh : pool;
    if (candidates.length === 0) break;

    const scored = candidates.map((item) => scoreItem(item, working, trail));
    const [picked] = drawWeighted(scored, 1, random);
    if (!picked) break;

    deck.push(picked);
    trail.push(picked);
    working.lastItem = picked;
    (working.sessionPlayedIds as string[]).push(picked.id);
  }

  return deck;
}

/** Providers present in a pool — used by the globe filters and diagnostics. */
export function providersIn(items: readonly FrontierMediaItem[]): MediaProvider[] {
  return [...new Set(items.map((i) => i.provider))];
}
