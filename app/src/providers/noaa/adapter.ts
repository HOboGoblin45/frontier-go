import type { FrontierMediaItem, FrontierChannel } from '../../core/types/media';
import { rightsAreClear } from '../../core/types/rights';
import type { FetchOptions, FrontierProviderAdapter, RawProviderItem } from '../types';
import { getJson, stripHtml } from '../types';
import { noaaRights, noaaSafety, NOAA_ORGANIZATION, NOAA_RIGHTS_URL } from './rights';
import { resolveNoaaEnvironment, resolveNoaaLocation, extractDepthMeters } from './geo';

/**
 * NOAA Ocean Exploration.
 *
 * Their site is WordPress and exposes a full REST API, which is the difference
 * between a scraper and an integration: every video attachment carries real
 * `media_details` (duration, bitrate, dimensions, codec), a parent Multimedia
 * post carries the human title, caption and credit line, and that post links to
 * the Expedition it came from and to `dive` / `topic` taxonomies.
 *
 * So the pipeline reads the video attachments first (one query, properly
 * paginated) and then hydrates upward, rather than crawling 4,600 posts to find
 * the 300-odd that are video.
 */

const API = 'https://oceanexplorer.noaa.gov/wp-json/wp/v2';

interface WpMedia {
  id: number; post: number | null; date: string; source_url: string; mime_type: string;
  link?: string;
  title?: { rendered?: string };
  media_details?: {
    bitrate?: number; filesize?: number; length?: number; width?: number; height?: number;
    codec?: string; mime_type?: string;
  };
}

interface WpMultimedia {
  id: number; date: string; link: string; featured_media: number;
  title: { rendered: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  dive?: number[]; topic?: number[];
  acf?: {
    type?: string;
    credit?: string;
    track?: number | false | null;
    video?: Array<{ 'video-file'?: number; resolution?: string }> | false | null;
    relationships?: number[] | false | null;
  };
}

interface WpExpedition {
  id: number; slug: string; link: string;
  title: { rendered: string };
  location?: number[];
}

interface WpTerm { id: number; name: string; slug: string }

export interface NoaaRawItem extends RawProviderItem {
  media: WpMedia;
  /** Other resolutions of the same footage, so we can pick the best one. */
  siblings: WpMedia[];
  post: WpMultimedia | null;
  expedition: WpExpedition | null;
  topicNames: string[];
  diveNames: string[];
  oceanBasinNames: string[];
  posterUrl?: string;
  captionsUrl?: string;
  fetchedAt: string;
}

/**
 * Page until the API stops returning rows.
 *
 * Stopping early on a short page looked reasonable and cost most of the
 * catalog: this endpoint routinely returns 91 rows for `per_page=100` (some
 * attachments in the window are not exposed), so "short page" is not the same
 * thing as "last page". Only an empty page ends the walk.
 */
async function pagedGet<T>(url: string, pages: number, opts: FetchOptions): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= pages; page += 1) {
    // Past the last page WordPress answers 400, not an empty list. That is the
    // end of the walk, not a failure, so it is not retried or logged as one.
    const batch = await getJson<T[]>(`${url}&page=${page}`, { fetchImpl: opts.fetchImpl, retries: 0 })
      ?? await getJson<T[]>(`${url}&page=${page}`, { fetchImpl: opts.fetchImpl, retries: 1 });
    if (!batch || batch.length === 0) break;
    out.push(...batch);
  }
  return out;
}

/** Chunked `include=` lookups, so one id list does not become one request each. */
async function getByIds<T extends { id: number }>(
  path: string, ids: number[], fields: string, opts: FetchOptions,
): Promise<Map<number, T>> {
  const map = new Map<number, T>();
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const url = `${API}/${path}?include=${chunk.join(',')}&per_page=${chunk.length}&_fields=${fields}`;
    const rows = await getJson<T[]>(url, { fetchImpl: opts.fetchImpl, logger: opts.logger });
    for (const row of rows || []) map.set(row.id, row);
  }
  return map;
}

/**
 * NOAA publishes the same clip at several resolutions. Prefer the largest that
 * still streams comfortably on a phone: 1080p is the ceiling, and a file whose
 * bitrate is implausibly high for its size is passed over.
 */
