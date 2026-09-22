/**
 * Link the committed catalog's NOAA clips to their dives without a full
 * re-ingest. The weekly ingest does the same thing itself; this exists so a
 * new dive index takes effect the day it is built.
 *
 *   npx tsx tools/dives/link-catalog.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FrontierCatalog } from '../../src/core/types/media';
import type { DiveIndex } from '../../src/core/dives/types';
import { linkClipsToDives } from '../../src/core/dives/link';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(HERE, '../../public/catalog/frontier-catalog.json');
const INDEX = path.resolve(HERE, '../../data/dives/index.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as FrontierCatalog;
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8')) as DiveIndex;
const linked = linkClipsToDives(catalog.items, index.dives);
fs.writeFileSync(CATALOG, `${JSON.stringify(catalog)}\n`, 'utf8');
console.log(`${linked} clips linked to their dive`);
