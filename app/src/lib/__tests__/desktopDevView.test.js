/**
 * The desktop dev view must not reach a shipped build.
 *
 * styles/index.css carries a phone-width column with hairline borders so that
 * `npm run dev` in a desktop browser looks like a device. The media query was
 * width-only (min-width: 900px), and an iPad in portrait is about 1032px, so
 * the shipped iPad build got it: measured in Chromium at 1032px, .app-shell
 * came back 520px wide with a 1px border on each side and roughly half the
 * screen black. Nothing in the build noticed, and the App Store screenshot
 * drafts captured it as if it were the design.
 *
 * CSS media queries cannot be evaluated in this test environment, so these
 * assert the two gates exist rather than their effect. The effect is measured
 * with Playwright at iPad width; the capture script's context options are
 * asserted here too, because a capture without touch emulation reproduces the
 * old drafts and hides a regression instead of showing it.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles/index.css', import.meta.url), 'utf8');
const mainJsx = readFileSync(new URL('../../main.jsx', import.meta.url), 'utf8');
const capture = readFileSync(new URL('../../../../scripts/capture-release-screenshots.mjs', import.meta.url), 'utf8');

/** Every @media block whose condition mentions a min-width at or above 900px. */
function wideMediaConditions(source) {
  return [...source.matchAll(/@media([^{]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((condition) => {
      const min = condition.match(/min-width:\s*(\d+)px/);
      return min !== null && Number(min[1]) >= 900;
    });
}

describe('desktop dev view stays in the browser', () => {
  it('has exactly one wide-viewport block to reason about', () => {
    expect(wideMediaConditions(css)).toHaveLength(1);
  });

  it('gates that block on a pointer no touch device reports', () => {
    const [condition] = wideMediaConditions(css);
    // An iPad reports (hover: none) and (pointer: coarse). A desktop browser
    // reports both of these.
    expect(condition).toContain('(hover: hover)');
    expect(condition).toContain('(pointer: fine)');
  });

  it('excludes the native shell from it outright', () => {
    // Second gate, independent of what iPadOS decides to report.
    const block = css.split(/@media[^{]*min-width:\s*900px[^{]*\{/)[1];
    expect(block).toContain('html:not([data-native])');
    expect(block).toContain('max-width: 520px');
  });

  it('sets the native marker before the app renders', () => {
    // The call site, not the import at the top of the file.
    const markerAt = mainJsx.indexOf('dataset.native');
    const renderAt = mainJsx.indexOf('createRoot(document');
    expect(markerAt).toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(mainJsx).toContain('Capacitor.isNativePlatform()');
    expect(markerAt).toBeLessThan(renderAt);
  });

  it('captures screenshots through a touch context', () => {
    // Without this the drafts show the dev view at iPad width, which is how
    // the letterboxed 13-inch set got made in the first place.
    expect(capture).toContain('hasTouch: true');
    expect(capture).toContain('isMobile: true');
  });
});
