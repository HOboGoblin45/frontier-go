import type { FrontierChannel, FrontierMediaItem } from '../../core/types/media';
import type { FrontierEnvironment } from '../../core/types/location';
import { ANIMAL_SUBJECTS } from '../../core/types/subjects';
import type { FrontierSubject } from '../../core/types/subjects';
import { rightsAreClear } from '../../core/types/rights';
import { classifySubjects } from '../../core/catalog/subjects';
import type { FetchOptions, FrontierProviderAdapter, RawProviderItem } from '../types';
import { DEFAULT_USER_AGENT } from '../types';
import type { Gazetteer } from '../places';
import { PlaceResolver } from '../places';
import { LOC_ORGANIZATION, LOC_RIGHTS_URL, locIsFootage, locRights, locSafety, yearOf } from './rights';

/**
 * Library of Congress National Screening Room: about 1,300 digitized films,
 * each with adaptive HLS (1080p/720p/540p) and a progressive MP4, straight
 * from the item JSON. Actualities from the 1890s on, newsreels, government
 * films: the San Francisco earthquake, the Galveston hurricane, the Paris
 * exposition of 1900, the Klondike, the Panama Canal. The history half of
 * the "History, Nature, Science" brief.
 *
 * The catalog names places ("san francisco", "california") but gives no
 * coordinates; providers/places.ts resolves the names to a Natural Earth
 * reference point, labelled as such, or to nothing.
 *
 * API: https://www.loc.gov/apis/json-and-yaml/. Rate limits are published (20
 * requests a minute on this endpoint); pages are 100 items, spaced.
 */

const COLLECTION = 'https://www.loc.gov/collections/national-screening-room/';
const PAGE_DELAY_MS = 3500;

export interface LocResource {
  video?: string;
  video_stream?: string;
  poster?: string;
  image?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface LocResult {
  id?: string;
  url?: string;
  title?: string;
  date?: string;
  description?: string[];
  location?: string[];
  subject?: string[];
  image_url?: string[];
  resources?: LocResource[];
  number_lccn?: string[];
  access_restricted?: boolean;
  item?: {
    title?: string;
    date?: string;
    contributors?: string[];
    created_published?: string[];
    genre?: string[];
    subjects?: string[];
    summary?: string[];
    notes?: string[];
    source_collection?: string[];
    access_advisory?: string[];
    location?: string[];
  };
}

export interface LocRawItem extends RawProviderItem {
  result: LocResult;
  /** Resolved at fetch time from the record's place names. */
  place?: import('../../core/types/location').FrontierLocation | null;
  fetchedAt: string;
}

const NATURE: ReadonlyArray<FrontierSubject> = [...ANIMAL_SUBJECTS, 'plants', 'landscapes'];

export function locEnvironment(text: string): FrontierEnvironment {
  const b = text.toLowerCase();
  if (/\b(underwater|diver?s?|coral)\b/.test(b)) return 'shallow_ocean';
  if (/\b(glaciers?|arctic|antarctic|polar|klondike|yukon|alaska|ice)\b/.test(b)) return 'polar';
  if (/\b(volcan\w*|lava|geysers?|yellowstone)\b/.test(b)) return 'volcanic';
  if (/\b(harbou?r|ships?|steamers?|steamships?|yachts?|boats?|naval|navy|beach(es)?|coast|seashore|surf|bathing|ocean|sea)\b/.test(b)) return 'coast';
  if (/\b(niagara|falls|rivers?|lakes?|canals?)\b/.test(b)) return 'freshwater';
  if (/\b(mountains?|canyons?|peaks?|alps|rockies)\b/.test(b)) return 'mountain';
  if (/\b(deserts?)\b/.test(b)) return 'desert';
  if (/\b(forests?|lumber\w*|logging|trees)\b/.test(b)) return 'forest';
  if (/\b(farms?|ranch\w*|cattle|wheat|harvest\w*|prairies?|plains)\b/.test(b)) return 'grassland';
  return 'historic_site';
}

/** "hurricanes--texas--galveston" -> "Hurricanes, Texas, Galveston". Headings name people too; those are dropped. */
export function tidyHeading(h: string): string {
  const parts = h.split('--').map((p) => p.trim().replace(/,$/, '')).filter(Boolean);
  // A lifespan segment ("1837-1917") means the heading names a person.
  if (parts.some((p) => /^\d{4}-(\d{4})?$/.test(p) || /^depicted$/i.test(p))) return '';
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
}

function lccnOf(r: LocResult): string | undefined {
  return r.number_lccn?.[0] || r.id?.match(/\/item\/([^/]+)\/?$/)?.[1];
}

function sentence(s: string | undefined): string | undefined {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t || undefined;
}

export class LibraryOfCongressAdapter implements FrontierProviderAdapter {
  readonly provider = 'loc' as const;
  readonly organization = LOC_ORGANIZATION;
  readonly rightsUrl = LOC_RIGHTS_URL;

  constructor(private readonly loadGazetteer: () => Promise<Gazetteer | null> = defaultGazetteer) {}

