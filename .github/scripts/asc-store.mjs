/**
 * App Store Connect listing, applied from the repository.
 *
 * `store-listing/` is the single source of truth for what the App Store says
 * about frontier go. This script reads it and makes App Store Connect match, so
 * the listing is versioned, reviewable and transferable with the repo instead
 * of living only in someone's browser session.
 *
 *   node .github/scripts/asc-store.mjs plan      read-only: what would change
 *   node .github/scripts/asc-store.mjs apply     metadata, age rating, categories,
 *                                                screenshots, review notes, build
 *   node .github/scripts/asc-store.mjs submit    apply, then submit for review
 *
 * Environment:
 *   APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_API_KEY_ISSUER_ID and one of
 *   APP_STORE_CONNECT_API_KEY_BASE64 (CI) or APP_STORE_CONNECT_API_KEY_PATH (local).
 *   BUILD_NUMBER    the CFBundleVersion to attach (default: newest VALID build)
 *   BACKUP_DIR      where replaced screenshots are saved before deletion
 *                   (default: store-listing/screenshots/_replaced)
 *
 * What it will not do, deliberately:
 *   - Release the app. releaseType stays MANUAL: a person presses Release
 *     after the reviewed build has been seen on a device.
 *   - Developer-reject a version. Apple exposes no API for it; App Store
 *     Connect's web UI is the only way. The script says so and stops.
 *   - Set App Privacy answers. Also not in the public API.
 *
 * Every step is idempotent: run it twice and the second run changes nothing.
 * No dependencies: Node's own crypto signs the ES256 token.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LISTING = path.join(ROOT, 'store-listing');
const APP_ID = '6764209094';
const LOCALE = 'en-US';
const MODES = ['plan', 'apply', 'submit'];
const MODE = process.argv[2] || 'plan';
const WRITE = MODE === 'apply' || MODE === 'submit';

/* ------------------------------------------------------------------ */
/* Listing source                                                      */
/* ------------------------------------------------------------------ */

/** The first fenced block after the heading that starts with `heading`. */
export function fencedAfter(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (start < 0) throw new Error(`store-listing: no "## ${heading}" section`);
  const open = lines.findIndex((l, i) => i > start && l.startsWith('```'));
  const nextHeading = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (open < 0 || (nextHeading > 0 && open > nextHeading)) throw new Error(`store-listing: "## ${heading}" has no code block`);
  const close = lines.findIndex((l, i) => i > open && l.startsWith('```'));
  return lines.slice(open + 1, close).join('\n').trim();
}

/** `- Label: url` lines from the URLs section. */
export function urlFrom(markdown, label) {
  const m = markdown.match(new RegExp(`^- ${label}:\\s*(\\S+)`, 'm'));
  if (!m) throw new Error(`store-listing: no "${label}" URL`);
  return m[1];
}

export function readListing(dir = LISTING) {
  const md = fs.readFileSync(path.join(dir, 'description.md'), 'utf8');
  const review = fs.readFileSync(path.join(dir, 'review-notes.md'), 'utf8');
  const notesBlock = review.match(/```\n([\s\S]*?)\n```/);
  const listing = {
    name: fencedAfter(md, 'Name'),
    subtitle: fencedAfter(md, 'Subtitle'),
    keywords: fencedAfter(md, 'Keywords'),
    promotionalText: fencedAfter(md, 'Promotional text'),
    description: fencedAfter(md, 'Description'),
    supportUrl: urlFrom(md, 'Support'),
    marketingUrl: urlFrom(md, 'Marketing'),
    privacyPolicyUrl: urlFrom(md, 'Privacy policy'),
    reviewNotes: notesBlock ? notesBlock[1].trim() : '',
  };
  // Apple's limits, checked here so a bad edit fails before any request.
  const limits = { name: 30, subtitle: 30, promotionalText: 170, description: 4000, reviewNotes: 4000 };
  for (const [k, max] of Object.entries(limits)) {
    if ([...listing[k]].length > max) throw new Error(`store-listing: ${k} is ${[...listing[k]].length} characters, limit ${max}`);
  }
  if (Buffer.byteLength(listing.keywords) > 100) throw new Error('store-listing: keywords exceed 100 bytes');
  if (/\b(nasa|noaa)\b/i.test(`${listing.name} ${listing.subtitle} ${listing.keywords}`)) {
    throw new Error('store-listing: agency names are not allowed in name, subtitle or keywords (Apple 2.3.7, NASA terms)');
  }
  return listing;
}

