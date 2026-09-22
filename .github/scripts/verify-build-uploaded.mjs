/**
 * Fail the release unless the build actually arrived at App Store Connect.
 *
 * `xcrun altool --upload-app` is not a reliable signal. On 2026-09-22 it hit
 *
 *     RETRIEVE UPLOAD OPERATIONS (ASSET_UPLOAD): received status code 502;
 *     bad gateway. (HAMJOEHVQUGHNZETHTV6CKXEVA)
 *
 * printed Apple's HTML error page, and exited 0. The workflow went green, the
 * tag looked released, and the build simply did not exist. The only way to
 * know is to ask App Store Connect whether it has the build.
 *
 * Polls until a build with this CFBundleVersion appears, or gives up. A build
 * that appears as PROCESSING is a pass: it is on Apple's side, which is the
 * thing this step exists to establish. INVALID is a failure.
 *
 * Reads APP_STORE_CONNECT_API_KEY_ID, _ISSUER_ID, _BASE64, BUNDLE_ID and
 * BUILD_NUMBER from the environment. No dependencies: Node's own crypto signs
 * the ES256 assertion.
 */
import crypto from 'node:crypto';

const KEY_ID = process.env.APP_STORE_CONNECT_API_KEY_ID;
const ISSUER_ID = process.env.APP_STORE_CONNECT_API_KEY_ISSUER_ID;
const KEY_B64 = process.env.APP_STORE_CONNECT_API_KEY_BASE64;
const BUNDLE_ID = process.env.BUNDLE_ID;
const BUILD_NUMBER = process.env.BUILD_NUMBER;

for (const [name, value] of Object.entries({
  APP_STORE_CONNECT_API_KEY_ID: KEY_ID,
  APP_STORE_CONNECT_API_KEY_ISSUER_ID: ISSUER_ID,
  APP_STORE_CONNECT_API_KEY_BASE64: KEY_B64,
  BUNDLE_ID,
  BUILD_NUMBER,
})) {
  if (!value) {
    console.log(`::error::${name} is not set; cannot verify the upload.`);
    process.exit(1);
  }
}

const ATTEMPTS = 20;
const INTERVAL_MS = 30_000;

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function token() {
  const privateKey = Buffer.from(KEY_B64, 'base64').toString('utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const payload = b64url({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const signature = crypto
    .sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function asc(path) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const body = await response.json();
  if (body.errors) {
    throw new Error(body.errors.map((e) => `${e.status} ${e.title}: ${e.detail}`).join('; '));
  }
  return body;
}

const apps = await asc(`/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=1`);
const app = apps.data?.[0];
if (!app) {
  console.log(`::error::No app in App Store Connect with bundle id ${BUNDLE_ID}.`);
  process.exit(1);
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const builds = await asc(
    `/v1/builds?filter[app]=${app.id}&filter[version]=${encodeURIComponent(BUILD_NUMBER)}&limit=1`,
  );
  const build = builds.data?.[0];

  if (build) {
    const state = build.attributes.processingState;
    console.log(`Build ${BUILD_NUMBER} is on App Store Connect (processingState=${state}).`);
    if (state === 'INVALID' || state === 'FAILED') {
      console.log(`::error::Build ${BUILD_NUMBER} was rejected by App Store Connect (${state}).`);
      process.exit(1);
    }
    process.exit(0);
  }

  console.log(`Attempt ${attempt}/${ATTEMPTS}: build ${BUILD_NUMBER} not visible yet.`);
  if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.log(
  `::error::Build ${BUILD_NUMBER} never appeared in App Store Connect after ` +
    `${(ATTEMPTS * INTERVAL_MS) / 60000} minutes. altool reported success but nothing was delivered.`,
);
process.exit(1);
