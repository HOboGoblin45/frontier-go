/**
 * The page a shared link opens: the clip, playing in any browser, straight
 * from the agency's server, with its credit line and a way to get the app.
 *
 * Share links used to point at the agency's own page, or at `frontier.go`,
 * which is not a domain, so a share never introduced anyone to the app. This
 * is the whole growth loop, which is why it is pre-rendered per clip: link
 * previews in Messages, Slack and social apps read the served HTML, and a
 * per-clip title and picture is what gets a link tapped.
 */
import type { FrontierMediaItem } from '../../src/core/types/media';
import { artworkFor } from '../../src/core/catalog/artwork';
import { deepLink, shareSlug } from '../../src/core/history/saved';
import { APP_STORE_ID, APP_STORE_URL, SITE_URL, TERMS_URL } from '../../src/core/platform/site';

const BADGE = 'https://tools.applemarketingtools.com/api/badges/download-on-the-app-store/white/en-us?size=250x83';

export const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clip = (text: string | undefined, max: number) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

function placeLine(item: FrontierMediaItem): string {
  const loc = item.location;
  const name = loc?.displayName || loc?.regionName || '';
  if (loc && typeof loc.depthMeters === 'number' && loc.depthMeters > 0) {
    return `${name}${name ? ' · ' : ''}${Math.round(loc.depthMeters).toLocaleString('en-US')} m below sea level`;
  }
  return name;
}

export function shell(opts: {
  title: string; description: string; image?: string; canonical?: string; body: string; type?: string;
  /** Extra CSS for pages that need more than the share layout. */
  css?: string;
  /** Wider content column (atlas pages). */
  wide?: boolean;
  /** JSON-LD structured data. */
  jsonLd?: unknown;
}): string {
  const image = opts.image || `${SITE_URL}/og-cover.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="theme-color" content="#0B0F0E">
<link rel="icon" href="${SITE_URL}/favicon.svg" type="image/svg+xml">
${opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : ''}
<meta property="og:site_name" content="frontier go">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="${esc(opts.type || 'website')}">
<meta property="og:image" content="${esc(image)}">
${opts.canonical ? `<meta property="og:url" content="${esc(opts.canonical)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0B0F0E;--stone:#D7C9BB;--bone:#F4EFE7;--bronze:#B0886B}
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--bone);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:var(--bronze)}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 72px}
  .wordmark{font-size:24px;font-weight:300;color:var(--bone);text-decoration:none}
  .wordmark span{color:var(--bronze);font-weight:400}
  .stage{margin:22px -20px 0;background:#000;aspect-ratio:16/9}
  video{display:block;width:100%;height:100%;object-fit:contain;background:#000}
  .eyebrow{margin-top:22px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(215,201,187,.6)}
  h1{font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:32px;line-height:1.15;margin:8px 0 10px}
  .place{color:var(--stone);font-size:16px}
  .desc{color:rgba(215,201,187,.8);font-size:15px;line-height:1.6;margin:16px 0 0}
  .credit{margin-top:14px;font-size:13px;color:rgba(215,201,187,.6)}
  .cta{margin-top:30px;padding:22px;border:1px solid rgba(215,201,187,.14);border-radius:18px;background:#131A15}
  .cta p{margin:0 0 14px;color:var(--stone);line-height:1.55}
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
  .open{display:inline-block;padding:12px 18px;border-radius:999px;background:var(--bone);color:#0B0F0E;text-decoration:none;font-weight:500;font-size:15px}
  .badge{line-height:0}
  footer{margin-top:40px;font-size:12px;line-height:1.6;color:rgba(215,201,187,.5)}
  footer a{color:rgba(215,201,187,.7)}
  @media (min-width:800px){.stage{margin:22px 0 0;border-radius:14px;overflow:hidden}}
  ${opts.wide ? '.wrap{max-width:1040px}' : ''}
  ${opts.css || ''}
</style>
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<div class="wrap">
  <a class="wordmark" href="${SITE_URL}/">frontier <span>go</span></a>
  ${opts.body}
  <footer>
    frontier go is an independent app, not affiliated with or endorsed by NASA, NOAA or any government agency.
    Footage is public-domain material credited to the agency that published it.<br>
    <a href="${SITE_URL}/">About</a> &middot; <a href="${SITE_URL}/support">Support</a> &middot;
    <a href="${SITE_URL}/privacy">Privacy</a> &middot; <a href="${TERMS_URL}" rel="noopener">Terms</a>
  </footer>
</div>
</body>
</html>
`;
}

export function getTheApp(openLink?: string, message?: string): string {
  return `
  <div class="cta">
    <p>${message || `This is one of more than a thousand places in <strong>frontier go</strong>: deep-ocean dives,
      spacewalks, launches and Mars, playing continuously. Free, no account, no ads.`}</p>
    <div class="row">
      <a class="badge" href="${APP_STORE_URL}" rel="noopener" aria-label="Download frontier go on the App Store">
        <img src="${BADGE}" alt="Download on the App Store" width="150" height="50">
      </a>
      ${openLink ? `<a class="open" href="${esc(openLink)}">Open in the app</a>` : ''}
    </div>
  </div>`;
}

export function sharePagePath(item: FrontierMediaItem): string {
  return `d/${shareSlug(item.id)}/index.html`;
}

export function renderSharePage(item: FrontierMediaItem): string {
  const place = placeLine(item);
  const credit = item.rights?.attributionText || item.source?.organization || '';
  const poster = artworkFor(item);
  const canonical = `${SITE_URL}/d/${shareSlug(item.id)}/`;
  const description = clip([place, item.description].filter(Boolean).join(' — '), 200);
  const body = `
  <div class="stage">
    <video src="${esc(item.stream.url)}" ${poster ? `poster="${esc(poster)}"` : ''} controls playsinline preload="metadata"></video>
  </div>
  <div class="eyebrow">Shared from frontier go</div>
  <h1>${esc(item.title)}</h1>
  ${place ? `<div class="place">${esc(place)}</div>` : ''}
  ${item.description ? `<p class="desc">${esc(clip(item.description, 420))}</p>` : ''}
  <div class="credit">Credit: ${esc(credit)}${item.source?.assetUrl ? ` &middot; <a href="${esc(item.source.assetUrl)}" rel="noopener">Source</a>` : ''}</div>
  ${getTheApp(deepLink(item.id))}`;
  return shell({ title: `${item.title} — frontier go`, description, image: poster, canonical, body, type: 'video.other' });
}

export function renderNotFound(): string {
  return shell({
    title: 'frontier go',
    description: 'Real exploration footage, playing continuously. Free on the App Store.',
    body: `<h1 style="margin-top:28px">That place has moved on.</h1>
      <p class="desc">This clip is no longer in the catalog. There are plenty more.</p>${getTheApp('frontiergo://')}`,
  });
}
