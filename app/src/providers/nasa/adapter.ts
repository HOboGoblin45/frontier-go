import type { FrontierMediaItem, FrontierChannel } from '../../core/types/media';
import type { FrontierEnvironment, FrontierLocation } from '../../core/types/location';
import { UNKNOWN_LOCATION } from '../../core/types/location';
import { rightsAreClear } from '../../core/types/rights';
import type { FetchOptions, FrontierProviderAdapter, RawProviderItem } from '../types';
import { getJson } from '../types';
import { lookupNasaFacility, lookupOffEarth } from '../gazetteer';
import { NASA_ORGANIZATION, NASA_RIGHTS_URL, nasaRights, nasaSafety, looksLikeRealFootage } from './rights';

/**
 * NASA Image and Video Library.
 *
 * The search API returns metadata; the per-asset `collection.json` lists the
 * actual renditions and `metadata.json` carries the technical detail (duration,
 * frame size, bitrate) that the eligibility gate needs. All three are public
 * and documented, so nothing here is scraped.
 *
 * Queries are curated rather than open-ended. "Everything NASA has" is a
 * firehose of briefings and graphics packages; this list is the set of subjects
 * that are actually a window into somewhere.
 */

const SEARCH = 'https://images-api.nasa.gov/search';
const ASSETS = 'https://images-assets.nasa.gov/video';

export const NASA_QUERIES: Array<{ q: string; channel: FrontierChannel; tags: string[] }> = [
  { q: 'Earth views from the International Space Station', channel: 'space', tags: ['ISS', 'Earth from orbit'] },
  { q: 'spacewalk EVA astronaut', channel: 'space', tags: ['EVA', 'Spacewalk'] },
  { q: 'aurora from space station', channel: 'space', tags: ['Aurora', 'Earth from orbit'] },
  { q: 'rocket engine test fire Stennis', channel: 'field_science', tags: ['Propulsion', 'Engine test'] },
  { q: 'launch liftoff Kennedy Space Center', channel: 'space', tags: ['Launch'] },
  { q: 'Mars Perseverance rover surface', channel: 'space', tags: ['Mars', 'Rover'] },
  { q: 'Curiosity rover Gale Crater', channel: 'space', tags: ['Mars', 'Rover'] },
  { q: 'Apollo lunar surface', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'Artemis Orion spacecraft Moon', channel: 'space', tags: ['Artemis', 'Moon'] },
  { q: 'Hubble Webb telescope imagery', channel: 'space', tags: ['Observatory'] },
  { q: 'volcano from orbit eruption', channel: 'wild_earth', tags: ['Volcano', 'Earth from orbit'] },
  { q: 'hurricane from space station', channel: 'wild_earth', tags: ['Storm', 'Earth from orbit'] },
  { q: 'Antarctica IceBridge ice sheet survey', channel: 'wild_earth', tags: ['Polar', 'Ice'] },
  { q: 'Greenland glacier airborne survey', channel: 'wild_earth', tags: ['Polar', 'Glacier'] },
  { q: 'parachute test supersonic descent', channel: 'field_science', tags: ['Testing'] },
  { q: 'wind tunnel aeronautics research', channel: 'field_science', tags: ['Aeronautics'] },
  { q: 'Gemini Mercury spaceflight archival', channel: 'archives', tags: ['Historic'] },
  { q: 'Voyager Cassini planetary mission', channel: 'space', tags: ['Planetary'] },
];

interface NasaSearchItem {
  href: string;
  data: Array<{
    nasa_id: string; title: string; description?: string; description_508?: string;
    date_created: string; center?: string; keywords?: string[]; media_type: string;
    secondary_creator?: string; location?: string;
  }>;
  links?: Array<{ href: string; rel: string; render?: string }>;
}

