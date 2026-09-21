import type { FrontierMediaItem, MediaProvider } from '../core/types/media';

/** Anything a provider hands back before normalisation. */
export type RawProviderItem = Record<string, unknown>;

export interface IngestLogger {
  info(msg: string, extra?: unknown): void;
  warn(msg: string, extra?: unknown): void;
}

export interface FetchOptions {
  /** Hard ceiling on items pulled, so a bad run cannot walk an entire archive. */
  limit?: number;
  logger?: IngestLogger;
  /** Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
}

/**
 * Every source implements exactly this. Nothing downstream of `normalize` knows
 * which provider an item came from, which is what keeps NOAA-shaped assumptions
 * out of the player and the globe.
 */
export interface FrontierProviderAdapter {
  readonly provider: MediaProvider;
  readonly organization: string;
  readonly rightsUrl: string;
  fetchItems(opts?: FetchOptions): Promise<RawProviderItem[]>;
  normalize(raw: RawProviderItem): FrontierMediaItem | null;
  validateRights(item: FrontierMediaItem): boolean;
}

export const DEFAULT_USER_AGENT = 'FrontierGo-Ingest/1.0 (+https://github.com/HOboGoblin45/trailer-roulette-ios)';

/** Small helper: JSON GET with retry, used by every adapter. */
export async function getJson<T>(
  url: string,
  opts: { fetchImpl?: typeof fetch; retries?: number; logger?: IngestLogger } = {},
): Promise<T | null> {
  const f = opts.fetchImpl ?? fetch;
  const retries = opts.retries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await f(url, { headers: { accept: 'application/json', 'user-agent': DEFAULT_USER_AGENT } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) {
        opts.logger?.warn(`GET failed after ${retries + 1} attempts: ${url}`, err);
        return null;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

/** Strip WordPress-rendered HTML down to plain text. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;|&#215;/g, '-')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
