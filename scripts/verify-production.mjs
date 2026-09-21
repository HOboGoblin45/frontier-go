// Deployment gate: compare actual production HTML with this checkout's handler.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../landing-page/api/embed.js', import.meta.url), 'utf8');
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const origin = 'https://trailer-roulette.vercel.app';
const url = `${origin}/embed?v=dQw4w9WgXcQ&cb=${Date.now()}`;
const response = await fetch(url, {signal:AbortSignal.timeout(15000)});
if (!response.ok) throw new Error(`Proxy returned HTTP ${response.status}`);
const actual = await response.text();
const expected = await (await handler(new Request(url))).text();
const hash = text => createHash('sha256').update(text).digest('hex');
let passed = true;
for (const marker of ['announcePlaying','subscribeToPlayerEvents','youtubeEventsSeen']) {
  const present = actual.includes(marker);
  console.log(`${marker}=${present}`);
  passed &&= present;
}
const matches = hash(actual) === hash(expected);
console.log(`Production matches this checkout: ${matches}`);
passed &&= matches;
for (const path of ['/privacy','/terms','/support']) {
  const page = await fetch(origin + path, {signal:AbortSignal.timeout(15000)});
  const body = await page.text();
  const present = page.ok && body.includes(path === '/support' ? 'crescicharles@gmail.com' : 'September 21, 2026');
  console.log(`${path}: ${page.status}, current content=${present}`);
  passed &&= present;
}
if (!passed) {
  console.error('Release blocked: deploy the reviewed landing-page directory, then rerun this check.');
  process.exitCode = 1;
}
