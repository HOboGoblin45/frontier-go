// Deployment gate: compare actual production HTML with this checkout's handler.
//
// This runs in ios-release.yml before anything is signed, so it decides whether
// a tagged release reaches TestFlight. It must therefore be right about what
// "current" means: the effective date is derived from POLICY_VERSION rather
// than written out. Hard-coded, a POLICY_VERSION bump would have made this gate
// fail against a correctly deployed page and pass against a stale one - the
// exact inverse of its job.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../landing-page/api/embed.js', import.meta.url), 'utf8');
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// release.js cannot be imported here: it reads import.meta.env, which does not
// exist under Node. Read the constant out of the source instead, and fail loudly
// rather than silently checking for the wrong string.
const releaseSource = await readFile(new URL('../app/src/lib/release.js', import.meta.url), 'utf8');
const policyVersion = releaseSource.match(/POLICY_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2})'/)?.[1];
if (!policyVersion) throw new Error('Could not read POLICY_VERSION from app/src/lib/release.js');
const [y, m, d] = policyVersion.split('-').map(Number);
const effectiveDate = new Date(Date.UTC(y, m - 1, d))
  .toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
console.log(`Expecting policy pages dated: ${effectiveDate} (POLICY_VERSION ${policyVersion})`);

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
const CONTACT = 'crescicharles@gmail.com';
for (const path of ['/privacy','/terms','/support']) {
  const page = await fetch(origin + path, {signal:AbortSignal.timeout(15000)});
  const body = await page.text();
  const present = page.ok && body.includes(path === '/support' ? CONTACT : effectiveDate);
  console.log(`${path}: ${page.status}, current content=${present}`);
  passed &&= present;
}
if (!passed) {
  console.error('Release blocked: deploy the reviewed landing-page directory, then rerun this check.');
  process.exitCode = 1;
}
