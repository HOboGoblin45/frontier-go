/**
 * Re-derive every item's subjects in the committed catalog from what it
 * already carries (title, description, tags, channel), without re-ingesting.
 *
 *   npx tsx tools/ingest/resubject.ts
 *
 * Subjects are derived data (core/catalog/subjects.ts). When the classifier's
 * patterns change, this brings the shipped file in line in seconds; the
 * scheduled ingest would do the same on its next run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FrontierCatalog } from '../../src/core/types/media';
import { subjectsFor } from '../../src/core/catalog/subjects';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '../../public/catalog/frontier-catalog.json');

const catalog = JSON.parse(fs.readFileSync(FILE, 'utf8')) as FrontierCatalog;
let changed = 0;
catalog.items = catalog.items.map((item) => {
  const subjects = subjectsFor({ ...item, subjects: [] });
  if (JSON.stringify(subjects) !== JSON.stringify(item.subjects || [])) changed += 1;
  return { ...item, subjects };
});
fs.writeFileSync(FILE, `${JSON.stringify(catalog)}\n`);
const counts: Record<string, number> = {};
for (const i of catalog.items) for (const s of i.subjects || []) counts[s] = (counts[s] || 0) + 1;
console.log(`${changed} of ${catalog.items.length} items changed`);
console.log(counts);