/** Age rating answers for 4+: documentary footage, no mature content of any kind. */
export const AGE_RATING_4_PLUS = {
  alcoholTobaccoOrDrugUseOrReferences: 'NONE',
  contests: 'NONE',
  gamblingSimulated: 'NONE',
  gunsOrOtherWeapons: 'NONE',
  horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE',
  medicalOrTreatmentInformation: 'NONE',
  profanityOrCrudeHumor: 'NONE',
  sexualContentGraphicAndNudity: 'NONE',
  sexualContentOrNudity: 'NONE',
  violenceCartoonOrFantasy: 'NONE',
  violenceRealistic: 'NONE',
  violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  advertising: false,
  ageAssurance: false,
  gambling: false,
  healthOrWellnessTopics: false,
  lootBox: false,
  messagingAndChat: false,
  parentalControls: false,
  unrestrictedWebAccess: false,
  userGeneratedContent: false,
};

/** Folder name -> App Store Connect display type. 6.9" and 13" cover every device. */
export const SCREENSHOT_SETS = {
  'iphone-6.9': 'APP_IPHONE_67',
  'ipad-13': 'APP_IPAD_PRO_3GEN_129',
};

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

function privateKey() {
  if (process.env.APP_STORE_CONNECT_API_KEY_BASE64) {
    return Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_BASE64, 'base64').toString('utf8');
  }
  if (process.env.APP_STORE_CONNECT_API_KEY_PATH) return fs.readFileSync(process.env.APP_STORE_CONNECT_API_KEY_PATH, 'utf8');
  throw new Error('Set APP_STORE_CONNECT_API_KEY_BASE64 or APP_STORE_CONNECT_API_KEY_PATH');
}