  async fetchItems(opts: FetchOptions = {}): Promise<LocRawItem[]> {
    const f = opts.fetchImpl ?? fetch;
    const log = opts.logger;
    const limit = opts.limit ?? Infinity;
    const fetchedAt = new Date().toISOString();
    const results: LocResult[] = [];
    let failed = 0;
    for (let page = 1; page < 40; page += 1) {
      let body: { results?: LocResult[]; pagination?: { next?: string | null } } | null = null;
      // loc.gov answers an over-eager client with 429, and sometimes with a
      // bare 404 for a page that exists. Both get a long pause and a retry.
      for (let attempt = 0; attempt < 4 && !body; attempt += 1) {
        try {
          const res = await f(`${COLLECTION}?fo=json&c=100&sp=${page}`, { headers: { accept: 'application/json', 'user-agent': DEFAULT_USER_AGENT } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          body = await res.json();
        } catch (err) {
          if (attempt === 3) log?.warn(`LoC: page ${page} failed`, err);
          else await new Promise((r) => setTimeout(r, (opts.fetchImpl ? 1 : 20_000) * (attempt + 1)));
        }
      }
      if (!body) {
        // One page of the collection has been answering 404 at every page
        // size while the pages either side of it load (seen 2026-09-23).
        // Skip it and keep going; the next weekly run tries it again.
        failed += 1;
        if (failed >= 3) break;
        continue;
      }
      if (!body.results?.length) break;
      results.push(...body.results);
      if (!body.pagination?.next || results.length >= limit) break;
      await new Promise((r) => setTimeout(r, opts.fetchImpl ? 0 : PAGE_DELAY_MS));
    }
    log?.info(`LoC: ${results.length} records`);

    const gazetteer = await this.loadGazetteer();
    const resolver = gazetteer ? new PlaceResolver(gazetteer) : null;
    if (!resolver) log?.warn('LoC: gazetteer not found; records get no coordinates');
    return results.slice(0, limit === Infinity ? undefined : limit).map((result) => ({
      result,
      place: resolver && result.location?.length ? resolver.resolve(result.location) : null,
      fetchedAt,
    }));
  }

  normalize(raw: RawProviderItem): FrontierMediaItem | null {
    const { result: r, place, fetchedAt } = raw as LocRawItem;
    const item = r?.item;
    if (!r || !item || r.access_restricted) return null;
    const lccn = lccnOf(r);
    const res = (r.resources || []).find((x) => x.video_stream || x.video);
    if (!lccn || !res) return null;
    const genres = item.genre || [];
    if (!locIsFootage(genres)) return null;
    // Every clip in this product sits somewhere on the globe.
    if (!place) return null;

    const title = sentence(item.title || r.title);
    if (!title) return null;
    const description = sentence(item.summary?.join(' ') || r.description?.join(' '));
    const headings = [...(item.subjects || [])];
    const date = item.date || r.date;
    const year = yearOf(date);

    const subjects = classifySubjects({ title, description, headings });
    if (!subjects.includes('history')) subjects.unshift('history');
    const channels: FrontierChannel[] = ['archives'];
    if (subjects.some((s) => NATURE.includes(s)) || genres.some((g) => /nature films/i.test(g))) channels.push('wild_earth');

    const hls = res.video_stream?.replace(/^http:\/\//i, 'https://');
    const mp4 = res.video?.replace(/^http:\/\//i, 'https://');
    const poster = res.poster || res.image || r.image_url?.[0];
    const environment = locEnvironment(`${title} ${headings.join(' ')} ${description || ''}`);

    return {
      id: `loc:${lccn}`,
      provider: this.provider,
      providerAssetId: lccn,
      title,
      subtitle: year ? String(year) : undefined,
      description,
      stream: hls
        ? { url: hls, type: 'hls', fallbackUrl: mp4, mimeType: 'application/vnd.apple.mpegurl', width: res.width, height: res.height, durationSeconds: res.duration }
        : { url: mp4!, type: 'mp4', mimeType: 'video/mp4', width: res.width, height: res.height, durationSeconds: res.duration },
      imagery: poster ? { posterUrl: poster.replace(/^http:\/\//i, 'https://'), thumbnailUrl: poster.replace(/^http:\/\//i, 'https://') } : {},
      // The year only: the catalog gives no day, so no "captured" date is shown.
      temporal: year ? { publishedAt: `${year}-01-01T00:00:00.000Z` } : {},
      channel: 'archives',
      channels,
      // The catalog's own subject headings travel as tags: they are what the
      // subject classifier reads, and they are good reading in the info sheet.
      tags: [...new Set([
        ...genres.filter((g) => !/^(short|silent) films$/i.test(g)),
        ...headings.map(tidyHeading).filter(Boolean).slice(0, 8),
        ...(year ? [`${Math.floor(year / 10) * 10}s`] : []),
      ])],
      subjects,
      environment,
      availability: 'on_demand',
      location: { ...place, type: environment === 'shallow_ocean' ? 'underwater' : place.type },
      source: {
        organization: LOC_ORGANIZATION,
        assetUrl: r.url || `https://www.loc.gov/item/${lccn}/`,
        metadataUrl: `https://www.loc.gov/item/${lccn}/?fo=json`,
      },
      rights: locRights({
        date,
        contributors: item.contributors,
        createdPublished: item.created_published,
        sourceCollection: item.source_collection,
        notes: item.notes,
        accessAdvisory: item.access_advisory,
      }, fetchedAt),
      safety: locSafety(title, headings, genres),
      ranking: { contentQuality: 0, freshness: 0, baseWeight: 1 },
    };
  }

  validateRights(item: FrontierMediaItem): boolean {
    return rightsAreClear(item.rights);
  }
}

/** Node only: the ingest reads the gazetteer from the repository. */
async function defaultGazetteer(): Promise<Gazetteer | null> {
  try {
    const fs = await import('node:fs/promises');
    const url = new URL('../../../data/places/gazetteer.json', import.meta.url);
    return JSON.parse(await fs.readFile(url, 'utf8')) as Gazetteer;
  } catch {
    return null;
  }
}

export const locAdapter = new LibraryOfCongressAdapter();