export interface NasaRawItem extends RawProviderItem {
  nasaId: string;
  title: string;
  description: string;
  keywords: string[];
  center?: string;
  secondaryCreator?: string;
  dateCreated: string;
  thumbnailUrl?: string;
  channel: FrontierChannel;
  queryTags: string[];
  streamUrl: string;
  fallbackUrl?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  captionsUrl?: string;
  metadataLocation?: string;
  fetchedAt: string;
}

/** "0:52:34" / "12:04" / "52 s" -> seconds. Returns undefined when unreadable. */
export function parseQuickTimeDuration(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  const clock = s.match(/^(\d+):(\d{1,2}):(\d{1,2})(?:\.\d+)?$/);
  if (clock) return (+clock[1]) * 3600 + (+clock[2]) * 60 + (+clock[3]);
  const short = s.match(/^(\d+):(\d{1,2})(?:\.\d+)?$/);
  if (short) return (+short[1]) * 60 + (+short[2]);
  const secs = s.match(/^([\d.]+)\s*s(?:ec(?:onds?)?)?$/i);
  if (secs) {
    const v = Number.parseFloat(secs[1]);
    return Number.isFinite(v) ? Math.round(v) : undefined;
  }
  return undefined;
}

/**
 * XMP writes duration as a rational: `{ Value, Scale }` where Scale is the
 * length of one tick in seconds. Several NASA assets carry this and no
 * QuickTime duration at all, and without it they fail the eligibility gate for
 * having no duration — which is a metadata gap, not a quality problem.
 */
export function parseXmpDuration(raw: unknown): number | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { Value?: unknown; Scale?: unknown };
  const value = Number(r.Value);
  const scale = Number(r.Scale);
  if (!Number.isFinite(value) || !Number.isFinite(scale) || value <= 0 || scale <= 0) return undefined;
  const seconds = value * scale;
  return seconds > 0 && seconds < 86400 ? Math.round(seconds) : undefined;
}

/** "41.2 Mbps" / "2.4 kbps" -> bits per second. */
export function parseBitrate(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  if (typeof raw !== 'string') return undefined;
  const m = raw.match(/([\d.]+)\s*(kbps|mbps|bps)/i);
  if (!m) return undefined;
  const v = Number.parseFloat(m[1]);
  if (!Number.isFinite(v)) return undefined;
  const unit = m[2].toLowerCase();
  if (unit === 'mbps') return Math.round(v * 1_000_000);
  if (unit === 'kbps') return Math.round(v * 1000);
  return Math.round(v);
}

/**
 * NASA's asset lists come back as http:// with raw spaces in the path (the
 * nasa_id is the folder name, and plenty of those contain spaces). AVPlayer
 * rejects such a URL outright, so both problems are fixed here, once, at the
 * boundary: upgrade the scheme and percent-encode the path. `encodeURI` leaves
 * an existing `%20` alone, so re-running this is safe.
 */