let cachedToken = { value: '', exp: 0 };
function token() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.exp - 60 > now) return cachedToken.value;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'ES256', kid: process.env.APP_STORE_CONNECT_API_KEY_ID, typ: 'JWT' });
  const payload = b64({ iss: process.env.APP_STORE_CONNECT_API_KEY_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  cachedToken = { value: `${header}.${payload}.${sig}`, exp: now + 900 };
  return cachedToken.value;
}

async function asc(method, p, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (json.errors) {
    const err = new Error(`${method} ${p}: ${json.errors.map((e) => `${e.status} ${e.code}: ${e.detail}`).join('; ')}`);
    err.status = res.status;
    throw err;
  }
  return json;
}
const get = (p) => asc('GET', p);

const changes = [];
async function change(what, fn) {
  changes.push(what);
  console.log(`${WRITE ? 'apply' : 'would'}: ${what}`);
  if (WRITE) await fn();
}

/** Only the attributes that differ. */
function diff(current, wanted) {
  const out = {};
  for (const [k, v] of Object.entries(wanted)) if ((current?.[k] ?? null) !== (v ?? null)) out[k] = v;
  return out;
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

const EDITABLE = new Set([
  'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY',
]);

async function editableVersion(versionString) {
  const { data } = await get(`/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const open = data.find((v) => EDITABLE.has(v.attributes.appStoreState));
  if (open) return open;
  const blocking = data.find((v) => ['PENDING_DEVELOPER_RELEASE', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE', 'PROCESSING_FOR_APP_STORE'].includes(v.attributes.appStoreState));
  if (blocking) {
    const s = blocking.attributes;
    throw new Error(
      `Version ${s.versionString} is ${s.appStoreState}, which locks the listing and blocks a new version. ` +
        (s.appStoreState === 'PENDING_DEVELOPER_RELEASE'
          ? 'Withdraw it in App Store Connect: open the version and choose "Reject this version" (Developer Reject). Apple has no API for this.'
          : 'Wait for it to leave that state.'),
    );
  }
  // Everything is live or there is no version: start a new one.
  if (!WRITE) {
    console.log(`would: create version ${versionString}`);
    return null;
  }
  const created = await asc('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString, releaseType: 'MANUAL' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  changes.push(`create version ${versionString}`);
  return created.data;
}

async function pickBuild() {
  const filter = process.env.BUILD_NUMBER ? `&filter[version]=${encodeURIComponent(process.env.BUILD_NUMBER)}` : '';
  const { data } = await get(`/v1/builds?filter[app]=${APP_ID}&filter[processingState]=VALID&filter[expired]=false${filter}&sort=-uploadedDate&limit=1&include=preReleaseVersion`);
  if (!data.length) throw new Error(process.env.BUILD_NUMBER ? `Build ${process.env.BUILD_NUMBER} is not VALID yet.` : 'No VALID build.');
  return data[0];
}

async function stepAppInfo(listing) {
  const { data, included = [] } = await get(`/v1/apps/${APP_ID}/appInfos?include=appInfoLocalizations,primaryCategory,secondaryCategory,ageRatingDeclaration`);
  // The editable appInfo is the one that is not live.
  const info = data.find((i) => !['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE'].includes(i.attributes.appStoreState || i.attributes.state)) || data[0];
  const locIds = info.relationships.appInfoLocalizations.data.map((d) => d.id);
  const loc = included.find((x) => x.type === 'appInfoLocalizations' && locIds.includes(x.id) && x.attributes.locale === LOCALE);
  const want = { name: listing.name, subtitle: listing.subtitle, privacyPolicyUrl: listing.privacyPolicyUrl };
  const d = diff(loc?.attributes, want);
  if (Object.keys(d).length) {
    await change(`app info ${LOCALE}: ${Object.keys(d).join(', ')}`, () =>
      asc('PATCH', `/v1/appInfoLocalizations/${loc.id}`, { data: { type: 'appInfoLocalizations', id: loc.id, attributes: d } }));
  }

  const primary = info.relationships.primaryCategory?.data?.id;
  const secondary = info.relationships.secondaryCategory?.data?.id;
  if (primary !== 'ENTERTAINMENT' || secondary !== 'EDUCATION') {
    await change('categories: Entertainment, Education', () =>
      asc('PATCH', `/v1/appInfos/${info.id}`, {
        data: {
          type: 'appInfos',
          id: info.id,
          relationships: {
            primaryCategory: { data: { type: 'appCategories', id: 'ENTERTAINMENT' } },
            secondaryCategory: { data: { type: 'appCategories', id: 'EDUCATION' } },
          },
        },
      }));
  }

  const rating = included.find((x) => x.type === 'ageRatingDeclarations');
  const r = diff(rating?.attributes, AGE_RATING_4_PLUS);
  if (rating && Object.keys(r).length) {
    await change(`age rating (4+): ${Object.keys(r).join(', ')}`, () =>
      asc('PATCH', `/v1/ageRatingDeclarations/${rating.id}`, { data: { type: 'ageRatingDeclarations', id: rating.id, attributes: r } }));
  }
}

async function stepContentRights() {
  const { data } = await get(`/v1/apps/${APP_ID}?fields[apps]=contentRightsDeclaration`);
  if (data.attributes.contentRightsDeclaration !== 'USES_THIRD_PARTY_CONTENT') {
    await change('content rights: uses third-party content (public-domain agency footage)', () =>
      asc('PATCH', `/v1/apps/${APP_ID}`, { data: { type: 'apps', id: APP_ID, attributes: { contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT' } } }));
  }
}

async function stepVersion(version, build, listing) {
  const versionString = build.included?.find((x) => x.type === 'preReleaseVersions')?.attributes.version;
  const a = version.attributes;
  const want = diff(a, { versionString, releaseType: 'MANUAL' });
  if (Object.keys(want).length) {
    await change(`version ${a.versionString} -> ${JSON.stringify(want)}`, () =>
      asc('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: want } }));
  }

  const { data: locs } = await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  let loc = locs.find((l) => l.attributes.locale === LOCALE);
  const fields = {
    description: listing.description,
    keywords: listing.keywords,
    promotionalText: listing.promotionalText,
    supportUrl: listing.supportUrl,
    marketingUrl: listing.marketingUrl,
  };
  const d = diff(loc?.attributes, fields);
  if (Object.keys(d).length) {
    await change(`version ${LOCALE}: ${Object.keys(d).join(', ')}`, () =>
      asc('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: d } }));
  }

  const current = await get(`/v1/appStoreVersions/${version.id}/relationships/build`);
  if (current.data?.id !== build.id) {
    await change(`attach build ${build.attributes.version} (${versionString})`, () =>
      asc('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: build.id } }));
  }

  // Review notes. Contact details already on file are left exactly as they are.
  let detail;
  try {
    detail = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const r = diff(detail?.attributes, { notes: listing.reviewNotes, demoAccountRequired: false });
  if (Object.keys(r).length) {
    await change(`review notes${detail ? '' : ' (new record)'}`, () =>
      detail
        ? asc('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: r } })
        : asc('POST', '/v1/appStoreReviewDetails', {
          data: { type: 'appStoreReviewDetails', attributes: r, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } },
        }));
  }
  return loc;
}

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

async function backupScreenshot(shot, setType) {
  const dir = process.env.BACKUP_DIR || path.join(LISTING, 'screenshots', '_replaced');
  const asset = shot.attributes.imageAsset;
  if (!asset?.templateUrl) return;
  const url = asset.templateUrl.replace('{w}', asset.width).replace('{h}', asset.height).replace('{f}', 'png');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not back up ${shot.attributes.fileName} before replacing it (${res.status})`);
  fs.mkdirSync(path.join(dir, setType), { recursive: true });
  fs.writeFileSync(path.join(dir, setType, shot.attributes.fileName), Buffer.from(await res.arrayBuffer()));
}

async function uploadScreenshot(setId, file) {
  const buf = fs.readFileSync(file);
  const created = await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: path.basename(file), fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });
  const shot = created.data;
  for (const op of shot.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`Upload of ${path.basename(file)} failed: ${res.status}`);
  }
  await asc('PATCH', `/v1/appScreenshots/${shot.id}`, {
    data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5(buf) } },
  });
  return shot.id;
}

