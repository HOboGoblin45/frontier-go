// node --test .github/scripts/
// The listing parser is the only part of asc-store.mjs that can be checked
// without App Store Connect, and it is the part a copy edit can break.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fencedAfter, readListing, urlFrom, AGE_RATING_4_PLUS, SCREENSHOT_SETS } from './asc-store.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

test('the committed listing parses and fits every Apple limit', () => {
  const l = readListing(path.join(ROOT, 'store-listing'));
  assert.equal(l.name, 'frontier go: Deep Sea & Space');
  assert.ok(l.subtitle.length <= 30);
  assert.ok(Buffer.byteLength(l.keywords) <= 100);
  assert.ok(l.description.startsWith('frontier go is'));
  assert.ok(l.description.includes('Privacy Policy: https://'));
  assert.match(l.supportUrl, /^https:\/\/hobogoblin45\.github\.io\/frontier-go\/support$/);
  assert.match(l.privacyPolicyUrl, /\/privacy$/);
  assert.ok(l.reviewNotes.includes('17 U.S.C. 105'));
  assert.ok(!l.reviewNotes.includes('```'));
});

test('fencedAfter takes the block under its own heading only', () => {
  const md = '## Name\n\n```\nA\n```\n\n## Empty\n\ntext\n\n## Other\n\n```\nB\n```\n';
  assert.equal(fencedAfter(md, 'Name'), 'A');
  assert.equal(fencedAfter(md, 'Other'), 'B');
  assert.throws(() => fencedAfter(md, 'Empty'), /no code block/);
  assert.throws(() => fencedAfter(md, 'Missing'), /no "## Missing"/);
});

test('urlFrom reads the labelled line', () => {
  assert.equal(urlFrom('- Support: https://x/y\n- Marketing: https://x/', 'Marketing'), 'https://x/');
});

test('agency names in name, subtitle or keywords are refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listing-'));
  const md = fs.readFileSync(path.join(ROOT, 'store-listing', 'description.md'), 'utf8')
    .replace('tv,screensaver', 'nasa,screensaver');
  fs.writeFileSync(path.join(dir, 'description.md'), md);
  fs.copyFileSync(path.join(ROOT, 'store-listing', 'review-notes.md'), path.join(dir, 'review-notes.md'));
  assert.throws(() => readListing(dir), /agency names/);
});

test('age rating answers are all none or false', () => {
  for (const v of Object.values(AGE_RATING_4_PLUS)) assert.ok(v === 'NONE' || v === false);
});

test('every screenshot folder exists with six PNGs of the right size', () => {
  const sizes = { 'iphone-6.9': [1320, 2868], 'ipad-13': [2064, 2752] };
  for (const folder of Object.keys(SCREENSHOT_SETS)) {
    const dir = path.join(ROOT, 'store-listing', 'screenshots', folder);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    assert.equal(files.length, 6, folder);
    for (const f of files) {
      const b = fs.readFileSync(path.join(dir, f));
      assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], sizes[folder], `${folder}/${f}`);
    }
  }
});

test('analytics summary sums counts per event and ignores text columns', async () => {
  const { summarise } = await import('./asc-analytics.mjs');
  const tsv = 'Date\tApp Name\tEvent\tCounts\tUnique Counts\n2026-10-01\tx\tImpression\t10\t8\n2026-10-02\tx\tImpression\t5\t5\n2026-10-02\tx\tPage view\t3\t2\n';
  assert.deepEqual(summarise(tsv), {
    rows: 3,
    totals: { Impression: { Counts: 15, 'Unique Counts': 13 }, 'Page view': { Counts: 3, 'Unique Counts': 2 } },
  });
  assert.deepEqual(summarise(''), { rows: 0, totals: {} });
});
