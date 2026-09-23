import type { FrontierChannel, FrontierMediaItem } from '../../core/types/media';
import type { FrontierEnvironment, FrontierLocation } from '../../core/types/location';
import type { FrontierSubject } from '../../core/types/subjects';
import { ANIMAL_SUBJECTS } from '../../core/types/subjects';
import { rightsAreClear } from '../../core/types/rights';
import { classifySubjects } from '../../core/catalog/subjects';
import type { FetchOptions, FrontierProviderAdapter, RawProviderItem } from '../types';
import { DEFAULT_USER_AGENT, stripHtml } from '../types';
import { NPS_ORGANIZATION, NPS_RIGHTS_URL, npsIsFootage, npsRights, npsSafety } from './rights';

/**
 * National Park Service multimedia videos.
 *
 * About 10,600 videos across some 400 parks (counted 2026-09-23), each a
 * direct MP4 on nps.gov in up to 1080p, most with WebVTT captions, every one
 * filed under the park it belongs to, and about a fifth with a point of its
 * own. The parks span the whole of what this app now covers: wildlife,
 * plants, landscapes, landmarks and the historic sites, battlefields and
 * homes of American history. 836 are flagged by the NPS itself as B-roll:
 * raw footage with no narration, which is exactly stock footage.
 *
 * API: https://www.nps.gov/subjects/developer/api-documentation.htm. A free
 * key comes from https://www.nps.gov/subjects/developer/get-started.htm and
 * goes in NPS_API_KEY; without one the adapter uses DEMO_KEY, which allows
 * about ten requests an hour, so it asks for large pages.
 */

const API = 'https://developer.nps.gov/api/v1';
const PAGE = 5000;

export interface NpsVideoVersion {
  url: string;
  fileType: string;
  heightPixels?: number;
  widthPixels?: number;
  fileSizeKb?: number;
}

export interface NpsVideo {
  id: string;
  title: string;
  description?: string;
  permalinkUrl?: string;
  splashImage?: { url?: string };
  relatedParks?: Array<{ parkCode: string; fullName: string; name?: string; designation?: string; states?: string }>;
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
  durationMs?: number | null;
  credit?: string;
  isBRoll?: boolean;
  captionFiles?: Array<{ url: string; fileType?: string; language?: string }>;
  versions?: NpsVideoVersion[];
}

export interface NpsPark {
  parkCode: string;
  fullName: string;
  designation?: string;
  states?: string;
  latitude?: string;
  longitude?: string;
}

export interface NpsRawItem extends RawProviderItem {
  video: NpsVideo;
  park?: NpsPark;
  fetchedAt: string;
}

const HISTORIC_DESIGNATIONS = /historic|historical|battlefield|military park|memorial|heritage|monument|trail/i;
const NATURE_SUBJECTS: ReadonlyArray<FrontierSubject> = [...ANIMAL_SUBJECTS, 'plants', 'landscapes'];
const HISTORY_SUBJECTS: ReadonlyArray<FrontierSubject> = ['history', 'native_heritage', 'landmarks'];

/** Largest MP4 at 1080p or below; a smaller one as the fallback. */
export function pickVersions(versions: NpsVideoVersion[] | undefined): { best?: NpsVideoVersion; fallback?: NpsVideoVersion } {
  const mp4 = (versions || [])
    .filter((v) => v.url && /mp4/i.test(v.fileType || v.url) && (v.heightPixels ?? 0) <= 1080)
    .sort((a, b) => (b.heightPixels ?? 0) - (a.heightPixels ?? 0));
  return { best: mp4[0], fallback: mp4.find((v) => (v.heightPixels ?? 0) < (mp4[0]?.heightPixels ?? 0) && (v.heightPixels ?? 0) >= 360) };
}

function num(s: string | number | null | undefined): number | undefined {
  const n = typeof s === 'number' ? s : Number(s);
  return s === '' || s === null || s === undefined || !Number.isFinite(n) ? undefined : n;
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
};

