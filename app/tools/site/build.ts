/**
 * Build the frontier go website for GitHub Pages.
 *
 *   npx tsx tools/site/build.ts      -> app/site-dist/
 *
 * Static pages from landing-page/, the current catalog (which the app fetches
 * for new footage), and one pre-rendered share page per clip. Run by
 * deploy-site.yml on every change to the site or the catalog.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexCatalog } from '../../src/core/catalog/catalog';
import type { FrontierCatalog } from '../../src/core/types/media';
import { SITE_URL } from '../../src/core/platform/site';
import { renderNotFound, renderSharePage, sharePagePath } from './share-page';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '../..');
const SOURCE = resolve(APP, '../landing-page');
const OUT = resolve(APP, 'site-dist');
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, ''); // "/frontier-go"

/** The hand-written pages use root-relative links; the site lives under a path. */
function rebase(html: string): string {
  return html
    // Link previews need absolute image URLs.
    .replace(/content="\/(?!\/)/g, `content="${SITE_URL}/`)
    .replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const name of await readdir(SOURCE)) {
    if (name === 'README.md') continue;
    const from = resolve(SOURCE, name);
    if (name.endsWith('.html')) {
      const html = rebase(await readFile(from, 'utf8'));
      await writeFile(resolve(OUT, name), html);
      // Extensionless URLs (/privacy, /support) as directories too, so the
      // links in the app work whichever way the host resolves them.
      if (name !== 'index.html') {
        const dir = resolve(OUT, name.replace(/\.html$/, ''));
        await mkdir(dir, { recursive: true });
        await writeFile(resolve(dir, 'index.html'), html);
      }
    } else {
      await cp(from, resolve(OUT, name), { recursive: true });
    }
  }

  // GitHub Pages runs Jekyll unless told not to, which hides underscore paths.
  await writeFile(resolve(OUT, '.nojekyll'), '');

  const raw = await readFile(resolve(APP, 'public/catalog/frontier-catalog.json'), 'utf8');
  const catalog = JSON.parse(raw) as FrontierCatalog;
  await mkdir(resolve(OUT, 'catalog'), { recursive: true });
  await writeFile(resolve(OUT, 'catalog/frontier-catalog.json'), raw);
  await cp(resolve(APP, 'public/catalog/catalog-meta.json'), resolve(OUT, 'catalog/catalog-meta.json'));

  // One page per clip that passes the client's own gate - the same gate the
  // app applies - so a link never advertises something the app would refuse.
  const { eligible } = indexCatalog(catalog);
  const seen = new Set<string>();
  for (const item of eligible) {
    const path = sharePagePath(item);
    if (seen.has(path)) throw new Error(`share slug collision: ${path}`);
    seen.add(path);
    await mkdir(resolve(OUT, dirname(path)), { recursive: true });
    await writeFile(resolve(OUT, path), renderSharePage(item));
  }
  await writeFile(resolve(OUT, '404.html'), renderNotFound());

  console.log(`site: ${eligible.length} share pages, catalog ${catalog.generatedAt}, base ${BASE_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
