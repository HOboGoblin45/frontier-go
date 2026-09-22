import type { FrontierCatalog, FrontierMediaItem } from '../types/media';
import type { FrontierProviderAdapter, IngestLogger } from '../../providers/types';
import { evaluateEligibility } from './eligibility';
import { withRanking } from './quality';
import { collapseDuplicates } from './dedupe';
import { rightsAreClear } from '../types/rights';
import { safetyIsClear } from '../types/safety';

/**
 * The ingestion pipeline:
 *
 *   providers -> normalise -> rights -> safety -> quality -> dedupe -> health
 *   -> catalog
 *
 * Every stage is counted, and the counts ship inside the catalog file. A run
 * that quietly drops 80% of the archive should be visible in a diff, not
 * discovered three releases later.
 */

export const CATALOG_VERSION = 1;

/**
 * Simultaneous HEAD requests during the health pass. Eight is brisk against a
 * CDN and nowhere near enough to look like abuse of a public agency endpoint.
 */
const PROBE_CONCURRENCY = 8;

/** Bounded-parallel map that preserves input order. */
async function mapWithConcurrency<T, R>(
  input: readonly T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(input.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, input.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= input.length) return;
      results[i] = await fn(input[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface StreamProbe {
  (url: string): Promise<{ ok: boolean; status?: number; bytes?: number; contentType?: string }>;
}

export interface PipelineOptions {
  adapters: FrontierProviderAdapter[];
  limitPerProvider?: number;
  logger?: IngestLogger;
  fetchImpl?: typeof fetch;
  /** Optional HEAD check. Skipped in tests; run for real in CI. */
  probe?: StreamProbe;
  now?: number;
}

const emptyStats = (): FrontierCatalog['stats'] => ({
  fetched: 0, normalized: 0, rightsRejected: 0, safetyRejected: 0,
  qualityRejected: 0, duplicatesCollapsed: 0, published: 0,
  byProvider: {}, byChannel: {},
});

export interface PipelineResult {
  catalog: FrontierCatalog;
  /** Items rejected, with reasons, for the rights-review document. */
  rejected: Array<{ id: string; title: string; provider: string; reasons: string[] }>;
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const log = opts.logger;
  const now = opts.now ?? Date.now();
  const stats = emptyStats();
  const rejected: PipelineResult['rejected'] = [];

  const normalized: FrontierMediaItem[] = [];

  for (const adapter of opts.adapters) {
    const raws = await adapter.fetchItems({
      limit: opts.limitPerProvider,
      logger: log,
      fetchImpl: opts.fetchImpl,
    });
    stats.fetched += raws.length;

    for (const raw of raws) {
      const item = adapter.normalize(raw);
      if (!item) continue;
      const ranked = withRanking(item, now);
      normalized.push(ranked);
    }
  }
  stats.normalized = normalized.length;
  log?.info(`normalised ${normalized.length} items from ${opts.adapters.length} providers`);

  // Rights, then safety, then quality — in that order, so a rejection reason
  // reads as the first thing that actually disqualified the item.
  const afterRights = normalized.filter((item) => {
    if (rightsAreClear(item.rights)) return true;
    stats.rightsRejected += 1;
    rejected.push({
      id: item.id, title: item.title, provider: item.provider,
      reasons: [`rights:${item.rights.classification}`, item.rights.basis || ''].filter(Boolean),
    });
    return false;
  });

  const afterSafety = afterRights.filter((item) => {
    if (safetyIsClear(item.safety)) return true;
    stats.safetyRejected += 1;
    const flags = Object.entries(item.safety).filter(([, v]) => v === true).map(([k]) => `safety:${k}`);
    rejected.push({ id: item.id, title: item.title, provider: item.provider, reasons: flags });
    return false;
  });

  const afterQuality = afterSafety.filter((item) => {
    const { eligible, reasons } = evaluateEligibility(item);
    if (eligible) return true;
    stats.qualityRejected += 1;
    rejected.push({ id: item.id, title: item.title, provider: item.provider, reasons });
    return false;
  });

  const { kept, collapsed } = collapseDuplicates(afterQuality);
  stats.duplicatesCollapsed = collapsed;

  // Health: confirm the stream is actually there before publishing it.
  //
  // Probed in parallel, folded in order. One HEAD per item is a few hundred
  // milliseconds; serially that is most of an hour once the catalog is a few
  // thousand items, and the scheduled ingest has to finish. The fold is kept
  // sequential so the published order, the counters and the rejection log do
  // not depend on which response came back first.
  const probeResults = opts.probe
    ? await mapWithConcurrency(kept, PROBE_CONCURRENCY, (item) => opts.probe!(item.stream.url))
    : null;

  const published: FrontierMediaItem[] = [];
  kept.forEach((item, index) => {
    const health = {
      ...(item.health || {}),
      lastValidatedAt: new Date(now).toISOString(),
      productionEligible: true,
    } as NonNullable<FrontierMediaItem['health']>;

    const res = probeResults?.[index];
    if (res) {
      health.streamReachable = res.ok;
      if (!res.ok) {
        health.productionEligible = false;
        health.eligibilityNotes = [`stream unreachable (HTTP ${res.status ?? 'error'})`];
        stats.qualityRejected += 1;
        rejected.push({
          id: item.id, title: item.title, provider: item.provider,
          reasons: [`health:unreachable:${res.status ?? 'error'}`],
        });
        return;
      }
      if (typeof res.bytes === 'number' && res.bytes > 0) {
        // Recompute bitrate from what the CDN actually serves, which is more
        // reliable than the provider's stated figure for a transcoded file.
        const d = item.stream.durationSeconds;
        if (d && d > 0) item.stream.bitrate = Math.round((res.bytes * 8) / d);
      }
    }

    published.push({ ...item, health });
    stats.byProvider[item.provider] = (stats.byProvider[item.provider] || 0) + 1;
    stats.byChannel[item.channel] = (stats.byChannel[item.channel] || 0) + 1;
  });

  stats.published = published.length;
  log?.info(`published ${published.length} items`);

  return {
    catalog: {
      version: CATALOG_VERSION,
      generatedAt: new Date(now).toISOString(),
      stats,
      items: published.sort((a, b) => a.id.localeCompare(b.id)),
    },
    rejected,
  };
}
