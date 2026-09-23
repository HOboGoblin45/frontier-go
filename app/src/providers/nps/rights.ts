import type { FrontierRightsMetadata } from '../../core/types/rights';
import type { FrontierSafetyMetadata } from '../../core/types/safety';
import { SAFE_DEFAULTS } from '../../core/types/safety';

/**
 * National Park Service rights, from the NPS's own statement and each video's
 * credit line.
 *
 * The NPS disclaimer (https://www.nps.gov/aboutus/disclaimer.htm), checked
 * 2026-09-23, says: "material created by the National Park Service and
 * presented on this website, unless otherwise indicated, is generally
 * considered in the public domain", and separately that "not all materials
 * appearing on this website ... are in the public domain."
 *
 * So the credit line is the "otherwise indicated". Fail closed:
 *
 * - no credit at all: NPS material, nothing indicated otherwise -> U.S.
 *   Government work;
 * - a credit that is the NPS, a park or another federal bureau, optionally
 *   with a person's name ("NPS/Neal Herbert", "Glacier National Park") ->
 *   U.S. Government work;
 * - a Creative Commons credit -> that licence, and only BY or BY-SA pass
 *   (ND and NC are rejected: the gate has no class for them);
 * - anything else - a person alone, a production company, a partner
 *   organisation, "courtesy of", a copyright sign - is a third party the
 *   NPS is crediting, and it is rejected.
 */

export const NPS_ORGANIZATION = 'National Park Service';
export const NPS_RIGHTS_URL = 'https://www.nps.gov/aboutus/disclaimer.htm';
export const NPS_TERMS_URL = 'https://www.nps.gov/aboutus/disclaimer.htm';

