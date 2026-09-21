/**
 * Rights are first-class data. Nothing reaches a viewer without an explicit,
 * recorded answer to "who owns this and what are we allowed to do with it".
 *
 * The gate fails closed: `unknown` is a rejection, not a maybe. There is no
 * "probably public domain" path anywhere in this codebase.
 */

export type RightsClassification =
  | 'public_domain'
  | 'government_work'
  | 'cc0'
  | 'cc_by'
  | 'cc_by_sa'
  | 'commercial_license'
  | 'unknown';

export interface FrontierRightsMetadata {
  classification: RightsClassification;
  /** False or unknown excludes the item from the production feed. */
  commercialUseAllowed: boolean;
  attributionRequired: boolean;
  /** Verbatim credit line supplied by the provider. Never invented. */
  attributionText?: string;
  /** The provider's terms-of-use page, as published. */
  sourceTermsUrl?: string;
  /** The provider's rights/usage page, as published. */
  sourceRightsUrl?: string;
  /** ISO-8601 timestamp of the ingest run that last checked these terms. */
  verifiedAt?: string;
  /** Whether we may keep a local copy of the media itself (not just metadata). */
  cachingAllowed?: boolean;
  /**
   * Machine-readable reason the classification landed where it did. Written by
   * the provider adapter so a human reviewing the catalog can retrace it.
   */
  basis?: string;
}

/** Classifications that may appear in the production feed at all. */
const DISTRIBUTABLE: ReadonlySet<RightsClassification> = new Set<RightsClassification>([
  'public_domain',
  'government_work',
  'cc0',
  'cc_by',
  'cc_by_sa',
  'commercial_license',
]);

/**
 * The single rights gate. Fails closed on anything it has not been told
 * explicitly. Called by the ingestion pipeline and again by the client, so a
 * hand-edited catalog cannot smuggle an item past it.
 */
export function rightsAreClear(rights: FrontierRightsMetadata | undefined): boolean {
  if (!rights) return false;
  if (!DISTRIBUTABLE.has(rights.classification)) return false;
  if (rights.classification === 'unknown') return false;
  if (rights.commercialUseAllowed !== true) return false;
  if (rights.attributionRequired && !rights.attributionText) return false;
  return true;
}

/** Human-readable label for the information sheet. Never a legal opinion. */
export function rightsLabel(rights: FrontierRightsMetadata): string {
  switch (rights.classification) {
    case 'public_domain': return 'Public domain';
    case 'government_work': return 'U.S. Government work';
    case 'cc0': return 'CC0';
    case 'cc_by': return 'CC BY';
    case 'cc_by_sa': return 'CC BY-SA';
    case 'commercial_license': return 'Licensed';
    default: return 'Rights unconfirmed';
  }
}
