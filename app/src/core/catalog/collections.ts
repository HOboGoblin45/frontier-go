import type { FrontierMediaItem } from '../types/media';
import type { FrontierEnvironment } from '../types/location';
import { recentlyAdded } from './catalog';
import { thumbnailFor } from './artwork';

/**
 * Collections: the lean-in half of a lean-back app.
 *
 * Shuffle is the product, and it stays the product. Collections are for the
 * second visit - the person who watched an octopus last night and wants more
 * octopus, or who wants the whole of one expedition. Every collection is
 * derived from metadata the agencies actually publish (NOAA topics and
 * expedition names, NASA mission keywords, the environment the ingest already
 * resolved), so nothing here is a claim the catalog cannot back.
 *
 * A collection plays exactly like the channel does - shuffled, continuous -
 * just inside a smaller world. Leaving it is the same "Go anywhere" as
 * leaving Keep Exploring Here.
 */

export type CollectionKind = 'new' | 'subject' | 'expedition';

export interface Collection {
  id: string;
  kind: CollectionKind;
  title: string;
  /** One line under the title: what it is, how much, how long. */
  subtitle: string;
  itemIds: string[];
  posterUrl?: string;
  totalSeconds: number;
}

/** A collection with fewer clips than this is a playlist, not a place to stay. */
export const MIN_COLLECTION = 5;

interface SubjectRule {
  id: string;
  title: string;
  blurb: string;
  tags?: string[];
  environments?: FrontierEnvironment[];
  titlePattern?: RegExp;
}

/**
 * Order is editorial: the strongest openers first, the deep sea and space
 * interleaved so the list reads as a range rather than two catalogs.
 */
const SUBJECTS: SubjectRule[] = [
  { id: 'cephalopods', title: 'Octopus and squid', blurb: 'Cephalopods of the deep', titlePattern: /octopus|squid|cephalopod|cirrate|dumbo/i },
  { id: 'mars', title: 'Mars, up close', blurb: 'Rovers, a helicopter, a landing', tags: ['Mars', 'Rover'], environments: ['martian'] },
  { id: 'vents', title: 'Vents and seeps', blurb: 'Where the seafloor breathes', tags: ['Hydrothermal Vents & Volcanoes', 'Cold Seeps'], titlePattern: /\bvent|chimney|seep/i },
  { id: 'spacewalks', title: 'Spacewalks', blurb: 'Outside the station', tags: ['Spacewalk', 'EVA'] },
  { id: 'jellies', title: 'Jellies', blurb: 'Siphonophores, ctenophores, medusae', titlePattern: /jell|siphonophore|ctenophore|medusa|hydromedusa/i },
  { id: 'apollo', title: 'Apollo', blurb: 'The first Moon landings', tags: ['Apollo'] },
  { id: 'fish', title: 'Deep-sea fish', blurb: 'Anglerfish to swordfish', tags: ['Fish'] },
  { id: 'launch', title: 'Liftoff', blurb: 'Rollout, countdown, launch', tags: ['Launch'], environments: ['launch_site'] },
  { id: 'corals', title: 'Deep-sea corals', blurb: 'Forests without sunlight', tags: ['Corals'] },
  { id: 'station', title: 'Life on the station', blurb: 'Four hundred kilometres up', tags: ['ISS', 'International Space Station'] },
  { id: 'wrecks', title: 'Shipwrecks', blurb: 'Maritime heritage on the seafloor', tags: ['Maritime Heritage'], titlePattern: /wreck/i },
  { id: 'artemis', title: 'Artemis', blurb: 'Going back to the Moon', tags: ['Artemis', 'Artemis II', 'Space Launch System'] },
  { id: 'storms', title: 'Storms from above', blurb: 'Hurricanes seen from orbit', tags: ['Storm'], titlePattern: /hurricane|typhoon|cyclone|tropical storm/i },
  { id: 'engines', title: 'Engines on the stand', blurb: 'Rocket engines, fired and held down', tags: ['Engine test', 'RS-25'] },
  { id: 'glow', title: 'Bioluminescence', blurb: 'Light in the dark', tags: ['Bioluminescence'], titlePattern: /biolumin/i },
  { id: 'telescopes', title: 'Telescopes', blurb: 'Hubble, Webb and the view back', tags: ['Observatory', 'Hubble Space Telescope', 'HST', 'James Webb Space Telescope'] },
  { id: 'ice', title: 'Ice', blurb: 'Greenland, Antarctica, the Arctic', tags: ['Polar', 'Ice', 'Arctic', 'Glacier'], environments: ['polar'] },
  { id: 'sun', title: 'The Sun', blurb: 'Flares and the solar wind', tags: ['Sun', 'Solar Flares', 'Solar Wind'] },
  { id: 'robots', title: 'Underwater robots', blurb: 'The machines that go down', tags: ['Underwater Robots'] },
  { id: 'volcanoes', title: 'Volcanoes', blurb: 'Where the earth opens', tags: ['Volcano'], environments: ['volcanic'] },
  { id: 'asteroids', title: 'Asteroids', blurb: 'Bennu, Psyche, DART', tags: ['Asteroid'] },
  { id: 'flight', title: 'Flight research', blurb: 'Aircraft built to learn something', tags: ['Aeronautics'] },
];

