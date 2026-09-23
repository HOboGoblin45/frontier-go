/**
 * Build the place gazetteer from Natural Earth (public domain).
 *
 *   npx tsx tools/places/build.ts
 *
 * Natural Earth publishes populated places, first-level admin areas (states,
 * provinces) and countries, each with a label point chosen by cartographers.
 * Those label points are what a provider's place NAME resolves to when the
 * provider publishes a name and no coordinates (the Library of Congress film
 * catalog, for example). Every resolved location says so: accuracy 'region',
 * coordinateSource naming the Natural Earth layer and the feature.
 *
 * Natural Earth terms: "All versions of Natural Earth raster + vector map data
 * found on this website are in the public domain."
 * https://www.naturalearthdata.com/about/terms-of-use/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../data/places/gazetteer.json');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

interface Feature { properties: Record<string, unknown> }

async function layer(name: string): Promise<Feature[]> {
  const local = process.env.NE_DIR ? path.join(process.env.NE_DIR, name) : '';
  const text = local && fs.existsSync(local)
    ? fs.readFileSync(local, 'utf8')
    : await (await fetch(BASE + name)).text();
  return (JSON.parse(text) as { features: Feature[] }).features;
}

const r = (n: unknown) => Math.round(Number(n) * 1e4) / 1e4;
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export interface GazetteerFile {
  source: string;
  /** [name, admin1, country, lat, lon, population] */
  cities: Array<[string, string, string, number, number, number]>;
  /** [name, country, lat, lon] */
  admin1: Array<[string, string, number, number]>;
  /** [name, lat, lon, iso_a2] */
  countries: Array<[string, number, number, string]>;
}

async function main() {
  const [places, states, countries] = await Promise.all([
    layer('ne_10m_populated_places_simple.geojson'),
    layer('ne_10m_admin_1_states_provinces.geojson'),
    layer('ne_110m_admin_0_countries.geojson'),
  ]);
  const out: GazetteerFile = {
    source: 'Natural Earth 1:10m populated places and admin-1, 1:110m admin-0 (public domain)',
    cities: places
      .map((f) => f.properties)
      .map((p) => [s(p.name), s(p.adm1name), s(p.adm0name), r(p.latitude), r(p.longitude), Number(p.pop_max) || 0] as GazetteerFile['cities'][number])
      .filter((c) => c[0] && Number.isFinite(c[3]) && Number.isFinite(c[4])),
    admin1: states
      .map((f) => f.properties)
      .map((p) => [s(p.name), s(p.admin), r(p.latitude), r(p.longitude)] as GazetteerFile['admin1'][number])
      .filter((a) => a[0] && Number.isFinite(a[2]) && Number.isFinite(a[3])),
    countries: countries
      .map((f) => f.properties)
      .map((p) => [s(p.NAME), r(p.LABEL_Y), r(p.LABEL_X), s(p.ISO_A2_EH || p.ISO_A2)] as GazetteerFile['countries'][number])
      .filter((c) => c[0] && Number.isFinite(c[1]) && Number.isFinite(c[2])),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  console.log(`${out.cities.length} places, ${out.admin1.length} admin-1 areas, ${out.countries.length} countries -> ${path.relative(process.cwd(), OUT)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
