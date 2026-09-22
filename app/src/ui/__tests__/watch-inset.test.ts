import { describe, expect, it } from 'vitest';
import { chromeInset, pictureInsets } from '../screens/Watch';

/**
 * The bug this guards: the picture was drawn under the text, so the title sat
 * on the footage - and on NOAA material directly over the expedition card
 * burned into the opening seconds of the clip.
 */
describe('chromeInset', () => {
  const VIEWPORT = 932; // iPhone 16 Pro, points

  it('measures from the block top to the bottom of the viewport', () => {
    // A 391pt block sitting above an 83pt tab bar starts at 458.
    expect(chromeInset({ top: 458 }, VIEWPORT, false)).toBe(474);
  });

  it('does not stop at the block itself', () => {
    // The block's own height is 391. Reporting that would leave the picture
    // overlapping the tab bar by 83pt - the near-miss that reads as a
    // rounding error and is not one.
    expect(chromeInset({ top: 458 }, VIEWPORT, false)).not.toBe(391);
  });

  it('gives the whole screen back when the chrome is idle', () => {
    expect(chromeInset({ top: 458 }, VIEWPORT, true)).toBe(0);
  });

  it('claims nothing when there is no chrome to measure', () => {
    expect(chromeInset(null, VIEWPORT, false)).toBe(0);
    expect(chromeInset(undefined, VIEWPORT, false)).toBe(0);
  });

  it('never returns a negative inset', () => {
    // A block reported below the fold, mid-transition or mid-rotation.
    expect(chromeInset({ top: VIEWPORT + 120 }, VIEWPORT, false)).toBe(0);
  });

  it('claims the whole plane if the chrome starts at the top', () => {
    expect(chromeInset({ top: 0 }, VIEWPORT, false)).toBe(VIEWPORT);
  });

  it('follows the viewport, not a fixed screen size', () => {
    // Rotation, a different device, or the keyboard shrinking the viewport.
    expect(chromeInset({ top: 300 }, 430, false)).toBe(130);
  });
});

describe('pictureInsets', () => {
  const VIEWPORT = 932;

  it('upright, puts the picture in its own frame under the top bar', () => {
    // Top bar ends at 110; a 16:9 frame on a 430pt-wide screen is 242 tall.
    expect(pictureInsets({ stage: { top: 110, bottom: 352 }, chrome: { top: 352 }, viewportHeight: VIEWPORT, idle: false }))
      .toEqual({ top: 110, bottom: 580 });
  });

  it('upright, does not move the picture when the chrome idles', () => {
    const awake = pictureInsets({ stage: { top: 110, bottom: 352 }, chrome: { top: 352 }, viewportHeight: VIEWPORT, idle: false });
    const idle = pictureInsets({ stage: { top: 110, bottom: 352 }, chrome: { top: 352 }, viewportHeight: VIEWPORT, idle: true });
    expect(idle).toEqual(awake);
  });

  it('sideways, falls back to floating chrome over a full-window picture', () => {
    expect(pictureInsets({ stage: null, chrome: { top: 300 }, viewportHeight: 430, idle: false })).toEqual({ top: 0, bottom: 130 });
    expect(pictureInsets({ stage: null, chrome: { top: 300 }, viewportHeight: 430, idle: true })).toEqual({ top: 0, bottom: 0 });
  });

  it('ignores a collapsed frame', () => {
    expect(pictureInsets({ stage: { top: 200, bottom: 200 }, chrome: { top: 500 }, viewportHeight: VIEWPORT, idle: false })).toEqual({ top: 0, bottom: 432 });
  });
});