async function stepScreenshots(loc) {
  const { data: sets } = await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
  const wantedTypes = new Set(Object.values(SCREENSHOT_SETS));

  // Screenshots of the retired product in any other size would still show on
  // those devices. Apple scales the 6.9" and 13" sets down, so the others go.
  for (const set of sets.filter((s) => !wantedTypes.has(s.attributes.screenshotDisplayType))) {
    const { data: shots } = await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    if (!shots.length) continue;
    await change(`remove ${shots.length} old ${set.attributes.screenshotDisplayType} screenshots (backed up first)`, async () => {
      for (const s of shots) {
        await backupScreenshot(s, set.attributes.screenshotDisplayType);
        await asc('DELETE', `/v1/appScreenshots/${s.id}`);
      }
    });
  }

  for (const [folder, type] of Object.entries(SCREENSHOT_SETS)) {
    const dir = path.join(LISTING, 'screenshots', folder);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
    let set = sets.find((s) => s.attributes.screenshotDisplayType === type);
    const shots = set ? (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data : [];
    const same = shots.length === files.length && shots.every((s, i) =>
      s.attributes.fileName === path.basename(files[i]) &&
      s.attributes.sourceFileChecksum === md5(fs.readFileSync(files[i])) &&
      s.attributes.assetDeliveryState?.state !== 'FAILED');
    if (same) continue;
    await change(`${type}: replace ${shots.length} screenshots with ${files.length} from ${folder}/`, async () => {
      if (!set) {
        set = (await asc('POST', '/v1/appScreenshotSets', {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: type },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
          },
        })).data;
      }
      for (const s of shots) {
        await backupScreenshot(s, type);
        await asc('DELETE', `/v1/appScreenshots/${s.id}`);
      }
      const ids = [];
      for (const f of files) ids.push(await uploadScreenshot(set.id, f));
      await asc('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
        data: ids.map((id) => ({ type: 'appScreenshots', id })),
      });
    });
  }
}

async function waitForScreenshots(loc) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data: sets } = await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
    const states = [];
    for (const set of sets) {
      const { data } = await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
      for (const s of data) states.push([s.attributes.fileName, s.attributes.assetDeliveryState?.state]);
    }
    const failed = states.filter(([, s]) => s === 'FAILED');
    if (failed.length) throw new Error(`Screenshots failed processing: ${failed.map(([f]) => f).join(', ')}`);
    if (states.every(([, s]) => s === 'COMPLETE')) return states.length;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error('Screenshots were still processing after 5 minutes.');
}

async function stepSubmit(version) {
  const { data: open } = await get(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
  if (open.some((s) => ['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(s.attributes.state))) {
    console.log('Already submitted and waiting for review.');
    return;
  }
  let submission = open.find((s) => ['READY_FOR_REVIEW', 'UNRESOLVED_ISSUES'].includes(s.attributes.state));
  if (!submission) {
    submission = (await asc('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
    })).data;
  }
  const { data: items } = await get(`/v1/reviewSubmissions/${submission.id}/items?include=appStoreVersion`);
  if (!items.some((i) => i.relationships?.appStoreVersion?.data?.id === version.id)) {
    await asc('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    });
  }
  const done = await asc('PATCH', `/v1/reviewSubmissions/${submission.id}`, {
    data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
  });
  console.log(`Submitted for review: ${done.data.id} (${done.data.attributes.state}).`);
}

/* ------------------------------------------------------------------ */

async function main() {
  if (!MODES.includes(MODE)) {
    console.error(`Unknown mode "${MODE}". Use plan, apply or submit.`);
    process.exit(2);
  }
  const listing = readListing();
  const build = await pickBuild();
  const buildVersion = build.included?.find((x) => x.type === 'preReleaseVersions')?.attributes.version;
  console.log(`mode=${MODE} build=${build.attributes.version} (${buildVersion})`);

  let version = null;
  try {
    version = await editableVersion(buildVersion);
  } catch (e) {
    if (WRITE) throw e;
    console.log(`blocked: ${e.message}`);
  }
  await stepContentRights();
  await stepAppInfo(listing);
  if (!version) {
    console.log('Version metadata will be applied once the version exists.');
  } else {
    const loc = await stepVersion(version, build, listing);
    await stepScreenshots(loc);
    if (WRITE) console.log(`Screenshots processed: ${await waitForScreenshots(loc)}`);
    if (MODE === 'submit') await stepSubmit(version);
  }
  console.log(changes.length ? `${changes.length} change(s) ${WRITE ? 'applied' : 'pending'}.` : 'App Store Connect already matches store-listing/.');
  console.log('Not covered by the API, check by hand: App Privacy ("Data Not Collected") and Paid/Free agreements.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
