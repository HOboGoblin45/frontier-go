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

/** NASA's search endpoint caps `page_size` at 100. */
const SEARCH_PAGE_SIZE = 100;
/** Deep enough to drain a narrow query, shallow enough to stay polite. */
const MAX_SEARCH_PAGES = 5;
/**
 * Every kept item costs two more requests (`collection.json` and
 * `metadata.json`). Serial, a few thousand items is most of an hour of CI;
 * six at a time brings it back to minutes without leaning on the API.
 */
const ASSET_CONCURRENCY = 6;

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
      const index = next;
      next += 1;
      if (index >= input.length) return;
      results[index] = await fn(input[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
const ASSETS = 'https://images-assets.nasa.gov/video';

/**
 * Short queries, deliberately.
 *
 * NASA's search ANDs every term, so a descriptive phrase collapses to almost
 * nothing: "Hubble Webb telescope imagery" matches 0 videos while "Hubble"
 * matches 165, and "Falcon Atlas Delta launch" matches 0 while "Atlas launch"
 * matches 272. The first version of this list read well and harvested a
 * fraction of the library. Every entry below was measured against the live
 * endpoint before it was added; one term, two at most, and the channel and
 * tags do the describing.
 *
 * Overlap between queries is fine - ids are deduplicated as they are taken.
 */
export const NASA_QUERIES: Array<{ q: string; channel: FrontierChannel; tags: string[] }> = [
  // Mars. The rovers are the closest thing in the catalog to a continuous
  // expedition: one place, years of traverse, a named machine doing the work.
  { q: 'Perseverance rover', channel: 'space', tags: ['Mars', 'Rover'] },
  { q: 'Curiosity rover', channel: 'space', tags: ['Mars', 'Rover'] },
  { q: 'Ingenuity helicopter', channel: 'space', tags: ['Mars', 'Flight'] },
  { q: 'Opportunity rover', channel: 'archives', tags: ['Mars', 'Rover'] },
  { q: 'Spirit rover', channel: 'archives', tags: ['Mars', 'Rover'] },
  { q: 'InSight lander', channel: 'space', tags: ['Mars', 'Lander'] },
  { q: 'Phoenix lander', channel: 'archives', tags: ['Mars', 'Lander'] },
  { q: 'Viking lander', channel: 'archives', tags: ['Mars', 'Historic'] },
  { q: 'Mars surface', channel: 'space', tags: ['Mars'] },
  { q: 'Mars landing', channel: 'space', tags: ['Mars', 'Landing'] },
  { q: 'Mars sample', channel: 'space', tags: ['Mars'] },

  // The Moon.
  { q: 'Apollo 11', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'Apollo 12', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'Apollo 15', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'Apollo 16', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'Apollo 17', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'moonwalk', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'lunar rover', channel: 'archives', tags: ['Apollo', 'Moon'] },
  { q: 'lunar south pole', channel: 'space', tags: ['Moon'] },
  { q: 'Lunar Reconnaissance Orbiter', channel: 'space', tags: ['Moon'] },
  { q: 'Artemis', channel: 'space', tags: ['Artemis', 'Moon'] },
  { q: 'Orion spacecraft', channel: 'space', tags: ['Artemis', 'Moon'] },

  // Life and work in orbit.
  { q: 'spacewalk', channel: 'space', tags: ['EVA', 'Spacewalk'] },
  { q: 'cupola', channel: 'space', tags: ['ISS', 'Earth from orbit'] },
  { q: 'space station', channel: 'space', tags: ['ISS'] },
  { q: 'Expedition crew', channel: 'space', tags: ['ISS'] },
  { q: 'microgravity', channel: 'field_science', tags: ['ISS', 'Research'] },
  { q: 'cargo docking', channel: 'space', tags: ['ISS', 'Docking'] },
  { q: 'Crew Dragon', channel: 'space', tags: ['ISS', 'Docking'] },
  { q: 'Soyuz', channel: 'space', tags: ['ISS'] },
  { q: 'neutral buoyancy', channel: 'field_science', tags: ['Training'] },
  { q: 'astronaut training', channel: 'field_science', tags: ['Training'] },
  { q: 'Earth from orbit', channel: 'space', tags: ['Earth from orbit'] },
  { q: 'time lapse Earth', channel: 'space', tags: ['Earth from orbit'] },

  // Getting off the ground.
  { q: 'launch', channel: 'space', tags: ['Launch'] },
  { q: 'liftoff', channel: 'space', tags: ['Launch'] },
  { q: 'Atlas launch', channel: 'space', tags: ['Launch'] },
  { q: 'Delta launch', channel: 'space', tags: ['Launch'] },
  { q: 'Falcon launch', channel: 'space', tags: ['Launch'] },
  { q: 'Space Launch System', channel: 'space', tags: ['Launch', 'Artemis'] },
  { q: 'space shuttle', channel: 'archives', tags: ['Shuttle', 'Historic'] },
  { q: 'Shuttle landing', channel: 'archives', tags: ['Shuttle', 'Historic'] },

  // Machines pushed until they break.
  { q: 'engine test', channel: 'field_science', tags: ['Propulsion', 'Engine test'] },
  { q: 'rocket test', channel: 'field_science', tags: ['Propulsion', 'Engine test'] },
  { q: 'static fire', channel: 'field_science', tags: ['Propulsion', 'Engine test'] },
  { q: 'Stennis', channel: 'field_science', tags: ['Propulsion', 'Engine test'] },
  { q: 'parachute test', channel: 'field_science', tags: ['Testing'] },
  { q: 'drop test', channel: 'field_science', tags: ['Testing'] },
  { q: 'thermal vacuum', channel: 'field_science', tags: ['Testing'] },
  { q: 'wind tunnel', channel: 'field_science', tags: ['Aeronautics'] },
  { q: 'flight test', channel: 'field_science', tags: ['Aeronautics'] },
  { q: 'supersonic', channel: 'field_science', tags: ['Aeronautics'] },
  { q: 'X-59', channel: 'field_science', tags: ['Aeronautics'] },

  // Further out.
  { q: 'Cassini', channel: 'space', tags: ['Saturn', 'Planetary'] },
  { q: 'Voyager', channel: 'space', tags: ['Planetary'] },
  { q: 'Juno', channel: 'space', tags: ['Jupiter', 'Planetary'] },
  { q: 'New Horizons', channel: 'space', tags: ['Planetary'] },
  { q: 'OSIRIS-REx', channel: 'space', tags: ['Asteroid'] },
  { q: 'Europa Clipper', channel: 'space', tags: ['Planetary'] },
  { q: 'Psyche', channel: 'space', tags: ['Asteroid'] },
  { q: 'DART', channel: 'space', tags: ['Asteroid'] },
  { q: 'Parker Solar Probe', channel: 'space', tags: ['Sun'] },
  { q: 'solar flare', channel: 'space', tags: ['Sun'] },
  { q: 'coronal mass ejection', channel: 'space', tags: ['Sun'] },
  { q: 'Hubble', channel: 'space', tags: ['Observatory'] },
  { q: 'Webb telescope', channel: 'space', tags: ['Observatory'] },
  { q: 'Chandra', channel: 'space', tags: ['Observatory'] },

  // Expeditions on this planet - the half of "exploration" that usually gets
  // forgotten.
  { q: 'IceBridge', channel: 'field_science', tags: ['Polar', 'Ice'] },
  { q: 'Greenland glacier', channel: 'wild_earth', tags: ['Polar', 'Glacier'] },
  { q: 'Antarctica', channel: 'wild_earth', tags: ['Polar'] },
  { q: 'sea ice', channel: 'wild_earth', tags: ['Polar', 'Ice'] },
  { q: 'ABoVE', channel: 'field_science', tags: ['Arctic', 'Expedition'] },
  { q: 'airborne science', channel: 'field_science', tags: ['Airborne', 'Expedition'] },
  { q: 'field campaign', channel: 'field_science', tags: ['Expedition'] },
  { q: 'research vessel', channel: 'field_science', tags: ['Expedition'] },
  { q: 'NEEMO', channel: 'deep_sea', tags: ['Analog mission', 'Expedition'] },
  { q: 'analog mission', channel: 'field_science', tags: ['Analog mission'] },
  { q: 'submersible', channel: 'deep_sea', tags: ['Expedition'] },

  // Earth as a subject.
  { q: 'volcano', channel: 'wild_earth', tags: ['Volcano'] },
  { q: 'hurricane', channel: 'wild_earth', tags: ['Storm'] },
  { q: 'wildfire', channel: 'wild_earth', tags: ['Fire'] },
  { q: 'flood', channel: 'wild_earth', tags: ['Water'] },
  { q: 'drought', channel: 'wild_earth', tags: ['Land'] },
  { q: 'dust storm', channel: 'wild_earth', tags: ['Atmosphere'] },
  { q: 'lightning', channel: 'wild_earth', tags: ['Atmosphere'] },
  { q: 'clouds', channel: 'wild_earth', tags: ['Atmosphere'] },
  { q: 'aurora', channel: 'wild_earth', tags: ['Aurora'] },
  { q: 'glacier', channel: 'wild_earth', tags: ['Glacier'] },
  { q: 'river delta', channel: 'wild_earth', tags: ['Land'] },
  { q: 'desert', channel: 'wild_earth', tags: ['Land'] },
  { q: 'ocean', channel: 'wild_earth', tags: ['Ocean'] },
  { q: 'coral reef', channel: 'wild_earth', tags: ['Reef'] },
  { q: 'Earth at night', channel: 'wild_earth', tags: ['Earth from orbit'] },

  // The record.
  { q: 'Gemini', channel: 'archives', tags: ['Historic'] },
  { q: 'Mercury program', channel: 'archives', tags: ['Historic'] },
  { q: 'Skylab', channel: 'archives', tags: ['Historic'] },
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
  // The title first, because it describes the footage. `AVAIL:Location`
  // describes the filing cabinet: it names the NASA centre that HOLDS the
  // asset, so "Greenland Ice Flights" arrives stamped "Goddard Space Flight
  // Center" and, read first, became a pin in suburban Maryland.
  //
  // Keywords are read for neither lookup. They carry the programme a clip
  // belongs to, not where the camera was: a Green Run engine test on a
  // Mississippi test stand is tagged "Artemis I", and reading that as a
  // location puts a rocket test on the Moon.
  const off = lookupOffEarth(title);
  if (off) return off;
  const facility = lookupNasaFacility(title);
  if (facility) return facility;

  if (metaLocation && metaLocation.trim()) {
    const stated = lookupOffEarth(metaLocation) || lookupNasaFacility(metaLocation);
    if (stated) return stated;
  }
  return { ...UNKNOWN_LOCATION };
}

/**
 * Where the camera is.
 *
 * `unknown` is a real answer and stays available, but it was the answer for
 * 39% of the catalog once the query set widened - and the material behind it
 * was not mysterious. It was spacecraft being stacked, encapsulated, rolled
 * out and counted down, servicing EVAs on Hubble, and experiments on the
 * station: all perfectly nameable places that this function had no rule for,
 * shown to the reader as "Somewhere else".
 *
 * Every pattern below was written against titles and keywords sampled from the
 * items that actually landed in `unknown`.
 */
function resolveNasaEnvironment(loc: FrontierLocation, blob: string): FrontierEnvironment {
  switch (loc.type) {
    case 'earth_orbit': return 'orbit';
    case 'moon': return 'lunar';
    case 'mars': return 'martian';
    case 'deep_space': return 'deep_space';
    default: break;
  }
  const b = blob.toLowerCase();

  // In space, whatever the location record managed to resolve. An EVA on
  // Hubble and an experiment rack on the station are both in orbit.
  if (/\b(spacewalk|eva\b|extravehicular|cupola|iss\b|international space station|expedition \d|in orbit|on orbit|orbital sunrise|microgravity|zero gravity|servicing mission|sm4\b)/.test(b)) return 'orbit';

  // Not in orbit but not on Earth either.
  if (/\b(asteroid|bennu|comet|kuiper|pluto|jupiter|saturn|titan|enceladus|europa|venus|mercury(?! program)|sunspot|solar flare|coronal mass|corona\b|nebula|galaxy|exoplanet)/.test(b)) return 'deep_space';

  // Something being TESTED is under test wherever it happens - a static fire
  // on an outdoor stand belongs with the wind tunnel, not with the pad. This
  // runs before the launch-site rule so a test at a launch complex is still
  // read as a test.
  if (/\b(static fire|hot fire|engine test|test stand|test fire|rocket test|stennis)/.test(b)) return 'laboratory';

  // The pad and the road to it: stacking, rollout, countdown, liftoff. A
  // distinct place from a clean room, and it reads differently on screen.
  if (/\b(launch pad|pad 39|launch complex|mobile launcher|rollout|roll out|vehicle assembly building|vab\b|crawler|countdown|liftoff|launch site|gantry|service structure)/.test(b)) return 'launch_site';

  // Earth, outdoors.
  if (/\b(antarctic|arctic|greenland|ice sheet|ice shelf|glacier|sea ice|permafrost|polar)/.test(b)) return 'polar';
  if (/\b(volcan|eruption|lava|caldera|magma|kilauea|etna)/.test(b)) return 'volcanic';
  if (/\b(forest|desert|canyon|wilderness|field campaign|expedition|wetland|savanna|tundra|reef|rainforest|mountain|river|delta|estuary|watershed)/.test(b)) return 'wilderness';

  // Indoors, being built or broken on purpose.
  if (/\b(wind tunnel|laboratory|lab\b|clean ?room|vacuum chamber|thermal vacuum|drop test|centrifuge|assembly|encapsulat|integration|processing facility|hangar|simulator|mock-?up|test chamber|acoustic test|vibration test)/.test(b)) return 'laboratory';

  // Aircraft over the planet: the airborne campaigns are field work, and the
  // aeronautics testing is not a place so much as a machine in the sky.
  if (/\b(research aircraft|airborne|dc-8|er-2|p-3\b|gulfstream|flight test|in flight|supersonic|x-59|x-plane)/.test(b)) return 'wilderness';

  return 'unknown';
}

/**
 * A NASA centre is a place footage can be SHOT, and also the place it is
 * FILED. Only the first one is a location.
 *
 * `AVAIL:Location` names the centre that holds the asset. Taken literally it
 * put 296 items on a pin in Greenbelt, Maryland - Hubble servicing EVAs, Webb,
 * lunar orbiter data, Greenland ice flights, a desert field test - and made
 * Goddard Space Flight Center the largest place on the globe by a factor of
 * two. The field was honest about being a facility address; it was still the
 * wrong answer to "where is this".
 *
 * So the address stands only where the footage is plausibly at the facility: a
 * clean room, a test stand, a pad. Off Earth it becomes a mission location.
 * Anywhere else on Earth it keeps no coordinates at all, which is what this
 * project does everywhere it does not know - say so, and plot nothing.
 */
const AT_A_GROUND_FACILITY = new Set<FrontierEnvironment>(['laboratory', 'launch_site']);

const OFF_EARTH_FOR: Partial<Record<FrontierEnvironment, { type: FrontierLocation['type']; name: string }>> = {
  orbit: { type: 'earth_orbit', name: 'Earth orbit' },
  lunar: { type: 'moon', name: 'The Moon' },
  martian: { type: 'mars', name: 'Mars' },
  deep_space: { type: 'deep_space', name: 'Deep space' },
};

function correctFacilityLocation(
  location: FrontierLocation,
  environment: FrontierEnvironment,
): FrontierLocation {
  if (location.type !== 'earth_surface') return location;
  if (AT_A_GROUND_FACILITY.has(environment)) return location;

  const held = location.displayName || 'a NASA centre';
  const because = `NASA lists this asset against ${held}, which is where it is held rather than `
    + 'where it was recorded. No position is claimed.';

  const target = OFF_EARTH_FOR[environment];
  if (target) {
    return { type: target.type, displayName: target.name, accuracy: 'mission', coordinateSource: because };
  }
  return { type: 'earth_surface', accuracy: 'mission', coordinateSource: because };
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

      // Collect candidates across pages first, then resolve their assets in
      // parallel. One page used to be the whole harvest: a query matching
      // nine hundred videos contributed at most a hundred candidates, and the
      // catalog was a thin sample of a large library for no reason other than
      // the loop shape.
      const candidates: Array<{ d: NasaSearchItem['data'][0]; thumb?: string }> = [];
      for (let page = 1; page <= MAX_SEARCH_PAGES && candidates.length < perQuery; page += 1) {
        const url = `${SEARCH}?q=${encodeURIComponent(q)}&media_type=video`
          + `&page_size=${SEARCH_PAGE_SIZE}&page=${page}`;
        const res = await getJson<{ collection: { items: NasaSearchItem[] } }>(url, {
          fetchImpl: opts.fetchImpl, logger: log,
        });
        const items = res?.collection?.items || [];
        if (items.length === 0) break;

        for (const it of items) {
          if (candidates.length >= perQuery) break;
          const d = it.data?.[0];
          if (!d || d.media_type !== 'video' || seen.has(d.nasa_id)) continue;
          const description = (d.description || d.description_508 || '').trim();
          if (!looksLikeRealFootage(d.title || '', description, d.keywords || [])) continue;
          seen.add(d.nasa_id);
          candidates.push({ d, thumb: (it.links || []).find((l) => l.render === 'image')?.href });
        }
        if (items.length < SEARCH_PAGE_SIZE) break; // last page
      }

      const room = Math.min(candidates.length, Math.max(0, limit - out.length));
      const resolved = await mapWithConcurrency(
        candidates.slice(0, room),
        ASSET_CONCURRENCY,
        async ({ d, thumb }): Promise<NasaRawItem | null> => {
          const enc = encodeURIComponent(d.nasa_id);
          const assets = await getJson<string[]>(`${ASSETS}/${enc}/collection.json`, {
            fetchImpl: opts.fetchImpl, logger: log,
          });
          if (!assets) return null;
          const { url: streamUrl, fallback, captions } = pickNasaRenditions(assets);
          if (!streamUrl) return null;

          const meta = await getJson<Record<string, unknown>>(`${ASSETS}/${enc}/metadata.json`, {
            fetchImpl: opts.fetchImpl, logger: log,
          });

          const durationSeconds = parseQuickTimeDuration(meta?.['QuickTime:Duration'])
            ?? parseQuickTimeDuration(meta?.['QuickTime:MediaDuration'])
            ?? parseXmpDuration(meta?.['XMP:Duration']);
          const width = Number(meta?.['QuickTime:ImageWidth'] ?? meta?.['QuickTime:SourceImageWidth']) || undefined;
          const height = Number(meta?.['QuickTime:ImageHeight'] ?? meta?.['QuickTime:SourceImageHeight']) || undefined;

          return {
            nasaId: d.nasa_id,
            title: (d.title || '').trim(),
            description: (d.description || d.description_508 || '').trim(),
            keywords: d.keywords || [],
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
          };
        },
      );

      let taken = 0;
      for (const item of resolved) {
        if (!item || out.length >= limit) continue;
        out.push(item);
        taken += 1;
      }
      log?.info(`NASA "${q}": ${taken} kept`);
    }
    return out;
  }

  normalize(raw: RawProviderItem): FrontierMediaItem | null {
    const r = raw as NasaRawItem;
    if (!r.title || !r.streamUrl) return null;

    const stated = resolveNasaLocation(r.title, r.metadataLocation);
    const blob = `${r.title} ${r.description} ${r.keywords.join(' ')}`;
    const environment = resolveNasaEnvironment(stated, blob);
    const location = correctFacilityLocation(stated, environment);

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
