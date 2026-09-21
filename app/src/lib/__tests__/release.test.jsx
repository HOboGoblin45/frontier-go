import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import AboutScreen from '../../components/AboutScreen.jsx';
import { FirstRunHint } from '../../components/TrailerRoulette.jsx';
import { LINKS, THEATER_MODE_ENABLED, POLICY_VERSION, consentGate } from '../release.js';

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

  it('cannot reach the unknown state from a resolved read', () => {
    // The unknown state renders NOTHING - not the sheet, not the player. It is
    // correct for the moment before the read lands and catastrophic if it can
    // be reached afterwards, so the boot effect coerces undefined to null
    // before the gate sees it.
    const asBootEffectPassesIt = (resolved) => consentGate(resolved ?? null);
    expect(asBootEffectPassesIt(undefined)).toBe(true);
    expect(asBootEffectPassesIt(null)).toBe(true);
    expect(asBootEffectPassesIt(POLICY_VERSION)).toBe(false);
  });

  it('fails closed: a read that throws must ask again', () => {
    // The boot effect catches and passes null rather than letting an
    // exception decide. Assuming acceptance on a broken device would record
    // consent that was never given.
    let accepted;
    try { throw new Error('Preferences unavailable'); } catch { accepted = null; }
    expect(consentGate(accepted)).toBe(true);
  });

  it('gates playback on accepted, not on "not shown"', () => {
    // The player-wrap condition is `hintOpen === false`. Under the old
    // `!hintOpen` it would have mounted during the unknown window too.
    for (const state of [consentGate(undefined), consentGate(null)]) {
      expect(state === false).toBe(false);
    }
    expect(consentGate(POLICY_VERSION) === false).toBe(true);
  });
});
