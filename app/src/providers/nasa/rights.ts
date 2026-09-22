import type { FrontierRightsMetadata } from '../../core/types/rights';
import type { FrontierSafetyMetadata } from '../../core/types/safety';
import { SAFE_DEFAULTS } from '../../core/types/safety';

/**
 * NASA rights rules, taken from the agency's published media guidelines: NASA
 * content is generally not copyrighted, but four categories are carved out and
 * all four are things this catalog must respect rather than assume away —
 * third-party and contractor material (marked with the copyright holder's
 * name), licensed music, identifiable people (whose publicity rights survive
 * NASA's own position), and the NASA insignia and logotype, which are
 * explicitly NOT public domain.
 *
 * Source: https://www.nasa.gov/nasa-brand-center/images-and-media/
 *
 * Insignia presence cannot be determined from metadata, so it is recorded as a
 * standing human-review item in docs/RIGHTS-REVIEW.md rather than pretended
 * away here. Everything that CAN be read from metadata is read and enforced.
 */

export const NASA_RIGHTS_URL = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
export const NASA_ORGANIZATION = 'NASA';

const COPYRIGHT_MARKERS = [
  'copyright', '©', '(c) 20', 'all rights reserved', 'used with permission',
  'courtesy of', 'used by permission', 'getty', 'reuters', 'associated press',
  'licensed from', 'music by', 'music provided by', 'song by', 'artist:',
];

export function nasaHasRightsMarker(...texts: Array<string | undefined | null>): boolean {
  const blob = texts.filter(Boolean).join(' ').toLowerCase();
  return COPYRIGHT_MARKERS.some((m) => blob.includes(m));
}

/**
 * Filenames carry rights evidence that the metadata fields do not.
 *
 * NASA names assets like `MAF_20190917_Artemis 1 ES Join_Music_Artemis logo`:
 * the `Music` and `logo` segments say the piece contains licensed music and
 * agency branding, and neither word appears in the title, the description or
 * the keywords. Prose cannot be searched for a bare "music" without catching
 * every mention of the music of the spheres, so this looks at path SEGMENTS
 * rather than substrings.
 */
const ASSET_PATH_MARKERS = new Set([
  'music', 'musicbed', 'copyright', 'copyrighted', 'courtesy',
  'licensed', 'license', 'getty', 'insignia', 'meatball',
]);

export function nasaAssetPathHasMarker(...paths: Array<string | undefined | null>): boolean {
  for (const raw of paths) {
    if (!raw) continue;
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch { /* keep the raw form */ }
    const segments = decoded.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (segments.some((seg) => ASSET_PATH_MARKERS.has(seg))) return true;
  }
  return false;
}

/** The NASA field centres. A secondary creator outside this set is a person. */
const NASA_CENTERS = new Set([
  'HQ', 'JSC', 'KSC', 'GSFC', 'JPL', 'ARC', 'AFRC', 'DFRC', 'GRC', 'LaRC', 'MSFC', 'SSC', 'WFF', 'NSSC', 'MAF',
]);

export function nasaRights(
  opts: {
    description?: string; title?: string; keywords?: string[];
    secondaryCreator?: string; center?: string; assetPaths?: Array<string | undefined>;
  },
  verifiedAt: string,
): FrontierRightsMetadata {
  const blob = `${opts.title || ''} ${opts.description || ''} ${(opts.keywords || []).join(' ')}`;
  if (nasaHasRightsMarker(blob, opts.secondaryCreator) || nasaAssetPathHasMarker(...(opts.assetPaths || []))) {
    return {
      classification: 'unknown',
      commercialUseAllowed: false,
      attributionRequired: true,
      sourceRightsUrl: NASA_RIGHTS_URL,
      verifiedAt,
      cachingAllowed: false,
      basis: 'Third-party credit, licence, music or branding marker present in the metadata or the asset filename; NASA marks non-public-domain material this way.',
    };
  }
  const centre = (opts.center || '').trim();
  const attribution = centre && NASA_CENTERS.has(centre) ? `NASA/${centre}` : NASA_ORGANIZATION;
  return {
    classification: 'government_work',
    commercialUseAllowed: true,
    attributionRequired: true,
    attributionText: attribution,
    sourceRightsUrl: NASA_RIGHTS_URL,
    verifiedAt,
    cachingAllowed: false,
    basis: 'U.S. Government work published by NASA with no third-party copyright, licence or music marker in the metadata.',
  };
}

/**
 * NASA safety review. The dominant risk is people: NASA's own guidance says
 * commercial use of media showing identifiable individuals may infringe their
 * privacy or publicity rights, so anything that is fundamentally a person on
 * camera is flagged out of the default feed. That filter happens to align
 * exactly with the product: Frontier Go wants the place, not the podium.
 */
/**
 * Talking-head formats. These name what the piece IS, so they are read from
 * the title; a description that happens to mention a briefing is usually
 * describing when the footage was shown, not what is in it.
 *
 * `panel` used to be here bare and took "Orion Crew Module Cone Panel" with
 * it - hardware footage, killed by a substring. Anything that is also a piece
 * of spacecraft gets its qualifier.
 */
