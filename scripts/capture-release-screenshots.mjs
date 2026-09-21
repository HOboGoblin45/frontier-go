// Capture current web UI using live TMDB data. These are browser drafts, not
// evidence of native playback or final App Store device screenshots.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
export async function captureReleaseScreenshots(kind = 'iphone') {
  const url = arg('url', 'http://127.0.0.1:5173');
  const ipad = kind === 'ipad';
  const out = resolve(arg('out', `assets/screenshots/release-3.5.0/${ipad ? '13-inch' : '6.9-inch'}`));
  await mkdir(out, {recursive:true});
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  try {
    const context = await browser.newContext({viewport:ipad ? {width:1032,height:1376}:{width:440,height:956},deviceScaleFactor:ipad?2:3});
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
    await writeFile(resolve(out,'README.md'),`# 3.5.0 browser screenshot drafts\n\nCaptured from the actual web UI with live TMDB data, without injected movies or hidden controls. ${ipad?'2064 x 2752':'1320 x 2868'} PNG. Files 01 welcome, 02 filters, 03 modes, 04 movie details, 05 About.\n\nThese do not verify iOS rendering or native playback. Compare against the TestFlight build before App Store use; replace with native captures wherever the appearance differs. Do not use historic screenshot sets.\n`);
    console.log(`Captured five ${kind} drafts in ${out}`);
  } finally { await browser.close(); }
}
