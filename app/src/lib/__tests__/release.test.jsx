import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import AboutScreen from '../../components/AboutScreen.jsx';
import { FirstRunHint } from '../../components/TrailerRoulette.jsx';
import {
  LINKS, THEATER_MODE_ENABLED, POLICY_VERSION, consentGate,
  withTimeout, POLICY_READ_TIMEOUT_MS,
} from '../release.js';

describe('public release surfaces', () => {
  it.each([
    ['About', () => <AboutScreen open onClose={() => {}} />],
    ['first launch', () => <FirstRunHint open onClose={() => {}} />],
  ])('keeps real policy and YouTube links in %s', (_, component) => {
    const html = renderToStaticMarkup(component());
    for (const url of [LINKS.privacy, LINKS.terms, LINKS.youtube]) {
      expect(html).toContain(`href="${url}"`);
    }
    expect(html).not.toContain('href="#"');
  });
  it('keeps developer errors out of About by default', () => {
    const html = renderToStaticMarkup(<AboutScreen open onClose={() => {}} />);
    expect(html).not.toContain('MISSING');
    expect(html).not.toContain('Native player:');
    expect(html).toContain('Troubleshooting details');
    expect(html).toContain('tmdb-logo.svg');
  });
  it('ships with the theater feed disabled and absent from onboarding', () => {
    expect(THEATER_MODE_ENABLED).toBe(false);
    const html = renderToStaticMarkup(<FirstRunHint open onClose={() => {}} />);
    expect(html).not.toContain('<strong>Theaters</strong>');
    expect(html).toContain('Agree and continue');
  });
  it('bundles the privacy declaration in the app target resources', () => {
    const project = readFileSync(new URL('../../../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
    const resources = project.split('/* Begin PBXResourcesBuildPhase section */')[1].split('/* End PBXResourcesBuildPhase section */')[0];
    expect(resources).toContain('PrivacyInfo.xcprivacy in Resources');
  });
});

// The cold-launch consent flash: hintOpen used to start at `true`, so
// FirstRunHint mounted on frame one and every returning user saw the sheet
// appear and play its exit as soon as the stored acceptance arrived. The gate
// is tri-state now, and these pin each branch of it.
describe('first-run consent gate', () => {
  it('stays unknown until the stored value has been read', () => {
    // storage.get() resolves to null for a missing key and never to
    // undefined, so undefined is an unambiguous "not read yet".
    expect(consentGate(undefined)).toBe(null);
  });

  it('renders neither the sheet nor its backdrop while unknown', () => {
    const open = consentGate(undefined) === true;
    expect(open).toBe(false);
    expect(renderToStaticMarkup(<FirstRunHint open={open} onClose={() => {}} />)).toBe('');
  });

  it('skips the sheet only on an exact match for this policy version', () => {
    expect(consentGate(POLICY_VERSION)).toBe(false);
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['an older policy version', '2026-01-01'],
    ['a truthy non-version value', true],
  ])('shows the sheet for %s', (_, stored) => {
    expect(consentGate(stored)).toBe(true);
  });

  it('rejects a read that never settles, rather than waiting on it', async () => {
    // `catch` does not cover a promise that simply never resolves, and on
    // native this read crosses the Capacitor bridge. Without a clock, one
    // stalled call leaves the gate unknown and the app renders nothing at all.
    const never = new Promise(() => {});
    await expect(withTimeout(never, 10)).rejects.toThrow(/timed out/);
  });

  it('passes a value through and does not leave a timer behind', async () => {
    await expect(withTimeout(Promise.resolve(POLICY_VERSION), 1000))
      .resolves.toBe(POLICY_VERSION);
    await expect(withTimeout(Promise.reject(new Error('bridge')), 1000))
      .rejects.toThrow('bridge');
  });

  it('allows a slow but working read to finish', () => {
    // Short enough that nobody stares at a black stage, long enough that a
    // cold Preferences bridge is not cut off mid-answer.
    expect(POLICY_READ_TIMEOUT_MS).toBeGreaterThanOrEqual(1500);
    expect(POLICY_READ_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});

/**
 * Source assertions, not behaviour.
 *
 * The three hand-edits that make the consent fix work live inside
 * TrailerRoulette.jsx, and rendering that component needs a DOM, a Capacitor
 * bridge and a TMDB key - none of which exist in this environment. Earlier
 * versions of these tests re-implemented the conditions locally and would have
 * passed against the reverted code, which is worse than no test. These read the
 * real file. Brittle to refactors, on purpose: each one names the regression it
 * exists to catch.
 */
/** The body of the boot effect, with line comments removed. */
function bootEffectBody(source) {
  const at = source.indexOf('// Boot: restore the saved source');
  if (at === -1) return '';
  const end = source.indexOf('}, []);', at);
  if (end === -1) return '';
  return source.slice(at, end).replace(/^\s*\/\/.*$/gm, '');
}

describe('the consent fix is actually wired into the component', () => {
  const source = readFileSync(new URL('../../components/TrailerRoulette.jsx', import.meta.url), 'utf8');

  it('starts the gate unknown rather than at a boolean guess', () => {
    expect(source).toContain('useState(consentGate(undefined))');
    expect(source).not.toContain('useState(true); // block playback');
  });

  it('gates the player on accepted, not on "sheet not shown"', () => {
    // `!hintOpen` is true while the gate is null, so the old condition would
    // mount the player during the unknown window.
    expect(source).toContain('hintOpen === false && (');
    expect(source).not.toMatch(/\{!activeFeature && !hintOpen &&/);
  });

  it('opens the sheet only on a definite "not accepted"', () => {
    expect(source).toContain('<FirstRunHint open={hintOpen === true}');
  });

  it('reads consent before any other stored preference', () => {
    // The gate's unknown state renders nothing, so this read cannot sit behind
    // unrelated bridge round-trips that might never answer.
    //
    // Scoped to the boot effect and stripped of comments, because every one of
    // these keys is also written elsewhere in the file - and because the first
    // version of this test matched the word loadQueue() inside the comment
    // that explains the fix, which is exactly the kind of false signal a
    // source assertion has to be built against.
    const effect = bootEffectBody(source);
    expect(effect).not.toBe('');
    const consentAt = effect.indexOf('storage.KEYS.POLICY_ACCEPTED');
    expect(consentAt).toBeGreaterThan(-1);
    for (const later of [
      'storage.KEYS.SOURCE', 'storage.KEYS.FILTERS', 'storage.KEYS.MUTED', 'loadQueue()',
    ]) {
      expect(effect.indexOf(later)).toBeGreaterThan(consentAt);
    }
  });

  it('puts a clock on that read and coerces undefined away', () => {
    expect(source).toContain('withTimeout(storage.get(storage.KEYS.POLICY_ACCEPTED))');
    expect(source).toMatch(/\)\) \?\? null;/);
  });
});