export function pickBestRendition(candidates: WpMedia[]): WpMedia | null {
  const usable = candidates.filter((m) => {
    const d = m.media_details;
    return !!m.source_url && !!d && (d.width ?? 0) >= 640 && (d.height ?? 0) >= 360;
  });
  if (usable.length === 0) return null;
  const scored = usable.map((m) => {
    const w = m.media_details?.width ?? 0;
    const bitrate = m.media_details?.bitrate ?? 0;
    // 1920 is ideal; anything wider is downweighted, not excluded.
    const widthScore = w <= 1920 ? w / 1920 : 1920 / w;
    const bitratePenalty = bitrate > 12_000_000 ? 0.5 : 1;
    return { m, score: widthScore * bitratePenalty };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].m;
}

export class NoaaOceanExplorationAdapter implements FrontierProviderAdapter {
  readonly provider = 'noaa_ocean_exploration' as const;
  readonly organization = NOAA_ORGANIZATION;
  readonly rightsUrl = NOAA_RIGHTS_URL;

  async fetchItems(opts: FetchOptions = {}): Promise<NoaaRawItem[]> {
    const log = opts.logger;
    const limit = opts.limit ?? 600;
    const fetchedAt = new Date().toISOString();

    // Roughly one usable video post per two attachments, so ask for plenty.
    const maxPages = Math.max(2, Math.ceil((limit * 2.5) / 100));
    const media = await pagedGet<WpMedia>(
      `${API}/media?mime_type=video/mp4&per_page=100&orderby=date&order=desc`
      + `&_fields=id,post,date,source_url,mime_type,link,title,media_details`,
      maxPages, opts,
    );
    log?.info(`NOAA: ${media.length} video attachments`);

    const byPost = new Map<number, WpMedia[]>();
    for (const m of media) {
      if (!m.post) continue;
      const list = byPost.get(m.post) || [];
      list.push(m);
      byPost.set(m.post, list);
    }

    const posts = await getByIds<WpMultimedia>(
      'multimedia', [...byPost.keys()],
      'id,date,link,title,excerpt,content,featured_media,dive,topic,acf', opts,
    );
    log?.info(`NOAA: ${posts.size} parent multimedia posts`);

    const expeditionIds: number[] = [];
    const posterIds: number[] = [];
    const trackIds: number[] = [];
    for (const p of posts.values()) {
      const rel = Array.isArray(p.acf?.relationships) ? p.acf!.relationships as number[] : [];
      if (rel[0]) expeditionIds.push(rel[0]);
      if (p.featured_media) posterIds.push(p.featured_media);
      const t = p.acf?.track;
      if (typeof t === 'number' && t > 0) trackIds.push(t);
    }

    const [expeditions, posters, tracks, topicTerms, diveTerms, locationTerms] = await Promise.all([
      getByIds<WpExpedition>('expedition', expeditionIds, 'id,slug,link,title,location', opts),
      getByIds<WpMedia>('media', posterIds, 'id,source_url,media_details,mime_type', opts),
      getByIds<WpMedia>('media', trackIds, 'id,source_url,mime_type', opts),
      getJson<WpTerm[]>(`${API}/topic?per_page=100&_fields=id,name,slug`, { fetchImpl: opts.fetchImpl }),
      getJson<WpTerm[]>(`${API}/dive?per_page=100&_fields=id,name,slug`, { fetchImpl: opts.fetchImpl }),
      getJson<WpTerm[]>(`${API}/location?per_page=100&_fields=id,name,slug`, { fetchImpl: opts.fetchImpl }),
    ]);

    const topicById = new Map((topicTerms || []).map((t) => [t.id, stripHtml(t.name)]));
    const diveById = new Map((diveTerms || []).map((t) => [t.id, t.name]));
    const locationById = new Map((locationTerms || []).map((t) => [t.id, t.name]));

    const raws: NoaaRawItem[] = [];
    for (const [postId, group] of byPost.entries()) {
      const post = posts.get(postId) || null;
      if (!post || post.acf?.type !== 'video') continue;

      const best = pickBestRendition(group);
      if (!best) continue;

      const rel = Array.isArray(post.acf?.relationships) ? post.acf!.relationships as number[] : [];
      const expedition = rel[0] ? expeditions.get(rel[0]) || null : null;
      const poster = post.featured_media ? posters.get(post.featured_media) : undefined;
      const trackId = typeof post.acf?.track === 'number' ? post.acf.track : undefined;
      const track = trackId ? tracks.get(trackId) : undefined;

      raws.push({
        media: best,
        siblings: group.filter((m) => m.id !== best.id),
        post,
        expedition,
        topicNames: (post.topic || []).map((id) => topicById.get(id)).filter((x): x is string => !!x),
        diveNames: (post.dive || []).map((id) => diveById.get(id)).filter((x): x is string => !!x),
        oceanBasinNames: (expedition?.location || []).map((id) => locationById.get(id)).filter((x): x is string => !!x),
        posterUrl: poster?.source_url,
        captionsUrl: track?.mime_type === 'text/vtt' ? track.source_url : undefined,
        fetchedAt,
      });
      if (raws.length >= limit) break;
    }

    log?.info(`NOAA: ${raws.length} video items assembled`);
    return raws;
  }

  normalize(raw: RawProviderItem): FrontierMediaItem | null {
    const r = raw as NoaaRawItem;
    const post = r.post;
    if (!post || !r.media?.source_url) return null;

    const title = stripHtml(post.title?.rendered) || stripHtml(r.media.title?.rendered);
    if (!title) return null;

    const description = stripHtml(post.excerpt?.rendered) || stripHtml(post.content?.rendered);
    const credit = stripHtml(post.acf?.credit);
    const d = r.media.media_details || {};
    const expeditionTitle = r.expedition ? stripHtml(r.expedition.title.rendered) : undefined;

    const location = resolveNoaaLocation({
      expeditionTitle,
      multimediaTitle: title,
      description,
      credit,
      oceanBasinNames: r.oceanBasinNames,
    });
    const depth = location.depthMeters ?? extractDepthMeters(description);
    const tags = [...new Set([...r.topicNames, ...r.diveNames])];
    const environment = resolveNoaaEnvironment(depth, title, description, r.topicNames);

    const rights = noaaRights(credit, `${description} ${title}`, r.fetchedAt);
    const safety = noaaSafety(title, description, tags);

    const durationSeconds = typeof d.length === 'number' && d.length > 0 ? d.length : undefined;
    const publishedAt = post.date ? new Date(post.date).toISOString() : undefined;

    // Secondary channels: deep-sea footage that is also a shipwreck belongs in
    // Archives too, without leaving Deep Sea.
    const channels: FrontierChannel[] = ['deep_sea'];
    const blob = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
    if (/(shipwreck|wreck|maritime heritage|schooner|steamer)/.test(blob)) channels.push('archives');
    if (environment === 'surface_vessel' || /(technology|mapping|sonar|rov |auv|sensor)/.test(blob)) {
      channels.push('field_science');
    }

    return {
      id: `noaa:${post.id}:${r.media.id}`,
      provider: this.provider,
      providerAssetId: String(r.media.id),
      title,
      subtitle: expeditionTitle,
      description: description || undefined,
      stream: {
        url: r.media.source_url,
        type: 'mp4',
        fallbackUrl: r.siblings.find((s) => (s.media_details?.width ?? 0) < (d.width ?? 0))?.source_url,
        mimeType: r.media.mime_type || 'video/mp4',
        bitrate: d.bitrate,
        width: d.width,
        height: d.height,
        durationSeconds,
      },
      imagery: { posterUrl: r.posterUrl, thumbnailUrl: r.posterUrl },
      temporal: { publishedAt, capturedAt: publishedAt },
      channel: 'deep_sea',
      channels,
      tags,
      environment,
      availability: 'on_demand',
      location,
      source: {
        organization: NOAA_ORGANIZATION,
        assetUrl: post.link,
        metadataUrl: `${API}/multimedia/${post.id}`,
        expedition: expeditionTitle,
        // Only when the provider names the ship. NOAA's `EX####` codes do
        // denote Okeanos Explorer cruises, but deriving a vessel from a code
        // prefix is an inference, and provenance shown in this app is only
        // ever what the source actually said.
        vessel: /okeanos/i.test(`${expeditionTitle || ''} ${credit}`) ? 'NOAA Ship Okeanos Explorer' : undefined,
      },
      rights,
      safety,
      captionsUrl: r.captionsUrl,
      ranking: { contentQuality: 0, freshness: 0, baseWeight: 1 },
    };
  }

  validateRights(item: FrontierMediaItem): boolean {
    return rightsAreClear(item.rights);
  }
}

export const noaaAdapter = new NoaaOceanExplorationAdapter();
