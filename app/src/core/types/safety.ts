/**
 * Safety metadata. Conservative by construction: every flag defaults to the
 * cautious value, and any flag set true keeps the item out of the default
 * production feed.
 */

export interface FrontierSafetyMetadata {
  graphicContent: boolean;
  disturbingContent: boolean;
  /** People recognisable enough that publicity/privacy rights could attach. */
  identifiablePersons: boolean;
  sensitiveMilitaryContent: boolean;
  explicitContent: boolean;
  /** Set when the rights review could not reach a confident answer. */
  uncertainRights: boolean;
}

export const SAFE_DEFAULTS: FrontierSafetyMetadata = Object.freeze({
  graphicContent: false,
  disturbingContent: false,
  identifiablePersons: false,
  sensitiveMilitaryContent: false,
  explicitContent: false,
  uncertainRights: false,
});

/** Every flag that disqualifies an item from the default feed. */
export const BLOCKING_FLAGS: ReadonlyArray<keyof FrontierSafetyMetadata> = [
  'graphicContent',
  'disturbingContent',
  'identifiablePersons',
  'sensitiveMilitaryContent',
  'explicitContent',
  'uncertainRights',
];

export function safetyIsClear(safety: FrontierSafetyMetadata | undefined): boolean {
  if (!safety) return false;
  return BLOCKING_FLAGS.every((flag) => safety[flag] === false);
}

export function blockingSafetyFlags(safety: FrontierSafetyMetadata | undefined): string[] {
  if (!safety) return ['missing'];
  return BLOCKING_FLAGS.filter((flag) => safety[flag] === true);
}