/** "ID,MT,WY" -> "Idaho, Montana, Wyoming". Unknown codes are kept as published. */
export function usStates(codes: string | undefined): string | undefined {
  if (!codes) return undefined;
  const names = codes.split(',').map((c) => c.trim()).filter(Boolean).map((c) => STATE_NAMES[c.toUpperCase()] || c);
  return names.length ? names.join(', ') : undefined;
}

/**
 * The kind of place. The title decides when it can; the park's designation
 * comes next (a clip from a historic site is at a historic site); the
 * description only when neither says anything, because descriptions mention
 * rivers and mountains in passing.
 */
export function npsEnvironment(title: string, description: string, designation: string | undefined): FrontierEnvironment {
  const fromTitle = environmentFromWords(title);
  if (fromTitle) return fromTitle;
  if (designation && HISTORIC_DESIGNATIONS.test(designation)) return 'historic_site';
  return environmentFromWords(description) || (/\b(histor\w*|battle\w*|fort|house|home of|homestead|mill|museum|memorial)\b/i.test(title) ? 'historic_site' : 'wilderness');
}

function environmentFromWords(text: string): FrontierEnvironment | null {
  const b = text.toLowerCase();
  if (/\b(underwater|snorkel\w*|scuba|diver?s?|diving|coral|reef|kelp forest|seagrass)\b/.test(b)) return 'shallow_ocean';
  if (/\b(glaciers?|ice ?fields?|icebergs?|arctic|tundra|polar)\b/.test(b)) return 'polar';
  if (/\b(volcan\w*|lava|geysers?|geyser basin|hot springs?|thermal features?|fumaroles?|kilauea|caldera)\b/.test(b)) return 'volcanic';
  if (/\b(caves?|caverns?|underground|stalactites?|karst)\b/.test(b)) return 'cave';
  if (/\b(deserts?|dunes?|sand|canyons?|mesas?|arches|hoodoos?|badlands|saguaro|joshua tree|mojave|sonoran)\b/.test(b)) return 'desert';
  if (/\b(mountains?|peaks?|summits?|alpine|ridges?|rainier|denali|tetons?|rockies)\b/.test(b)) return 'mountain';
  if (/\b(coast\w*|beach(es)?|seashores?|shorelines?|tide ?pools?|lighthouses?|islands?|bays?|ocean|sea|surf|harbou?r)\b/.test(b)) return 'coast';
  if (/\b(rivers?|lakes?|lakeshore|creeks?|streams?|waterfalls?|falls|wetlands?|marsh(es)?|swamps?|everglades|bayous?|springs?)\b/.test(b)) return 'freshwater';
  if (/\b(prairies?|grasslands?|meadows?|bison|tallgrass)\b/.test(b)) return 'grassland';
  if (/\b(forests?|woods|woodlands?|redwoods?|sequoias?|trees|old[- ]growth)\b/.test(b)) return 'forest';
  return null;
}

/** Where the clip goes: the video's own point when the NPS gives one, else its park's. */
export function npsLocation(video: NpsVideo, park: NpsPark | undefined, environment: FrontierEnvironment): FrontierLocation | null {
  const type: FrontierLocation['type'] = environment === 'shallow_ocean' ? 'underwater' : 'earth_surface';
  const name = park?.fullName || video.relatedParks?.[0]?.fullName;
  const states = usStates(park?.states || video.relatedParks?.[0]?.states);
  const lat = num(video.latitude);
  const lon = num(video.longitude);
  if (lat !== undefined && lon !== undefined && (lat !== 0 || lon !== 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return {
      type, celestialBody: 'earth', latitude: lat, longitude: lon,
      displayName: name, regionName: states,
      accuracy: 'approximate',
      coordinateSource: 'NPS multimedia record latitude/longitude for this video',
    };
  }
  const plat = num(park?.latitude);
  const plon = num(park?.longitude);
  if (park && plat !== undefined && plon !== undefined && (plat !== 0 || plon !== 0)) {
    return {
      type, celestialBody: 'earth', latitude: plat, longitude: plon,
      displayName: park.fullName, regionName: states,
      accuracy: 'region',
      coordinateSource: `NPS parks API reference point for ${park.fullName} (the park, not the filming position)`,
    };
  }
  return null;
}

/** The poster the video's nps.gov page uses, when it is an nps.gov image. */
export function posterFromPage(html: string): string | undefined {
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) || html.match(/\bposter="([^"]+)"/i);
  const url = m?.[1]?.replace(/&amp;/g, '&');
  if (!url) return undefined;
  const abs = url.startsWith('/') ? `https://www.nps.gov${url}` : url.replace(/^http:\/\//i, 'https://');
  return /^https:\/\/www\.nps\.gov\/.+\.(jpe?g|png)(\?.*)?$/i.test(abs) && !/\/(logo|arrowhead|nps-logo)/i.test(abs) ? abs : undefined;
}