/** Federal authors whose own work carries no U.S. copyright (17 U.S.C. 105). */
const FEDERAL_BODIES = /^(nps|national park service|u\.?s\.? national park service|harpers ferry center|ncptt|national center for preservation technology and training|usgs|u\.?s\.? geological survey|usfws|u\.?s\.? fish (and|&) wildlife service|noaa|nasa|national oceanic and atmospheric administration)$/i;
/** A park unit on its own ("Glacier National Park"), not "X with Y National Park". */
const PARK_UNIT = /^(?!.*\b(with|and|for|by|of the friends)\b)(the )?[a-z .'-]+ (national park|national historical park|national historic site|national monument|national memorial|national seashore|national lakeshore|national recreation area|national preserve|national river|national scenic river|national battlefield|national battlefield park|national military park|national historic trail|national scenic trail|national parkway)$/i;
const FEDERAL = { test: (author: string) => FEDERAL_BODIES.test(author) || PARK_UNIT.test(author) };

/** A credit line that names someone other than the government. */
const THIRD_PARTY = /(©|\(c\)|copyright|all rights reserved|courtesy|used with permission|licensed|productions?\b|media\b|studios?\b|films?\b|pictures\b|llc\b|inc\b|ltd\b|conservancy|foundation|association|society|university|college|museum|school|project\b|task force|commission|humane|writing project|interpreting)/i;

function ccLicence(credit: string): 'cc_by' | 'cc_by_sa' | 'rejected' | null {
  const m = credit.match(/creativecommons\.org\/licenses\/([a-z-]+)\//i)
    || credit.match(/creative commons attribution(-[a-z]+)*|\bcc[- ]by(-[a-z]+)*/i);
  if (!m) return null;
  const s = m[0].toLowerCase();
  if (/nd|noderiv|nc|noncommercial/.test(s)) return 'rejected';
  if (/sa|sharealike/.test(s)) return 'cc_by_sa';
  return 'cc_by';
}

export function plainCredit(raw: string | undefined | null): string {
  return (raw || '')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split "NPS/Neal Herbert", "NPS Video: Blum, Wells", "NPS / Jacob W. Frank". */
function authorOf(credit: string): string {
  return credit.split(/\s*(\/|:|\s-\s|\|)\s*/)[0].replace(/\bvideo\b|\bphoto\b/i, '').trim();
}

export function npsRights(creditRaw: string | undefined | null, verifiedAt: string): FrontierRightsMetadata {
  const credit = plainCredit(creditRaw);
  const base = {
    sourceTermsUrl: NPS_TERMS_URL,
    sourceRightsUrl: NPS_RIGHTS_URL,
    verifiedAt,
    cachingAllowed: false,
  };
  if (!credit) {
    return {
      ...base,
      classification: 'government_work',
      commercialUseAllowed: true,
      attributionRequired: false,
      attributionText: NPS_ORGANIZATION,
      basis: 'nps:no-credit-line (NPS-created material is public domain unless otherwise indicated)',
    };
  }
  const cc = ccLicence(credit);
  if (cc === 'rejected') {
    return {
      ...base, classification: 'unknown', commercialUseAllowed: false, attributionRequired: true,
      attributionText: credit, basis: 'nps:credit-cc-nd-or-nc',
    };
  }
  if (cc) {
    return {
      ...base, classification: cc, commercialUseAllowed: true, attributionRequired: true,
      attributionText: credit.replace(/\.?\s*this work is licensed under.*$/i, '').trim() || credit,
      basis: `nps:credit-${cc}`,
    };
  }
  const author = authorOf(credit);
  if (FEDERAL.test(author) && !THIRD_PARTY.test(credit.replace(/national park service|harpers ferry center/gi, ''))) {
    return {
      ...base,
      classification: 'government_work',
      commercialUseAllowed: true,
      attributionRequired: false,
      attributionText: credit,
      basis: `nps:federal-credit (${author})`,
    };
  }
  return {
    ...base, classification: 'unknown', commercialUseAllowed: false, attributionRequired: true,
    attributionText: credit, basis: 'nps:third-party-credit',
  };
}

/**
 * Not what this product is: accessibility duplicates of a clip that also
 * ships plain, meetings, lectures, webinars, announcements, trailers and
 * instructions. All found in the real catalog; the ASL and audio-described
 * versions alone are several hundred.
 */
const NOT_FOOTAGE = /\b(asl|american sign language|audio[- ]described|audio description|described version|descriptive transcript|open[- ]captioned|en espa[nñ]ol|spanish version|in spanish|webinars?|meetings?|public comment|press (conference|briefing|release)|lectures?|lecture series|symposium|panel discussion|conference|workshops?|trainings?|hiring|jobs|careers?|internships?|awards?|grants?|announce(s|ment)|message from|superintendent'?s|budget|environmental assessment|scoping|virtual (program|event|talk|tour|field trip|visit)|live ?stream|facebook live|instagram live|q ?& ?a|podcast|puppet|junior ranger|trailer|teaser|promo|preview|safety|covid|closures?|reopening|parking|shuttle bus|construction|replacement|how to|tips for|faq|social media|slideshow|slide show|powerpoint|introduction to the (series|course)|course|lesson ?\d|module|episode \d+ transcript|contest|photo contest|birthday|happy|passport stamps?|pro tips?|accessibility|reservations?|permits?|orchestra|quintet|quartet|concerts?|band|choir|recital|jazz|r&b|performance|songs?|sing-?along|music video|trivia|quiz|craft|coloring|story ?time|book club|sign language)\b/i;

/** People as the subject: interviews, talks, readings. Publicity rights attach. */
const PERSON_CUES = /\b(interview(s|ed)?|oral histor(y|ies)|in conversation|conversation with|talks? (with|about)|presents|presentation|speaks|speech|remarks|ranger talk|ranger program|storyteller|storytelling|reading of|reads|meet (the|a|our) (ranger|scientist|volunteer|superintendent|artist|author)|study the scientist|portrait of|profile of)\b/i;

const DISTURBING = /\b(lynch(ing|ed)?|massacres?|executions?|executed|terror(ism|ist)?|9\/11|september 11|flight 93|shooting|murder(ed)?|bodies|corpses?|graphic content|suicide|drown(ed|ing)|cockpit voice recorder|crash site)\b/i;

const MODERN_CONFLICT = /\b(iraq|afghanistan|ukraine|gaza|isis|taliban|syria)\b/i;

export function npsIsFootage(title: string): boolean {
  return !NOT_FOOTAGE.test(title);
}

export function npsSafety(title: string, description: string): FrontierSafetyMetadata {
  const blob = `${title} ${description}`;
  return {
    ...SAFE_DEFAULTS,
    identifiablePersons: PERSON_CUES.test(title) || /\boral history\b/i.test(blob),
    disturbingContent: DISTURBING.test(blob),
    sensitiveMilitaryContent: MODERN_CONFLICT.test(blob),
  };
}