function https(url: string): string {
  return encodeURI(url.replace(/^http:\/\//i, 'https://'));
}

/**
 * Renditions are named `~orig`, `~large`, `~medium`, `~small`, `~mobile`.
 * `~medium` is the right default for a phone that may be on cellular; `~small`
 * and `~mobile` are the ladder down when it is absent.
 */
export function pickNasaRenditions(assetUrls: string[]): { url?: string; fallback?: string; captions?: string } {
  const mp4s = assetUrls.filter((u) => /\.mp4$/i.test(u)).map(https);
  const pick = (suffix: string) => mp4s.find((u) => u.toLowerCase().includes(`~${suffix}.mp4`));
  const url = pick('medium') || pick('small') || pick('large') || pick('mobile') || mp4s.find((u) => !/~preview\.mp4$/i.test(u));
  const fallback = [pick('small'), pick('mobile')].find((u) => u && u !== url);
  const vtt = assetUrls.find((u) => /\.vtt$/i.test(u));
  return { url, fallback, captions: vtt ? https(vtt) : undefined };
}

/**
 * Location resolution, most-authoritative source first.
 *
 * `AVAIL:Location` in the asset metadata is NASA's own statement of where the
 * footage was shot, so it wins outright. After that the title and keywords are
 * far more reliable than the description, which routinely name-drops the ISS
 * in the closing paragraph of a ground test. Description is consulted last and
 * only for off-Earth cues.
 */
function resolveNasaLocation(title: string, metaLocation?: string): FrontierLocation {
  if (metaLocation && metaLocation.trim()) {
    const stated = lookupNasaFacility(metaLocation) || lookupOffEarth(metaLocation);
    if (stated) return stated;
  }
  // Title first, and title only, for both lookups. Keywords carry the
  // programme a clip belongs to, not where the camera was: a Green Run engine
  // test on a Mississippi test stand is tagged "Artemis I", and reading that as
  // a location puts a rocket test on the Moon.
  const facility = lookupNasaFacility(title);
  if (facility) return facility;
  const off = lookupOffEarth(title);
  if (off) return off;
  return { ...UNKNOWN_LOCATION };
}

function resolveNasaEnvironment(loc: FrontierLocation, blob: string): FrontierEnvironment {
  switch (loc.type) {
    case 'earth_orbit': return 'orbit';
    case 'moon': return 'lunar';
    case 'mars': return 'martian';
    case 'deep_space': return 'deep_space';
    default: break;
  }
  const b = blob.toLowerCase();
  if (/(antarctic|greenland|ice sheet|glacier|sea ice)/.test(b)) return 'polar';
  if (/(volcan|eruption|lava)/.test(b)) return 'volcanic';
  if (/(wind tunnel|laboratory|test stand|engine test|clean room|vacuum chamber)/.test(b)) return 'laboratory';
  if (/(forest|desert|canyon|wilderness|field campaign)/.test(b)) return 'wilderness';
  return 'unknown';
}

export class NasaAdapter implements FrontierProviderAdapter {
  readonly provider = 'nasa' as const;
  readonly organization = NASA_ORGANIZATION;
  readonly rightsUrl = NASA_RIGHTS_URL;

  async fetchItems(opts: FetchOptions = {}): Promise<NasaRawItem[]> {
    const log = opts.logger;
    const limit = opts.limit ?? 240;
    const perQuery = Math.max(4, Math.ceil(limit / NASA_QUERIES.length));
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const out: NasaRawItem[] = [];

    for (const { q, channel, tags } of NASA_QUERIES) {
      if (out.length >= limit) break;
      const url = `${SEARCH}?q=${encodeURIComponent(q)}&media_type=video&page_size=${perQuery * 2}`;
      const res = await getJson<{ collection: { items: NasaSearchItem[] } }>(url, {
        fetchImpl: opts.fetchImpl, logger: log,
      });
      const items = res?.collection?.items || [];
      let taken = 0;

      for (const it of items) {
        if (taken >= perQuery || out.length >= limit) break;
        const d = it.data?.[0];
        if (!d || d.media_type !== 'video' || seen.has(d.nasa_id)) continue;

        const description = (d.description || d.description_508 || '').trim();
        const keywords = d.keywords || [];
        if (!looksLikeRealFootage(d.title || '', description, keywords)) continue;
        seen.add(d.nasa_id);

        const enc = encodeURIComponent(d.nasa_id);
        const assets = await getJson<string[]>(`${ASSETS}/${enc}/collection.json`, {
          fetchImpl: opts.fetchImpl, logger: log,
        });
        if (!assets) continue;
        const { url: streamUrl, fallback, captions } = pickNasaRenditions(assets);
        if (!streamUrl) continue;

        const meta = await getJson<Record<string, unknown>>(`${ASSETS}/${enc}/metadata.json`, {
          fetchImpl: opts.fetchImpl, logger: log,
        });

        const durationSeconds = parseQuickTimeDuration(meta?.['QuickTime:Duration'])
          ?? parseQuickTimeDuration(meta?.['QuickTime:MediaDuration'])
          ?? parseXmpDuration(meta?.['XMP:Duration']);
        const width = Number(meta?.['QuickTime:ImageWidth'] ?? meta?.['QuickTime:SourceImageWidth']) || undefined;
        const height = Number(meta?.['QuickTime:ImageHeight'] ?? meta?.['QuickTime:SourceImageHeight']) || undefined;

        const thumb = (it.links || []).find((l) => l.render === 'image')?.href;

        out.push({
          nasaId: d.nasa_id,
          title: (d.title || '').trim(),
          description,
          keywords,
          center: d.center,
          secondaryCreator: d.secondary_creator,
          dateCreated: d.date_created,
          thumbnailUrl: thumb ? https(thumb) : undefined,
          channel,
          queryTags: tags,
          streamUrl,
          fallbackUrl: fallback,
          captionsUrl: captions,
          durationSeconds,
          // The renditions are scaled from the source; record the source frame
          // size, which is what the technical-quality score is judging.
          width, height,
          bitrate: parseBitrate(meta?.['Composite:AvgBitrate']),
          metadataLocation: typeof meta?.['AVAIL:Location'] === 'string' ? meta['AVAIL:Location'] as string : undefined,
          fetchedAt,
        });
        taken += 1;
      }
      log?.info(`NASA "${q}": ${taken} kept`);
    }
    return out;
  }

  normalize(raw: RawProviderItem): FrontierMediaItem | null {
    const r = raw as NasaRawItem;
    if (!r.title || !r.streamUrl) return null;

    const location = resolveNasaLocation(r.title, r.metadataLocation);
    const blob = `${r.title} ${r.description} ${r.keywords.join(' ')}`;
    const environment = resolveNasaEnvironment(location, blob);

    // The asset filename is part of the rights evidence, not just a path.
    // NASA names files things like `..._Music_Artemis logo~large.jpg`, which
    // is the agency telling us the piece carries licensed music and branding —
    // and it appears nowhere in the title, description or keywords.
    const rights = nasaRights({
      description: r.description,
      title: r.title,
      keywords: r.keywords,
      secondaryCreator: r.secondaryCreator,
      center: r.center,
      assetPaths: [r.streamUrl, r.thumbnailUrl],
    }, r.fetchedAt);
    const safety = nasaSafety({ title: r.title, description: r.description, keywords: r.keywords });

    const tags = [...new Set([...r.queryTags, ...r.keywords.slice(0, 6)])];
    const channels: FrontierChannel[] = [r.channel];
    if (environment === 'polar' || environment === 'volcanic' || environment === 'wilderness') {
      if (!channels.includes('wild_earth')) channels.push('wild_earth');
    }
    const created = r.dateCreated ? new Date(r.dateCreated) : null;
    if (created && !Number.isNaN(created.getTime()) && created.getUTCFullYear() < 1990) {
      if (!channels.includes('archives')) channels.push('archives');
    }

    return {
      id: `nasa:${r.nasaId}`,
      provider: this.provider,
      providerAssetId: r.nasaId,
      title: r.title,
      subtitle: location.type === 'unknown' ? undefined : location.displayName,
      description: r.description || undefined,
      stream: {
        url: r.streamUrl,
        type: 'mp4',
        fallbackUrl: r.fallbackUrl,
        mimeType: 'video/mp4',
        bitrate: r.bitrate,
        width: r.width,
        height: r.height,
        durationSeconds: r.durationSeconds,
      },
      imagery: { posterUrl: r.thumbnailUrl, thumbnailUrl: r.thumbnailUrl },
      temporal: {
        publishedAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : undefined,
        capturedAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : undefined,
      },
      channel: r.channel,
      channels,
      tags,
      environment,
      availability: 'on_demand',
      location,
      source: {
        organization: NASA_ORGANIZATION,
        assetUrl: `https://images.nasa.gov/details/${encodeURIComponent(r.nasaId)}`,
        metadataUrl: `${ASSETS}/${encodeURIComponent(r.nasaId)}/metadata.json`,
        mission: location.accuracy === 'mission' ? location.regionName : undefined,
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

export const nasaAdapter = new NasaAdapter();