const PERSON_TITLE_FORMATS = [
  'nasa science live', 'town hall', 'interview', 'q&a', 'ask nasa',
  'panel discussion', 'ceremony', 'award', 'swearing-in', 'administrator',
  'testimony', 'hearing', 'welcome remarks', 'keynote', 'welcome address',
  'podcast', 'webinar', 'profile:', 'meet the', 'we are nasa',
  'in-flight event', 'educational downlink', 'public affairs', 'soundbites',
];

/** Unambiguous wherever they appear. */
const PERSON_ANY_FORMATS = [
  'press conference', 'news conference', 'post-flight news', 'media briefing',
];
const MILITARY_CUES = ['weapon', 'missile defense', 'warfighter', 'combat', 'classified payload'];

export function nasaSafety(
  opts: { title: string; description: string; keywords: string[] },
): FrontierSafetyMetadata {
  const lowerTitle = opts.title.toLowerCase();
  const blob = `${opts.title} ${opts.description} ${opts.keywords.join(' ')}`.toLowerCase();
  return {
    ...SAFE_DEFAULTS,
    identifiablePersons: PERSON_TITLE_FORMATS.some((c) => lowerTitle.includes(c))
      || PERSON_ANY_FORMATS.some((c) => blob.includes(c)),
    sensitiveMilitaryContent: MILITARY_CUES.some((c) => blob.includes(c)),
  };
}

/**
 * Editorial filter, separate from safety: recorded broadcasts, animations and
 * graphics packages are rights-clean and still not what this product is. It is
 * a window into real places, so a simulation is out even when it is beautiful.
 */
const NOT_FOOTAGE = [
  // Synthetic imagery. Beautiful, and not a real place.
  'animation', 'animated', 'conceptual', 'artist concept', 'artist concept video',
  'simulation', 'simulated', 'visualization', 'visualisation', 'infographic',
  'illustration', 'rendering', 'concept video',
  // Produced explainer and magazine formats: narration over stock and graphics.
  'sciencecasts', 'science casts', 'this week at nasa', 'nasa edge',
  'nasa explorers', 'mars report', 'explainer', 'what would', 'how it works',
  'tour of', 'behind the scenes', 'recap', 'year in review', 'highlights of',
  'top 10', 'top ten', 'countdown to',
  // Marketing and housekeeping.
  'trailer', 'teaser', 'promo', 'logo', 'graphics package', 'b-roll package',
  'audio only', 'public service announcement', 'social media',
  // Someone standing in front of a thing, describing the thing. Found in the
  // catalog rather than imagined: "Keith Higginbotham Discusses the Launch
  // Vehicle Stage Adapter", "X-59 Team Reflects on Completing First Flight",
  // "A message from NASA Administrator...", "Procter & Gamble Works With NASA
  // Glenn Research Center", "NASA Puts Football Through Same Paces as...".
  'discusses', 'reflects on', 'talks with', 'a message from', 'looks back',
  'works with nasa', 'celebrates', 'anniversary of',
];

/**
 * Positive signal. Excluding the formats we know about is not enough on its
 * own — NASA publishes a great deal of narrated explainer material that names
 * no format at all. So an item must also look like a recording of something
 * happening: a view, a test, a launch, a pass over a place.
 */
const FOOTAGE_CUES = [
  'view', 'views', 'timelapse', 'time-lapse', 'time lapse', 'flyover', 'fly-over',
  'launch', 'liftoff', 'lift-off', 'test', 'hot fire', 'static fire', 'firing',
  'eva', 'spacewalk', 'space walk', 'landing', 'touchdown', 'descent', 'ascent',
  'rollout', 'roll out', 'docking', 'undocking', 'splashdown', 'recovery',
  'surface', 'panorama', 'onboard', 'camera', 'footage', 'raw', '4k', 'uhd',
  'aurora', 'earth from', 'from orbit', 'orbit', 'flight', 'drop test',
  'parachute', 'wind tunnel', 'glacier', 'ice sheet', 'sea ice', 'eruption',
  'plume', 'crawler', 'transporter', 'pad', 'stacking', 'expedition',
  'rover', 'helicopter', 'capsule', 'rocket', 'engine', 'module', 'deployment',
  'survey', 'overflight', 'sunrise', 'sunset', 'storm', 'hurricane', 'typhoon',
  'volcano', 'crater', 'dust', 'snow', 'forest', 'reef', 'desert', 'canyon',
  'mountain', 'lunar surface', 'martian', 'telescope', 'observatory',
];

export function looksLikeRealFootage(title: string, description: string, keywords: string[]): boolean {
  const blob = `${title} ${description} ${keywords.join(' ')}`.toLowerCase();
  if (NOT_FOOTAGE.some((c) => blob.includes(c))) return false;
  const headline = `${title} ${keywords.join(' ')}`.toLowerCase();
  return FOOTAGE_CUES.some((c) => headline.includes(c));
}
