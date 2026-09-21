/**
 * The policy pages are the one release surface with no other gate.
 *
 * LINKS in lib/release.js is shipped inside the binary: the first-run consent
 * sheet and About both point at /privacy, /terms and /support. Before 3.5.0
 * two of those three returned 404 and the third was an April page reading
 * "Effective date: TBD", and nothing in the build noticed, because the pages
 * live in landing-page/ and deploy separately from the app. A reviewer
 * following a dead policy link is a rejection, so the app's links and the
 * pages behind them are asserted together here.
 *
 * These assert the CHECKOUT. scripts/verify-production.mjs asserts what is
 * actually deployed; passing here is not evidence that anything is live.
 */
import { readFileSync, existsSync } from 'node:fs';
import { LINKS, POLICY_VERSION, THEATER_MODE_ENABLED } from '../release.js';

const DIR = new URL('../../../../landing-page/', import.meta.url);
const ORIGIN = 'https://trailer-roulette.vercel.app';
const CONTACT = 'crescicharles@gmail.com';

/** Clean URL -> the file cleanUrls serves for it. */
const OWN_PAGES = { '/privacy': 'privacy.html', '/terms': 'terms.html', '/support': 'support.html' };

const read = (name) => readFileSync(new URL(name, DIR), 'utf8');
const pages = Object.fromEntries(Object.entries(OWN_PAGES).map(([route, file]) => [route, read(file)]));
const everyPage = { '/': read('index.html'), ...pages };

/** POLICY_VERSION as the pages spell it: 2026-09-21 -> September 21, 2026. */
const effectiveDate = (() => {
  const [y, m, d] = POLICY_VERSION.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
})();

describe('policy pages behind the in-app links', () => {
  it.each(Object.entries(OWN_PAGES))('serves %s from a file that exists', (route, file) => {
    expect(LINKS[route.slice(1)]).toBe(ORIGIN + route);
    expect(existsSync(new URL(file, DIR))).toBe(true);
  });

  it.each(Object.entries(everyPage))('keeps the policy footer reachable from %s', (_, html) => {
    for (const route of Object.keys(OWN_PAGES)) {
      expect(html).toContain(`href="${route}"`);
    }
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('TBD');
  });

  it('binds users to the YouTube Terms of Service, which is what the API terms require', () => {
    expect(pages['/terms']).toContain('YouTube Terms of Service');
    expect(pages['/terms']).toContain(`href="${LINKS.youtube}"`);
    expect(pages['/terms']).toContain('href="/privacy"');
  });

  it('discloses the third parties the app actually talks to', () => {
    const privacy = pages['/privacy'];
    for (const party of ['YouTube', 'Google', 'TMDB', 'JustWatch', 'Vercel']) {
      expect(privacy).toContain(party);
    }
    expect(privacy).toContain(`href="${LINKS.google}"`);
    expect(privacy).toContain(`href="${LINKS.youtube}"`);
  });

  it('states that YouTube ads are neither sold by us nor suppressed', () => {
    expect(pages['/privacy']).toContain('We do not block or replace YouTube ads');
    expect(pages['/terms']).toContain('YouTube may show ads in its player');
  });

  it('carries an effective date that matches POLICY_VERSION', () => {
    // The consent sheet records acceptance against POLICY_VERSION. If the page
    // and the constant drift, users have agreed to a date that is not printed
    // anywhere they can read it.
    expect(pages['/privacy']).toContain(`Effective ${effectiveDate}`);
    expect(pages['/terms']).toContain(`Effective ${effectiveDate}`);
  });

  it.each(['/privacy', '/terms', '/support'])('publishes a working contact on %s', (route) => {
    expect(pages[route]).toContain(`mailto:${CONTACT}`);
  });

  it('describes Theater Mode the way this build actually ships it', () => {
    // Hidden build: the pages must not imply a location prompt or theater
    // feed that is not there. If the flag is ever turned on for a release,
    // this fails and the wording has to be revisited rather than forgotten.
    expect(THEATER_MODE_ENABLED).toBe(false);
    expect(pages['/privacy']).toContain('Theater Mode is not enabled in the public 3.5.0 build');
    expect(pages['/support']).toContain('not included in the public 3.5.0 build');
  });

  it('redirects every .html spelling to its clean URL', () => {
    // cleanUrls serves /terms from terms.html, but leaves terms.html reachable
    // too. Two live URLs for one policy is a metadata problem the reviewer can
    // see, so each one is a permanent redirect.
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.cleanUrls).toBe(true);
    const redirects = Object.fromEntries(vercel.redirects.map((r) => [r.source, r.destination]));
    for (const [route, file] of Object.entries(OWN_PAGES)) {
      expect(redirects[`/${file}`]).toBe(route);
    }
  });

  it('keeps the embed proxy exempt from the frame-blocking header', () => {
    // X-Frame-Options: DENY on /embed would break playback in the WKWebView.
    const vercel = JSON.parse(read('vercel.json'));
    const blanket = vercel.headers.find((h) => h.source.includes('!api/embed'));
    expect(blanket.source).toContain('embed$');
    expect(blanket.headers.some((h) => h.key === 'X-Frame-Options')).toBe(true);
    const embed = vercel.headers.find((h) => h.source === '/api/embed');
    expect(embed.headers.some((h) => h.key === 'X-Frame-Options')).toBe(false);
  });
});
