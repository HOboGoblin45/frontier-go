/**
 * App Store screenshots, generated from the real app.
 *
 *   npx vite build && npx vite preview --port 4182 &
 *   node tools/screenshots/capture.mjs [--base http://127.0.0.1:4182]
 *
 * Renders the production web build at the exact App Store pixel sizes, pins
 * each frame to a chosen clip by serving a one-item catalog, then sets the
 * frame in a caption layout. Output: store-listing/screenshots/<device>/.
 *
 * Rules the frames follow (NASA and NOAA media terms, Apple 2.3.7 / 5.2.1):
 * no agency insignia or emblem, no recognisable astronaut, no agency name in a
 * caption. Headless Chromium has no H.264 decoder, so video elements are
 * stubbed to show the agency's own poster frame, which is a real frame of the
 * clip.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright')); }

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../..');
const OUT = resolve(APP, '../store-listing/screenshots');
const RAW = resolve(OUT, '_raw');
const argBase = process.argv.indexOf('--base');
const BASE = argBase > 0 ? process.argv[argBase + 1] : 'http://127.0.0.1:4182';

const catalog = JSON.parse(readFileSync(resolve(APP, 'public/catalog/frontier-catalog.json'), 'utf8'));
const byId = new Map(catalog.items.map((i) => [i.id, i]));
const pinned = (id) => {
  const item = byId.get(id);
  if (!item) throw new Error(`screenshot clip missing from catalog: ${id}`);
  if (item.imagery.titleCard) throw new Error(`screenshot clip has a title-card poster: ${id}`);
  return JSON.stringify({ ...catalog, items: [item] });
};

const DEVICES = {
  'iphone-6.9': { width: 440, height: 956, scale: 3 },   // 1320 x 2868
  'ipad-13': { width: 1032, height: 1376, scale: 2 },    // 2064 x 2752
};

/** Each frame: which clip, what to do in the app, and the caption. */
const FRAMES = [
  {
    key: '01-already-somewhere', clip: 'noaa:12254:12253',
    head: 'You are already somewhere.',
    sub: 'Real deep-ocean dives and space missions, playing the moment you open it.',
  },
  {
    key: '02-shuffle', clip: 'nasa:Earth Views from the International Space Station',
    head: 'Tap Shuffle. Go somewhere else.',
    sub: 'Three kilometres down, then four hundred up.',
  },
  {
    key: '03-globe', clip: null, tab: 'Explore',
    head: 'A globe of real places.',
    sub: 'Every pin is where the footage was shot. Tap one and go.',
  },
  {
    key: '04-collections', clip: null, tab: 'Explore', collections: true,
    head: 'Stay a while.',
    sub: 'Whole expeditions, Mars, vents and seeps, storms from above.',
  },
  {
    key: '05-sleep', clip: 'noaa:10196:10195', sleep: true,
    head: 'Fall asleep three kilometres down.',
    sub: 'A sleep timer and an ambient mode made for the television.',
  },
  {
    key: '06-free', clip: 'nasa:jsc2019m000804_Hurricane_Dorian_190831',
    head: 'Free. No ads. No account.',
    sub: 'Nothing about you ever leaves your phone.',
  },
];

// Headless Chromium cannot decode the agencies' H.264, so the video element is
// told to behave as if it were playing and simply shows its poster frame.
const STUB_VIDEO = () => {
  const proto = HTMLMediaElement.prototype;
  Object.defineProperty(proto, 'src', {
    configurable: true,
    get() { return this.__src || ''; },
    set(value) {
      this.__src = value;
      setTimeout(() => { for (const e of ['loadedmetadata', 'canplay', 'playing', 'timeupdate']) this.dispatchEvent(new Event(e)); }, 250);
    },
  });
  Object.defineProperty(proto, 'duration', { configurable: true, get() { return 214; } });
  Object.defineProperty(proto, 'currentTime', { configurable: true, get() { return 71; }, set() {} });
  proto.play = function play() { return Promise.resolve(); };
  proto.pause = function pause() {};
  proto.load = function load() {};
  try { localStorage.setItem('frontier.onboarded', 'true'); } catch { /* ignore */ }
};