async function pagePoster(url: string, opts: FetchOptions): Promise<string | undefined> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(url, { headers: { accept: 'text/html', 'user-agent': DEFAULT_USER_AGENT } });
    if (!res.ok) return undefined;
    return posterFromPage(await res.text());
  } catch {
    return undefined;
  }
}

export class NationalParkServiceAdapter implements FrontierProviderAdapter {
  readonly provider = 'nps' as const;
  readonly organization = NPS_ORGANIZATION;
  readonly rightsUrl = NPS_RIGHTS_URL;

  private key(): string {
    return (typeof process !== 'undefined' && process.env?.NPS_API_KEY) || 'DEMO_KEY';
  }

  private async get<T>(path: string, opts: FetchOptions): Promise<T | null> {
    const f = opts.fetchImpl ?? fetch;
    const url = `${API}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(this.key())}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await f(url, { headers: { accept: 'application/json', 'user-agent': DEFAULT_USER_AGENT } });
        if (res.status === 429) {
          opts.logger?.warn('NPS: rate limited (429). Set NPS_API_KEY; DEMO_KEY allows about ten requests an hour.');
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      } catch (err) {
        if (attempt === 2) { opts.logger?.warn(`NPS: GET failed: ${path}`, err); return null; }
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return null;
  }

  async fetchItems(opts: FetchOptions = {}): Promise<NpsRawItem[]> {
    const log = opts.logger;
    const limit = opts.limit ?? Infinity;
    const fetchedAt = new Date().toISOString();
    if (this.key() === 'DEMO_KEY') log?.warn('NPS: NPS_API_KEY not set; using DEMO_KEY');

    const parksRes = await this.get<{ data: NpsPark[] }>('/parks?limit=1000&fields=', opts);
    const parks = new Map((parksRes?.data || []).map((p) => [p.parkCode, {
      parkCode: p.parkCode, fullName: p.fullName, designation: p.designation, states: p.states,
      latitude: p.latitude, longitude: p.longitude,
    }]));
    log?.info(`NPS: ${parks.size} parks`);

    const videos: NpsVideo[] = [];
    for (let start = 0; ; start += PAGE) {
      const page = await this.get<{ total: string | number; data: NpsVideo[] }>(`/multimedia/videos?limit=${PAGE}&start=${start}`, opts);
      if (!page?.data?.length) break;
      videos.push(...page.data);
      if (videos.length >= Number(page.total) || page.data.length < PAGE) break;
    }
    log?.info(`NPS: ${videos.length} videos`);

    // About a third of the records have no splash image in the API while the
    // video's own page on nps.gov names one (its player poster). Only for
    // clips that could be published, a few at a time.
    const needPoster = videos.filter((v) => !v.splashImage?.url && v.permalinkUrl && npsIsFootage(stripHtml(v.title)));
    let found = 0;
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (;;) {
        const v = needPoster[next];
        next += 1;
        if (!v) return;
        const poster = await pagePoster(v.permalinkUrl!, opts);
        if (poster) { v.splashImage = { url: poster }; found += 1; }
      }
    }));
    if (needPoster.length) log?.info(`NPS: posters recovered from video pages: ${found} of ${needPoster.length}`);

    const raws: NpsRawItem[] = [];
    for (const video of videos) {
      const code = video.relatedParks?.[0]?.parkCode;
      raws.push({ video, park: code ? parks.get(code) : undefined, fetchedAt });
      if (raws.length >= limit) break;
    }
    return raws;
  }

  normalize(raw: RawProviderItem): FrontierMediaItem | null {
    const { video, park, fetchedAt } = raw as NpsRawItem;
    if (!video?.id || !video.title) return null;
    const title = stripHtml(video.title);
    if (!npsIsFootage(title)) return null;

    const { best, fallback } = pickVersions(video.versions);
    if (!best) return null;

    const description = stripHtml(video.description);
    const designation = park?.designation || video.relatedParks?.[0]?.designation;
    const environment = npsEnvironment(title, description, designation);
    const location = npsLocation(video, park, environment);
    // Placed or not at all: every clip in this product sits somewhere on the globe.
    if (!location) return null;

    const tags = [...new Set([...(video.tags || []).map((t) => stripHtml(t)).filter(Boolean), ...(video.isBRoll ? ['B-roll'] : [])])];
    const subjects = classifySubjects({ title, description, tags });
    const nature = subjects.some((s) => NATURE_SUBJECTS.includes(s));
    const past = subjects.some((s) => HISTORY_SUBJECTS.includes(s));
    const historicSite = !!designation && HISTORIC_DESIGNATIONS.test(designation);
    const channel: FrontierChannel = past && (!nature || historicSite) ? 'archives'
      : nature ? 'wild_earth'
        : historicSite ? 'archives' : 'wild_earth';
    const channels: FrontierChannel[] = [channel];
    if (channel === 'archives' && nature) channels.push('wild_earth');
    if (channel === 'wild_earth' && past) channels.push('archives');
    if (/\b(science|scientists?|research(ers)?|monitoring|survey|study|biologists?|ecologists?|geologists?)\b/i.test(title)) channels.push('field_science');
    if (channel === 'archives' && !subjects.includes('history') && historicSite) subjects.push('history');

    const durationSeconds = video.durationMs && video.durationMs > 0 ? Math.round(video.durationMs / 100) / 10 : undefined;
    const captions = (video.captionFiles || []).find((c) => /vtt/i.test(c.fileType || c.url) && (!c.language || /^en/i.test(c.language)));

    return {
      id: `nps:${video.id}`,
      provider: this.provider,
      providerAssetId: video.id,
      title,
      subtitle: location.displayName,
      description: description || undefined,
      stream: {
        url: best.url.replace(/^http:\/\//i, 'https://'),
        type: 'mp4',
        fallbackUrl: fallback?.url?.replace(/^http:\/\//i, 'https://'),
        mimeType: 'video/mp4',
        width: best.widthPixels,
        height: best.heightPixels,
        durationSeconds,
      },
      imagery: video.splashImage?.url ? { posterUrl: video.splashImage.url, thumbnailUrl: video.splashImage.url } : {},
      temporal: {},
      channel,
      channels: [...new Set(channels)],
      tags,
      subjects,
      environment,
      availability: 'on_demand',
      location,
      source: {
        organization: NPS_ORGANIZATION,
        assetUrl: video.permalinkUrl,
        metadataUrl: `${API}/multimedia/videos?id=${video.id}`,
        site: location.displayName,
      },
      rights: npsRights(video.credit, fetchedAt),
      safety: npsSafety(title, description),
      captionsUrl: captions?.url,
      ranking: { contentQuality: 0, freshness: 0, baseWeight: 1 },
    };
  }

  validateRights(item: FrontierMediaItem): boolean {
    return rightsAreClear(item.rights);
  }
}

export const npsAdapter = new NationalParkServiceAdapter();
