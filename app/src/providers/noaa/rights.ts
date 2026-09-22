import type { FrontierRightsMetadata } from '../../core/types/rights';
import type { FrontierSafetyMetadata } from '../../core/types/safety';
import { SAFE_DEFAULTS } from '../../core/types/safety';

/**
 * NOAA Ocean Exploration rights rules, taken from the agency's published
 * guidance: most Ocean Exploration imagery and video is in the public domain,
 * but some items are copyrighted and NOAA marks those by putting the word
 * "copyright" in the caption. The credit line in the caption is what they ask
 * to be reproduced.
 *
 * Source: https://oceanexplorer.noaa.gov/about/media-kit/
 *
 * So the rule here is literal and fail-closed: a copyright marker anywhere in
 * the caption, credit or description demotes the item to `unknown`, which the
 * eligibility gate rejects. There is no interpretation step.
 */

export const NOAA_RIGHTS_URL = 'https://oceanexplorer.noaa.gov/about/media-kit/';
export const NOAA_ORGANIZATION = 'NOAA Ocean Exploration';

const COPYRIGHT_MARKERS = [
  'copyright', '©', '(c)', 'all rights reserved',
  'used with permission', 'courtesy of', 'reprinted with permission',
];

export function hasCopyrightMarker(...texts: Array<string | undefined | null>): boolean {
  const blob = texts.filter(Boolean).join(' ').toLowerCase();
  return COPYRIGHT_MARKERS.some((m) => blob.includes(m));
}

export function noaaRights(
  credit: string | undefined,
  captionBlob: string,
  verifiedAt: string,
): FrontierRightsMetadata {
  if (hasCopyrightMarker(credit, captionBlob)) {
    return {
      classification: 'unknown',
      commercialUseAllowed: false,
      attributionRequired: true,
      attributionText: credit || undefined,
      sourceRightsUrl: NOAA_RIGHTS_URL,
      verifiedAt,
      cachingAllowed: false,
      basis: 'Copyright marker present in caption or credit; NOAA marks copyrighted items this way.',
    };
  }
  return {
    classification: 'government_work',
    commercialUseAllowed: true,
    attributionRequired: true,
    attributionText: credit && credit.trim() ? credit.trim() : NOAA_ORGANIZATION,
    sourceRightsUrl: NOAA_RIGHTS_URL,
    verifiedAt,
    // Metadata and artwork only. Source video is streamed, never stored.
    cachingAllowed: false,
    basis: 'U.S. Government work published by NOAA Ocean Exploration with no copyright marker in the caption.',
  };
}

/**
 * Safety review for ocean-exploration footage. The realistic risks here are
 * people on camera (publicity rights) and the occasional specimen-handling or
 * predation clip, not violence — so the flags stay narrow and specific rather
 * than a keyword dragnet that would empty the catalog.
 */
/**
 * Cues that name the FORMAT, and so are only trusted in the title.
 *
 * In a caption these describe the narration, not the picture. "Dr X talks
 * about the armored searobin" is a fish on the seafloor with a voice over it,
 * and the first version of this list threw it away along with "Meet the CTD",
 * "Nereus" and a run of other discovery clips - the exact material the product
 * exists to show. A NOAA title names what the piece is; a caption describes
 * what is in the water.
 */
const PERSON_TITLE_CUES = [
  'interview', 'interviews', 'meet the', 'scientist profile', 'explorer profile',
  'presentation', 'talks about', 'panel discussion', 'webinar',
];

/**
 * Cues that mean a person is on camera wherever they appear. A caption is not
 * going to mention a press conference about footage that is not one.
 */
const PERSON_ANY_CUES = [
  'q&a', 'ask me anything', 'press conference', 'news conference', 'briefing',
  'principal investigator', 'mission team member',
];
const GRAPHIC_CUES = ['dissection', 'necropsy', 'carcass', 'decomposing', 'whale fall'];

export function noaaSafety(title: string, description: string, tags: string[]): FrontierSafetyMetadata {
  const lowerTitle = title.toLowerCase();
  const blob = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  return {
    ...SAFE_DEFAULTS,
    identifiablePersons: PERSON_TITLE_CUES.some((c) => lowerTitle.includes(c))
      || PERSON_ANY_CUES.some((c) => blob.includes(c)),
    graphicContent: GRAPHIC_CUES.some((c) => blob.includes(c)),
  };
}