async function captureRaw(deviceKey, frame) {
  const d = DEVICES[deviceKey];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale, isMobile: deviceKey.startsWith('iphone'), hasTouch: true });
  await ctx.addInitScript(STUB_VIDEO);
  const page = await ctx.newPage();
  await page.route('**/catalog/frontier-catalog.json', (route) => {
    if (!route.request().url().startsWith(BASE)) return route.abort(); // no remote refresh mid-shot
    return route.fulfill({ status: 200, contentType: 'application/json', body: frame.clip ? pinned(frame.clip) : JSON.stringify(catalog) });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const start = page.getByRole('button', { name: 'Start Exploring' });
  if (await start.count()) await start.click();
  await page.waitForTimeout(3200); // travel transition
  if (frame.tab) {
    await page.getByRole('button', { name: frame.tab }).last().click();
    await page.waitForTimeout(2600);
    if (frame.collections) { await page.getByRole('tab', { name: /Collections/ }).click(); await page.waitForTimeout(2500); }
  } else {
    await page.mouse.click(d.width / 2, d.height * 0.3);
    await page.waitForTimeout(700);
    if (frame.sleep) {
      await page.getByRole('button', { name: /Sleep timer/ }).click();
      await page.waitForTimeout(900);
    }
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  mkdirSync(resolve(RAW, deviceKey), { recursive: true });
  const file = resolve(RAW, deviceKey, `${frame.key}.png`);
  await page.screenshot({ path: file });
  await browser.close();
  return file;
}

const fontFace = (family, weight, file) => `@font-face{font-family:'${family}';font-weight:${weight};src:url('${pathToFileURL(file).href}') format('woff2')}`;
const FONTS = [
  fontFace('Playfair Display', 400, resolve(APP, 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2')),
  fontFace('Inter', 400, resolve(APP, 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2')),
  fontFace('Inter', 300, resolve(APP, 'node_modules/@fontsource/inter/files/inter-latin-300-normal.woff2')),
].join('\n');

async function compose(deviceKey, frame, rawFile) {
  const d = DEVICES[deviceKey];
  const tablet = deviceKey.startsWith('ipad');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS}
    *{box-sizing:border-box;margin:0}
    html,body{width:${d.width}px;height:${d.height}px;overflow:hidden}
    body{background:radial-gradient(120% 70% at 50% 0%,#1d2a20 0%,#0B0F0E 62%);font-family:Inter,sans-serif;color:#F4EFE7;-webkit-font-smoothing:antialiased}
    .cap{padding:${tablet ? '64px 90px 0' : '54px 30px 0'};text-align:center}
    .brand{font-size:${tablet ? 18 : 13}px;letter-spacing:.22em;text-transform:uppercase;color:#B0886B;font-weight:400}
    h1{font-family:'Playfair Display',serif;font-weight:400;font-size:${tablet ? 52 : 33}px;line-height:1.12;margin-top:${tablet ? 18 : 12}px}
    p{font-weight:300;font-size:${tablet ? 22 : 15}px;line-height:1.45;color:#D7C9BB;margin:${tablet ? 14 : 10}px auto 0;max-width:${tablet ? 680 : 360}px}
    .cap{height:${tablet ? 300 : 252}px}
    .device{position:absolute;left:50%;transform:translateX(-50%);top:${tablet ? 318 : 262}px;width:${tablet ? 76 : 84}%;border-radius:${tablet ? 34 : 38}px;overflow:hidden;border:1.5px solid rgba(215,201,187,.22);box-shadow:0 30px 80px rgba(0,0,0,.55)}
    .device img{display:block;width:100%}
  </style></head><body>
    <div class="cap"><div class="brand">frontier go</div><h1>${frame.head}</h1><p>${frame.sub}</p></div>
    <div class="device"><img src="${pathToFileURL(rawFile).href}"></div>
  </body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale });
  const tmp = resolve(RAW, `${deviceKey}-${frame.key}.html`);
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  mkdirSync(resolve(OUT, deviceKey), { recursive: true });
  const out = resolve(OUT, deviceKey, `${frame.key}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  return out;
}

for (const deviceKey of Object.keys(DEVICES)) {
  for (const frame of FRAMES) {
    const raw = await captureRaw(deviceKey, frame);
    const out = await compose(deviceKey, frame, raw);
    process.stdout.write(`${deviceKey} ${frame.key} -> ${out.replace(`${OUT}/`, '')}\n`);
  }
}
