import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const URL = process.argv[2] || 'http://127.0.0.1:4174/';
// 3.5.0 replaced the ONBOARDED flag with a consent record checked against
// POLICY_VERSION, and made the first-run sheet dismissible ONLY by its button:
// no backdrop tap, no Escape. Seeding the old key left this script staring at
// that sheet with every later interaction failing. Read the version rather than
// pasting it, so a bump does not quietly break this again.
// globalThis.URL, not URL: this module declares `const URL` for its target
// page two lines up, which shadows the global for the whole module scope.
const POLICY_VERSION = readFileSync(new globalThis.URL('../app/src/lib/release.js', import.meta.url), 'utf8')
  .match(/POLICY_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2})'/)?.[1];
if (!POLICY_VERSION) throw new Error('Could not read POLICY_VERSION from app/src/lib/release.js');
const OUT = process.argv[3];
// Installed Chrome, like release-smoke.mjs and capture-release-screenshots.mjs.
// The bundled Chromium is not downloaded on this machine, so without a channel
// this script fails before it reaches the app at all.
const b = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--mute-audio'],
});
const ctx = await b.newContext({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 1 });
await ctx.addInitScript((version) => {
  try { localStorage.setItem('trailer-roulette.policy-accepted', JSON.stringify(version)); } catch {}
}, POLICY_VERSION);
const page = await ctx.newPage();
  await page.route(/youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/, r=>r.abort());
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0,160)); });
page.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0,160)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.tr-roulette-actions', { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(2500);
const modesBtn = await page.$('button[aria-label="Open fun modes"]');
console.log('Modes button present:', !!modesBtn);
if (modesBtn) { await modesBtn.click(); await page.waitForTimeout(800); }
const sheet = await page.$('.fun-sheet');
console.log('Fun sheet opened:', !!sheet);
const labels = await page.$$eval('.fun-item .fun-label', els => els.map(e => e.innerText)).catch(()=>[]);
console.log('Fun items:', labels.length, '->', JSON.stringify(labels));
await page.screenshot({ path: OUT + '/00-funmenu.png' });
for (let i = 0; i < labels.length; i++) {
  if (!(await page.$('.fun-sheet'))) { const mb = await page.$('button[aria-label="Open fun modes"]'); if (mb) { await mb.click(); await page.waitForTimeout(500); } }
  const items = await page.$$('.fun-item');
  const before = errors.length;
  await items[i].click(); await page.waitForTimeout(1400);
  const feat = await page.$('.feat');
  const heading = await page.$eval('.feat h1, .feat h2, .feat-title, .feat', el => (el.innerText||'').slice(0,50)).catch(()=>'');
  const newErr = errors.slice(before);
  console.log(`MODE ${i+1} "${labels[i]}": overlay=${!!feat} | heading="${heading.replace(/\n/g,' ')}" | errors=${newErr.length} ${newErr.join(' || ')}`);
  await page.screenshot({ path: OUT + `/${String(i+1).padStart(2,'0')}-${labels[i].replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png` });
  const close = await page.$('.feat-close') || await page.$('button[aria-label="Close"]');
  if (close) { await close.click(); await page.waitForTimeout(700); } else { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
}
console.log('=== TOTAL console/page errors:', errors.length, '===');
if (errors.length) console.log(errors.join('\n'));
await b.close();
