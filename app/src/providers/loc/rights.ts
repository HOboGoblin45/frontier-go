import type { FrontierRightsMetadata } from '../../core/types/rights';
import type { FrontierSafetyMetadata } from '../../core/types/safety';
import { SAFE_DEFAULTS } from '../../core/types/safety';

/**
 * Library of Congress, National Screening Room.
 *
 * The Library's statement is collection-wide and careful: it "is not aware of
 * any U.S. copyright or other restrictions in the vast majority of motion
 * pictures in these collections", and "Rights assessment is your
 * responsibility." "The vast majority" is not every item, so this gate does
 * not rest on it. An item passes only when its own catalog record supports
 * one of two grounds:
 *
 * 1. A U.S. Government production: a federal body among the record's
 *    contributors ("United States. Department of Agriculture. Motion Picture
 *    Service"), or the record filed in the U.S. Government Films Collection.
 *    No U.S. copyright (17 U.S.C. 105).
 * 2. Published in the United States in 1930 or earlier. Every U.S. copyright
 *    in a work published that long ago has expired (the term for 1930 works
 *    ended on 31 December 2025). The record must say it was published in the
 *    United States; a foreign film of the same year is not assumed.
 *
 * Everything else, including every record with an access advisory or a note
 * that it is shown by special permission, is rejected.
 */

export const LOC_ORGANIZATION = 'Library of Congress';
export const LOC_RIGHTS_URL = 'https://www.loc.gov/collections/national-screening-room/about-this-collection/rights-and-access/';
export const LOC_TERMS_URL = 'https://www.loc.gov/legal/';
export const LOC_CREDIT = 'Library of Congress, Motion Picture, Broadcasting, and Recorded Sound Division';
/** The latest year whose U.S. publications are out of copyright in 2026. */
export const US_PUBLIC_DOMAIN_THROUGH = 1930;

export interface LocRecordFacts {
  date?: string;
  contributors?: string[];
  createdPublished?: string[];
  sourceCollection?: string[];
  notes?: string[];
  accessAdvisory?: string[];
}

export function yearOf(date: string | undefined): number | undefined {
  const m = (date || '').match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}

export function isFederalProduction(f: LocRecordFacts): boolean {
  if ((f.sourceCollection || []).some((s) => /u\.s\. government films collection/i.test(s))) return true;
  return (f.contributors || []).some((c) => /^united states\.\s/i.test(c.trim()));
}

export function publishedInUnitedStates(f: LocRecordFacts): boolean {
  return (f.createdPublished || []).some((p) => /^\[?\s*united states\b(?!\?)/i.test(p.trim()));
}

export function locRights(f: LocRecordFacts, verifiedAt: string): FrontierRightsMetadata {
  const base = {
    sourceTermsUrl: LOC_TERMS_URL,
    sourceRightsUrl: LOC_RIGHTS_URL,
    verifiedAt,
    cachingAllowed: false,
    attributionRequired: false,
    attributionText: LOC_CREDIT,
  };
  const restricted = (f.accessAdvisory || []).length > 0
    || (f.notes || []).some((n) => /special permission|educational purposes only|used by permission|rights restricted|restrictions apply|not for (commercial )?(use|reproduction)/i.test(n));
  if (restricted) {
    return { ...base, classification: 'unknown', commercialUseAllowed: false, basis: 'loc:record-notes-a-restriction' };
  }
  if (isFederalProduction(f)) {
    return { ...base, classification: 'government_work', commercialUseAllowed: true, basis: 'loc:us-government-production' };
  }
  const year = yearOf(f.date);
  if (year !== undefined && year <= US_PUBLIC_DOMAIN_THROUGH && publishedInUnitedStates(f)) {
    return { ...base, classification: 'public_domain', commercialUseAllowed: true, basis: `loc:us-publication-${year}-term-expired` };
  }
  return {
    ...base,
    classification: 'unknown',
    commercialUseAllowed: false,
    basis: year === undefined ? 'loc:no-date' : year > US_PUBLIC_DOMAIN_THROUGH ? `loc:${year}-not-cleared-by-record` : 'loc:not-published-in-us',
  };
}

/** Genres that are real footage of real places and events. */
const NONFICTION = /^(nonfiction films|actualities \(motion pictures\)|newsreels?|newsreel--short|documentary films|educational films|travelogues \(motion pictures\)|industrial films|sponsored films|filmed parades|unedited footage|amateur films|nature films|instructional films|promotional films|nonfiction television programs|compilation films|aerial cinematography)$/i;

/** Staged, performed or invented: not a window into a place. */
const NOT_FOOTAGE = /^(fiction films|comedy films|animated films|melodramas|trick films|fantasy films|romance films|western films|slapstick|peep shows|filmed vaudeville|situation comedies|fiction television|variety shows|panel discussions|live-action\/animation|experimental films|feature films|historical reenactments|filmed performances|filmed dance|filmed speeches|film excerpts|film clips|trailers|advertisements|television commercials)/i;

export function locIsFootage(genres: readonly string[]): boolean {
  if (genres.some((g) => NOT_FOOTAGE.test(g.trim()))) return false;
  return genres.some((g) => NONFICTION.test(g.trim()));
}

/**
 * Early film recorded the attitudes of its day. Catalog headings name the
 * worst of it (caricature, blackface, minstrelsy), and some titles carry slurs
 * outright. Violence and death are flagged the same way.
 */
const DISTURBING_HEADING = /caricatures|blackface|minstrel|stereotypes|racism|lynching|executions?|atrocities|dead|corpses|massacres|cruelty/i;
const SLUR = /\b(coons?|darkies|darkey|darky|pickaninn\w*|nigg\w*|chinks?|chinaman|japs?|squaws?|redskins?|savages?|wops?|dagos?|niggers?)\b/i;

export function locSafety(title: string, headings: readonly string[], genres: readonly string[]): FrontierSafetyMetadata {
  return {
    ...SAFE_DEFAULTS,
    disturbingContent: SLUR.test(title) || headings.some((h) => DISTURBING_HEADING.test(h) || SLUR.test(h)),
    identifiablePersons: genres.some((g) => /interviews|filmed speeches|oral histories/i.test(g)),
  };
}