function matchesSubject(item: FrontierMediaItem, rule: SubjectRule): boolean {
  if (rule.tags && item.tags.some((t) => rule.tags!.includes(t))) return true;
  if (rule.environments && rule.environments.includes(item.environment)) return true;
  if (rule.titlePattern && rule.titlePattern.test(item.title)) return true;
  return false;
}

/**
 * NOAA names expeditions for its own records:
 * "2021 North Atlantic Stepping Stones: New England and Corner Rise Seamounts (EX2104)".
 * The title is the part a person would say; the year goes in the subtitle.
 */
export function expeditionTitle(name: string): { title: string; year?: string } {
  const year = name.match(/\b(19|20)\d{2}\b/)?.[0];
  let t = name
    .replace(/\s*\((EX|NF|RB)\d{3,}[^)]*\)\s*$/i, '')
    .replace(/^(19|20)\d{2}\s+/, '')
    .replace(/\s+(19|20)\d{2}\b/, '');
  const colon = t.indexOf(':');
  if (colon > 8) t = t.slice(0, colon);
  t = t.replace(/\s*[–—-]\s*Remotely Operated Vehicle.*$/i, '').trim();
  return { title: t || name, year };
}

export function formatRuntime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function build(id: string, kind: CollectionKind, title: string, lead: string | undefined, items: FrontierMediaItem[]): Collection {
  const totalSeconds = items.reduce((sum, i) => sum + (i.stream.durationSeconds || 0), 0);
  const count = `${items.length} ${items.length === 1 ? 'clip' : 'clips'}`;
  // The cover is the member the quality score rates highest, not whichever
  // came first: the first NASA item in a subject is as likely to be a logo
  // slate as a frame of the mission.
  const poster = [...items]
    .filter((i) => thumbnailFor(i))
    .sort((a, b) => (b.ranking?.contentQuality ?? 0) - (a.ranking?.contentQuality ?? 0)
      || (b.stream.durationSeconds ?? 0) - (a.stream.durationSeconds ?? 0))[0];
  return {
    id,
    kind,
    title,
    subtitle: [lead, count, formatRuntime(totalSeconds)].filter(Boolean).join(' · '),
    itemIds: items.map((i) => i.id),
    posterUrl: thumbnailFor(poster),
    totalSeconds,
  };
}

/**
 * Every collection the given pool can honestly support, in display order:
 * what is new, then subjects, then whole expeditions.
 */
export function buildCollections(pool: readonly FrontierMediaItem[], now = Date.now()): Collection[] {
  const out: Collection[] = [];

  const fresh = recentlyAdded([...pool], now);
  if (fresh.length >= 3) out.push(build('new', 'new', 'New this week', 'Just arrived', fresh));

  for (const rule of SUBJECTS) {
    const members = pool.filter((i) => matchesSubject(i, rule));
    if (members.length >= MIN_COLLECTION) out.push(build(`subject:${rule.id}`, 'subject', rule.title, rule.blurb, members));
  }

  const byExpedition = new Map<string, FrontierMediaItem[]>();
  for (const item of pool) {
    const name = item.source.expedition;
    if (!name) continue;
    const list = byExpedition.get(name) || [];
    list.push(item);
    byExpedition.set(name, list);
  }
  const expeditions = [...byExpedition.entries()]
    .filter(([, items]) => items.length >= MIN_COLLECTION)
    .sort((a, b) => b[1].length - a[1].length);
  // "Beyond the Blue" is a programme with several cruises under it. When two
  // expeditions shorten to the same words, keep the place that tells them apart.
  const named = expeditions.map(([name, items]) => ({ name, items, ...expeditionTitle(name) }));
  const seen = new Map<string, number>();
  for (const e of named) seen.set(`${e.title}|${e.year ?? ''}`, (seen.get(`${e.title}|${e.year ?? ''}`) || 0) + 1);
  for (const e of named) {
    let title = e.title;
    if ((seen.get(`${e.title}|${e.year ?? ''}`) || 0) > 1) {
      // The agency's own full name, less the cruise code and leading year.
      title = e.name.replace(/\s*\((EX|NF|RB)\d{3,}[^)]*\)\s*$/i, '').replace(/^(19|20)\d{2}\s+/, '').trim();
    }
    out.push(build(`expedition:${e.name}`, 'expedition', title, e.year ? `Expedition ${e.year}` : 'Expedition', e.items));
  }

  return out;
}
