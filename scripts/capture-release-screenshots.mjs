// Capture current web UI using live TMDB data. These are browser drafts, not
// evidence of native playback or final App Store device screenshots.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const READY_SIZES = { ipad: '2064 x 2752', iphone: '1320 x 2868' };

/**
 * The drafts are reference, not submission assets. Two of the five carry an
 * artefact that only exists in the browser, so the README says which and why
 * rather than leaving the next person to trust the pixels.
 */
export function readmeFor(ipad) {
  return `# 3.5.0 browser screenshot drafts

Captured from the actual web UI with live TMDB data, through a touch-emulating
context, without injected movies or hidden controls. ${ipad ? READY_SIZES.ipad : READY_SIZES.iphone} PNG.
Files 01 welcome, 02 filters, 03 modes, 04 movie details, 05 About.

## YouTube is stubbed during capture, on purpose

The web preview mounts a YouTube iframe on the stage; the iOS build plays in a
native modal and never shows it. Unstubbed, 03 and 04 came back with YouTube's
red play button blurred into the artwork - inaccurate, and third-party branding
inside a store screenshot besides. The capture context serves a transparent
document for youtube.com and youtube-nocookie.com so the TMDB backdrop shows
through, which is what the device puts there. Aborting those requests instead
was tried and is worse: a blocked iframe renders the browser's opaque error
document and the stage becomes a flat grey slab.

## What a browser capture cannot show at all

The native player, the glass chrome, the progress line and AirPlay - which is
most of what the app looks like in use.

## Touch emulation is load-bearing

Without hasTouch, Chromium reports a fine pointer, the desktop dev view in
styles/index.css applies at iPad width, and the 13-inch set comes back as a
520px column with black either side. That is how the previous 13-inch drafts
were made, and it is docs/bugs.md B7.

Capture the submitted set on a device during the device test in
docs/RELEASE-REVIEW-2026-09.md, and replace these wherever the appearance
differs. Do not use historic screenshot sets.
`;
}

export async function captureReleaseScreenshots(kind = 'iphone') {
  const url = arg('url', 'http://127.0.0.1:5173');
  const ipad = kind === 'ipad';
  const out = resolve(arg('out', `assets/screenshots/release-3.5.0/${ipad ? '13-inch' : '6.9-inch'}`));
  await mkdir(out, {recursive:true});
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  try {
    // hasTouch/isMobile are load-bearing, not decoration: without them
    // Chromium reports (hover: hover) and (pointer: fine), the desktop dev
    // view in styles/index.css applies at iPad width, and the 13-inch drafts
    // come back as a 520px column with black either side.
    const context = await browser.newContext({
      viewport: ipad ? {width:1032,height:1376} : {width:440,height:956},
      deviceScaleFactor: ipad ? 2 : 3,
      hasTouch: true,
      isMobile: true,
    });
    // The web preview mounts a YouTube iframe on the stage. iOS does not --
    // Player.ios.jsx hands playback to the native modal, so the stage keeps
    // the TMDB backdrop and the trailer is never inline. Left alone, the
    // drafts for 03 and 04 came back with YouTube's red play button blurred
    // into the artwork: inaccurate, and third-party branding inside a store
    // screenshot besides.
    //
    // Stubbed, not aborted. Aborting was tried first and is worse: a blocked
    // iframe renders the browser's own error document, which is opaque white,
    // so the stage became a flat grey slab with the backdrop hidden behind it.
    // A transparent stub document lets tr-backdrop show through, which is what
    // the device puts there. Same technique release-smoke.mjs uses on the same
    // hosts; it stubs a third-party service rather than hiding app UI.
    const TRANSPARENT_STUB = '<!doctype html><html><head><meta charset="utf-8">'
      + '<style>html,body{margin:0;height:100%;background:transparent}</style>'
      + '</head><body></body></html>';
    await context.route('**://*.youtube-nocookie.com/**', (route) => route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8', body: TRANSPARENT_STUB,
    }));
    await context.route('**://*.youtube.com/**', (route) => route.fulfill({
      status: 200, contentType: 'text/html; charset=utf-8', body: TRANSPARENT_STUB,
    }));
    await context.route('**://*.ytimg.com/**', (route) => route.abort());
    await context.route('**://*.ggpht.com/**', (route) => route.abort());

    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole('button',{name:'Agree and continue'}).waitFor();
    await page.waitForTimeout(450);
    await page.screenshot({path:resolve(out,'01-welcome.png')});
    await page.getByRole('button',{name:'Agree and continue'}).click();
    await page.getByRole('dialog',{name:'How Trailer Roulette works'}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Filter by decade and genre'}).click();
    await page.getByRole('button',{name:'1980s',exact:true}).click();
    await page.getByRole('button',{name:'Horror',exact:true}).click();
    await page.waitForTimeout(300);
    await page.screenshot({path:resolve(out,'02-filters.png')});
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('button',{name:'Open fun modes'}).click();
    await page.getByRole('dialog',{name:'Fun modes'}).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({path:resolve(out,'03-modes.png')});
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:/^About .+/}).waitFor({timeout:30000});
    await page.getByRole('button',{name:/^About .+/}).click();
    await page.getByRole('button',{name:'Save',exact:true}).waitFor();
    await page.waitForTimeout(2500);
    await page.screenshot({path:resolve(out,'04-movie.png')});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'About',exact:true}).click();
    await page.getByRole('heading',{name:'Your data'}).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({path:resolve(out,'05-about.png')});
    await writeFile(resolve(out,'README.md'), readmeFor(ipad));
    console.log(`Captured five ${kind} drafts in ${out}`);
  } finally { await browser.close(); }
}
