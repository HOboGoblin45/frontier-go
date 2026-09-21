import { describe, it, expect } from 'vitest';
import { rightsAreClear, rightsLabel, type FrontierRightsMetadata } from '../types/rights';
import { safetyIsClear, blockingSafetyFlags, SAFE_DEFAULTS } from '../types/safety';

const clear: FrontierRightsMetadata = {
  classification: 'government_work',
  commercialUseAllowed: true,
  attributionRequired: true,
  attributionText: 'NOAA Ocean Exploration',
};

describe('rights gate', () => {
  it('accepts a documented government work with a credit line', () => {
    expect(rightsAreClear(clear)).toBe(true);
  });

  it('fails closed on unknown classification', () => {
    expect(rightsAreClear({ ...clear, classification: 'unknown' })).toBe(false);
  });

  it('fails closed when commercial use is not allowed', () => {
    expect(rightsAreClear({ ...clear, commercialUseAllowed: false })).toBe(false);
  });

  it('fails closed when attribution is required but no credit line exists', () => {
    expect(rightsAreClear({ ...clear, attributionText: undefined })).toBe(false);
  });

  it('fails closed on missing rights metadata entirely', () => {
    expect(rightsAreClear(undefined)).toBe(false);
  });

  it('never reports a classification it was not given', () => {
    expect(rightsLabel({ ...clear, classification: 'unknown' })).toBe('Rights unconfirmed');
    expect(rightsLabel({ ...clear, classification: 'cc_by' })).toBe('CC BY');
  });
});

describe('safety gate', () => {
  it('passes only when every flag is false', () => {
    expect(safetyIsClear(SAFE_DEFAULTS)).toBe(true);
  });

  it.each([
    'graphicContent', 'disturbingContent', 'identifiablePersons',
    'sensitiveMilitaryContent', 'explicitContent', 'uncertainRights',
  ] as const)('blocks on %s', (flag) => {
    const safety = { ...SAFE_DEFAULTS, [flag]: true };
    expect(safetyIsClear(safety)).toBe(false);
    expect(blockingSafetyFlags(safety)).toContain(flag);
  });

  it('treats missing safety metadata as unsafe', () => {
    expect(safetyIsClear(undefined)).toBe(false);
  });
});
