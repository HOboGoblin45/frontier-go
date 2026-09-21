import { describe, it, expect } from 'vitest';
import { evaluateEligibility, productionItems } from '../catalog/eligibility';
import { makeItem } from './fixtures';

describe('production eligibility', () => {
  it('accepts a complete, rights-clean, well-formed item', () => {
    expect(evaluateEligibility(makeItem({ id: 'a' })).eligible).toBe(true);
  });

  it('rejects a non-https stream', () => {
    const item = makeItem({ id: 'b' });
    item.stream.url = 'http://example.gov/b.mp4';
    expect(evaluateEligibility(item).reasons).toContain('stream:not-https');
  });

  it('rejects clips too short to be footage', () => {
    const item = makeItem({ id: 'c' });
    item.stream.durationSeconds = 4;
    expect(evaluateEligibility(item).reasons).toContain('quality:too-short');
  });

  it('rejects recorded broadcasts', () => {
    const item = makeItem({ id: 'd' });
    item.stream.durationSeconds = 60 * 52;
    expect(evaluateEligibility(item).reasons).toContain('quality:too-long');
  });

  it('rejects an on-demand item with no duration at all', () => {
    const item = makeItem({ id: 'e' });
    delete item.stream.durationSeconds;
    expect(evaluateEligibility(item).reasons).toContain('quality:no-duration');
  });

  it('rejects sub-SD video', () => {
    const item = makeItem({ id: 'f' });
    item.stream.width = 320; item.stream.height = 240;
    expect(evaluateEligibility(item).reasons).toContain('quality:resolution');
  });

  it('rejects an item with no artwork', () => {
    const item = makeItem({ id: 'g', imagery: {} });
    expect(evaluateEligibility(item).reasons).toContain('quality:no-artwork');
  });

  it('rejects an item whose stream was found unreachable', () => {
    const item = makeItem({ id: 'h' });
    item.health = { productionEligible: true, streamReachable: false };
    expect(evaluateEligibility(item).reasons).toContain('health:unreachable');
  });

  it('re-runs the rights gate on the client, so a hand-edited catalog cannot smuggle an item through', () => {
    const smuggled = makeItem({ id: 'i' });
    smuggled.rights = { ...smuggled.rights, classification: 'unknown', commercialUseAllowed: true };
    smuggled.health = { productionEligible: true };
    expect(productionItems([smuggled])).toHaveLength(0);
  });

  it('keeps only the eligible items in a mixed pool', () => {
    const good = makeItem({ id: 'ok' });
    const bad = makeItem({ id: 'bad' });
    bad.safety = { ...bad.safety, identifiablePersons: true };
    expect(productionItems([good, bad]).map((i) => i.id)).toEqual(['ok']);
  });
});
