// Deterministic browser regression checks. Synthetic movies are TEST DATA only.
// Usage: node scripts/release-smoke.mjs --url=http://127.0.0.1:5173
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
let checks = 0;
try {
  for (const viewport of [{width:390,height:844},{width:844,height:390},{width:1032,height:1376},{width:1376,height:1032}]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    let theaters = 0, youtube = 0, mode = 'normal';
    let releaseSlow, slowStarted;
    const slowSeen = new Promise(resolve => { slowStarted = resolve; });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await context.addInitScript(() => {
      if (window.top === window && location.protocol.startsWith('http')) {
        localStorage.setItem('trailer-roulette.source', JSON.stringify({marketSlug:'austin',marketName:'Austin'}));
      }
    });
    await page.route('**/*', async route => {
      const request = new URL(route.request().url());
      if (request.hostname.includes('drafthouse')) { theaters++; return route.abort(); }
      if (request.hostname.includes('youtube')) { youtube++; return route.abort(); }
      if (request.hostname === 'api.themoviedb.org') {
        if (mode === 'offline') return route.abort();
        if (request.pathname.endsWith('/videos')) return route.fulfill({json:{results:[{key:'dQw4w9WgXcQ',site:'YouTube',type:'Trailer',official:true}]}});
        const genres = request.searchParams.get('with_genres');
        if (genres === '27' && mode === 'race') {
          slowStarted();
          await new Promise(resolve => { releaseSlow = resolve; });
        }
        return route.fulfill({json:{results:mode === 'empty' && genres ? [] : [{id:genres === '35'?2:1,title:genres === '35'?'TEST Comedy':'TEST Original',release_date:'1984-01-01',genre_ids:[35],vote_count:1000,vote_average:7}],total_pages:1}});
      }
      return route.continue();
    });
    await page.goto(url);
    const dialog = page.getByRole('dialog', {name:'How Trailer Roulette works'});
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(),true);
    assert.equal(youtube,0);
    assert.equal(theaters,0);
    checks += 3;
    for (const name of ['Privacy policy','Terms','YouTube Terms of Service']) assert.ok(await dialog.getByRole('link',{name,exact:true}).getAttribute('href'));
    await page.getByRole('button',{name:'Agree and continue'}).click();
    await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'About',exact:true}).click();
    assert.equal(await page.getByText('Native player:',{exact:false}).count(),0);
    await page.getByRole('button',{name:'Troubleshooting details'}).click();
    assert.equal(await page.getByText('Native player:',{exact:false}).count(),1);
    await page.getByRole('button',{name:'Back',exact:true}).click();
    checks += 2;
    await page.getByRole('button',{name:'About TEST Original',exact:true}).click();
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByRole('button',{name:'Saved',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Saved movies',exact:true}).click();
    await page.getByRole('button',{name:'TEST Original (1984)',exact:true}).waitFor();
    await page.getByRole('button',{name:'Remove TEST Original',exact:true}).click();
    await page.getByText('Nothing saved yet.',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Back',exact:true}).click();
    checks += 2;
    // A late Horror response must not replace the more recent Comedy selection.
    mode = 'race';
    await page.getByRole('button',{name:'Filter by decade and genre'}).click();
    await page.getByRole('button',{name:'Horror',exact:true}).click();
    await page.getByRole('button',{name:'Apply filters'}).click();
    await slowSeen;
    await page.getByRole('button',{name:/Filters active/}).click();
    await page.getByRole('button',{name:'Horror',exact:true}).click();
    await page.getByRole('button',{name:'Comedy',exact:true}).click();
    await page.getByRole('button',{name:'Apply filters'}).click();
    await page.getByRole('heading',{name:/TEST Comedy/}).waitFor();
    releaseSlow();
    await page.waitForTimeout(400);
    assert.equal(await page.getByRole('heading',{name:/TEST Comedy/}).count(),1);
    checks++;
    mode = 'empty';
    await page.getByRole('button',{name:/Filters active/}).click();
    await page.getByRole('button',{name:'Horror',exact:true}).click();
    await page.getByRole('button',{name:'Apply filters'}).click();
    await page.getByText(/No movies matched these filters/).waitFor();
    checks++;
    mode = 'offline';
    await page.reload();
    await page.getByRole('alert').waitFor();
    mode = 'normal';
    await page.getByRole('button',{name:'Try again'}).click();
    await page.getByRole('alert').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    assert.equal(theaters,0);
    checks += 3;
    console.log(`PASS ${viewport.width}x${viewport.height}: consent, links, hidden theater, diagnostics, stale response, fallback, offline recovery`);
    await context.close();
  }
  console.log(`PASS ${checks} browser assertions across four viewport sizes`);
} finally { await browser.close(); }
