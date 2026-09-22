/**
 * App Store Connect analytics, pulled to a private folder.
 *
 * The acquisition plan rests on one kind of evidence: Apple's own numbers for
 * installs, sessions, retention and where installs came from. Buyers ask for
 * them by screen-share; having every month on file, untouched, is better.
 *
 *   node .github/scripts/asc-analytics.mjs ensure          start Apple's ongoing report request (once)
 *   node .github/scripts/asc-analytics.mjs pull <outDir>   download every new report and write a summary
 *
 * Deliberately run on the owner's machine, not in CI: this repository is
 * public, and so are its Actions artifacts. The numbers are not.
 *
 * Environment: APP_STORE_CONNECT_API_KEY_ID, _ISSUER_ID, and _BASE64 or _PATH.
 * The key must have the Admin role to create the request; Sales and Reports
 * is enough to pull. Apple stops a request nobody reads for a long time, so
 * `pull` should run at least monthly.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const APP_ID = '6764209094';
/** Standard-level reports only: Detailed adds privacy thresholds and nothing a buyer asks for. */
const CATEGORIES = new Set(['APP_STORE_ENGAGEMENT', 'APP_STORE_COMMERCE', 'APP_USAGE']);

function privateKey() {
  if (process.env.APP_STORE_CONNECT_API_KEY_BASE64) {
    return Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_BASE64, 'base64').toString('utf8');
  }
  if (process.env.APP_STORE_CONNECT_API_KEY_PATH) return fs.readFileSync(process.env.APP_STORE_CONNECT_API_KEY_PATH, 'utf8');
  throw new Error('Set APP_STORE_CONNECT_API_KEY_BASE64 or APP_STORE_CONNECT_API_KEY_PATH');
}

function token() {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'ES256', kid: process.env.APP_STORE_CONNECT_API_KEY_ID, typ: 'JWT' });
  const payload = b64({ iss: process.env.APP_STORE_CONNECT_API_KEY_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

async function asc(method, p, body) {
  const url = p.startsWith('http') ? p : `https://api.appstoreconnect.apple.com${p}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (json.errors) throw new Error(`${method} ${p}: ${json.errors.map((e) => `${e.status} ${e.detail}`).join('; ')}`);
  return json;
}

/** Every page of a list endpoint. */
async function all(p) {
  const out = [];
  let next = p;
  while (next) {
    const page = await asc('GET', next);
    out.push(...(page.data || []));
    next = page.links?.next;
  }
  return out;
}

async function ongoingRequest() {
  const requests = await all(`/v1/apps/${APP_ID}/analyticsReportRequests`);
  return requests.find((r) => r.attributes.accessType === 'ONGOING' && !r.attributes.stoppedDueToInactivity);
}

async function ensure() {
  const existing = await ongoingRequest();
  if (existing) {
    console.log(`Ongoing report request already active: ${existing.id}`);
    return existing;
  }
  const created = await asc('POST', '/v1/analyticsReportRequests', {
    data: {
      type: 'analyticsReportRequests',
      attributes: { accessType: 'ONGOING' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  console.log(`Created ongoing report request ${created.data.id}. Apple generates the first reports in 1-2 days.`);
  return created.data;
}

/**
 * Sums numeric columns, grouped by Event when the report has one. Apple's
 * files are tab-separated with a header row; the columns differ per report,
 * so this reads whatever is there rather than assuming a schema.
 */
export function summarise(tsv) {
  const [head, ...rows] = tsv.trim().split(/\r?\n/);
  if (!head) return { rows: 0, totals: {} };
  const cols = head.split('\t');
  const eventIdx = cols.indexOf('Event');
  const numeric = cols
    .map((c, i) => [c, i])
    .filter(([c]) => /^(Counts|Sessions|Total Session Duration|Unique Devices|Unique Counts)$/.test(c));
  const totals = {};
  for (const line of rows) {
    const f = line.split('\t');
    const key = eventIdx >= 0 ? f[eventIdx] || '(none)' : 'all';
    totals[key] ||= {};
    for (const [c, i] of numeric) {
      const n = Number(f[i]);
      if (Number.isFinite(n)) totals[key][c] = (totals[key][c] || 0) + n;
    }
  }
  return { rows: rows.length, totals };
}

async function pull(outDir) {
  const request = await ongoingRequest();
  if (!request) throw new Error('No active ongoing report request. Run `ensure` first (needs an Admin key).');
  const reports = (await all(`/v1/analyticsReportRequests/${request.id}/reports`))
    .filter((r) => CATEGORIES.has(r.attributes.category) && /Standard$/.test(r.attributes.name));
  const rawDir = path.join(outDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const lines = [`# App Store analytics — pulled ${new Date().toISOString().slice(0, 10)}`, ''];
  let fetched = 0;
  for (const report of reports) {
    const instances = await all(`/v1/analyticsReports/${report.id}/instances?filter[granularity]=MONTHLY`);
    lines.push(`## ${report.attributes.name}`, '');
    if (!instances.length) {
      lines.push('No monthly data yet.', '');
      continue;
    }
    for (const inst of instances.sort((a, b) => a.attributes.processingDate.localeCompare(b.attributes.processingDate))) {
      const base = `${report.attributes.name.replace(/\W+/g, '-')}_${inst.attributes.processingDate}`;
      const file = path.join(rawDir, `${base}.tsv`);
      if (!fs.existsSync(file)) {
        const segments = await all(`/v1/analyticsReportInstances/${inst.id}/segments`);
        const parts = [];
        for (const seg of segments) {
          const res = await fetch(seg.attributes.url);
          const buf = Buffer.from(await res.arrayBuffer());
          if (seg.attributes.checksum && crypto.createHash('md5').update(buf).digest('hex') !== seg.attributes.checksum) {
            throw new Error(`Checksum mismatch in ${base}`);
          }
          parts.push(zlib.gunzipSync(buf).toString('utf8'));
        }
        // Later segments repeat the header; keep the first.
        const [first, ...rest] = parts;
        fs.writeFileSync(file, [first, ...rest.map((t) => t.split(/\r?\n/).slice(1).join('\n'))].filter(Boolean).join('\n'));
        fetched += 1;
      }
      const { rows, totals } = summarise(fs.readFileSync(file, 'utf8'));
      lines.push(`### ${inst.attributes.processingDate} (${rows} rows)`, '');
      for (const [event, sums] of Object.entries(totals)) {
        lines.push(`- ${event}: ${Object.entries(sums).map(([k, v]) => `${k} ${Math.round(v).toLocaleString('en-US')}`).join(', ')}`);
      }
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), lines.join('\n'));
  console.log(`${reports.length} reports, ${fetched} new files. Summary: ${path.join(outDir, 'SUMMARY.md')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, out] = process.argv.slice(2);
  const run = cmd === 'ensure' ? ensure() : cmd === 'pull' && out ? pull(out) : Promise.reject(new Error('Usage: ensure | pull <outDir>'));
  run.catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
