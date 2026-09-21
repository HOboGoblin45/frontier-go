import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import AboutScreen from '../../components/AboutScreen.jsx';
import { FirstRunHint } from '../../components/TrailerRoulette.jsx';
import { LINKS, THEATER_MODE_ENABLED } from '../release.js';

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
