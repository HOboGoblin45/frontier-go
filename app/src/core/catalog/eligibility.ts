import type { FrontierMediaItem } from '../types/media';
import { rightsAreClear } from '../types/rights';
import { safetyIsClear, blockingSafetyFlags } from '../types/safety';

/**
 * Production eligibility. Runs in the ingestion pipeline AND again on the
 * client, so an item cannot reach a viewer because someone hand-edited the
 * catalog file. Both callers use this exact function; there is no second
 * opinion anywhere in the codebase.
 */

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/** Below this, the file is a clip stub or a slate rather than footage. */
export const MIN_DURATION_SECONDS = 8;
/** Above this, it is a recorded broadcast, not a window into a place. */
export const MAX_DURATION_SECONDS = 60 * 25;
export const MIN_WIDTH = 640;
export const MIN_HEIGHT = 360;

export function evaluateEligibility(item: FrontierMediaItem): EligibilityResult {
  const reasons: string[] = [];

  if (!rightsAreClear(item.rights)) {
    reasons.push(`rights:${item.rights?.classification ?? 'missing'}`);
  }
  if (!safetyIsClear(item.safety)) {
    for (const flag of blockingSafetyFlags(item.safety)) reasons.push(`safety:${flag}`);
  }

  const s = item.stream;
  if (!s || !s.url) {
    reasons.push('stream:missing');
  } else {
    if (!/^https:\/\//i.test(s.url)) reasons.push('stream:not-https');
    if (s.type !== 'hls' && s.type !== 'mp4') reasons.push('stream:type');
  }

  const d = s?.durationSeconds;
  if (typeof d === 'number' && d > 0) {
    if (d < MIN_DURATION_SECONDS) reasons.push('quality:too-short');
    if (d > MAX_DURATION_SECONDS) reasons.push('quality:too-long');
  } else if (item.availability !== 'live') {
    reasons.push('quality:no-duration');
  }

  if (typeof s?.width === 'number' && typeof s?.height === 'number') {
    if (s.width < MIN_WIDTH || s.height < MIN_HEIGHT) reasons.push('quality:resolution');
  }

  if (!item.title || item.title.trim().length < 3) reasons.push('quality:no-title');
  if (!item.imagery?.posterUrl && !item.imagery?.thumbnailUrl) reasons.push('quality:no-artwork');

  if (item.health?.streamReachable === false) reasons.push('health:unreachable');

  return { eligible: reasons.length === 0, reasons };
}

/**
 * The client-side filter. Anything failing here never enters a deck, whatever
 * the catalog claims about it.
 */
export function productionItems(items: FrontierMediaItem[]): FrontierMediaItem[] {
  return items.filter((item) => evaluateEligibility(item).eligible);
}
