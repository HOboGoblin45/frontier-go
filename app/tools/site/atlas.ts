/**
 * The Deep Atlas: every Okeanos Explorer ROV dive NOAA has archived, as web
 * pages. One page per dive (its depth profile, what the scientists saw and
 * when, where it was), one per group of animals across every dive, and a map.
 *
 * These pages are the public face of the dive index: they are what a search
 * for "dumbo octopus depth" or a seamount's name can land on, they carry the
 * link into the app, and they show anyone evaluating frontier go what the
 * index is without installing anything.
 */
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-110m.json';
import type { DiveDetail, DiveSummary } from '../../src/core/dives/types';
import type { GroupAtlas } from '../../src/core/dives/atlas';
import { diveSlug, diveSubtitle, diveTitle, shortExpedition, sightingLabel } from '../../src/core/dives/atlas';
import { OTHER_LIFE } from '../../src/core/dives/groups';
import { formatClock, instrumentsAt } from '../../src/core/dives/telemetry';
import { SITE_URL } from '../../src/core/platform/site';
import { esc, getTheApp, shell } from './share-page';
import { coverStill, pictureFor, stillNear, stillPath, stripSightings } from '../dives/stills';

export const ATLAS_CSS = `
  .hero{margin:26px 0 8px}
  .hero h1{font-size:40px;margin:6px 0 10px}
  .lede{color:var(--stone);font-size:17px;line-height:1.6;max-width:720px}
  .stats{display:flex;flex-wrap:wrap;gap:28px;margin:22px 0 6px}
  .stat b{display:block;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:30px;color:var(--bone)}
  .stat span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(215,201,187,.6)}
  h2{font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:24px;margin:40px 0 14px}
  .map{width:100%;height:auto;display:block;margin-top:18px;border-radius:14px;background:#0F1613}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
  .card{display:block;text-decoration:none;color:var(--bone);background:#131A15;border:1px solid rgba(215,201,187,.1);border-radius:14px;overflow:hidden}
  .card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0F1613}
  .card .noimg{aspect-ratio:16/9;background:linear-gradient(160deg,#10231d,#0B0F0E)}
  .card .body{padding:12px 14px 14px}
  .card .t{font-size:15px;line-height:1.3}
  .card .s{font-size:12.5px;color:rgba(215,201,187,.65);margin-top:5px;line-height:1.4}
  .list{list-style:none;padding:0;margin:0}
  .list li{padding:10px 0;border-bottom:1px solid rgba(215,201,187,.08);display:flex;justify-content:space-between;gap:16px}
  .list a{color:var(--bone);text-decoration:none}
  .list .m{color:rgba(215,201,187,.6);font-size:13px;white-space:nowrap}
  .cover{margin:22px -20px 0;aspect-ratio:16/9;background:#000 center/cover no-repeat}
  @media (min-width:800px){.cover{margin:22px 0 0;border-radius:14px}}
  .profile{width:100%;height:auto;display:block;margin-top:10px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{font-weight:400;text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(215,201,187,.55);padding:8px 8px 8px 0;border-bottom:1px solid rgba(215,201,187,.12)}
  td{padding:9px 8px 9px 0;border-bottom:1px solid rgba(215,201,187,.06);vertical-align:top}
  td.n{white-space:nowrap;color:rgba(215,201,187,.7);font-variant-numeric:tabular-nums}
  td i{color:rgba(215,201,187,.6)}
  .facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;font-size:14px;color:var(--stone)}
  .facts dt{color:rgba(215,201,187,.55)}
  .facts dd{margin:0}
  .crumbs{margin-top:18px;font-size:13px;color:rgba(215,201,187,.6)}
  .crumbs a{color:rgba(215,201,187,.8)}
`;

const ATLAS_URL = `${SITE_URL}/dives/`;

function img(src: string | undefined, alt: string): string {
  return src ? `<img src="${esc(`${SITE_URL}/${src}`)}" alt="${esc(alt)}" loading="lazy" width="480" height="270">` : '<div class="noimg"></div>';
}

export function divePageUrl(id: string): string {
  return `${SITE_URL}/dives/${diveSlug(id)}/`;
}

export function groupPageUrl(slug: string): string {
  return `${SITE_URL}/life/${slug}/`;
}

function hours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`;
}

/* ------------------------------------------------------------------ */
/* Pictures drawn from the data                                        */
/* ------------------------------------------------------------------ */

const W = 1000;
const H = 500;
const project = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

let landPath: string | undefined;
function land(): string {
  if (landPath) return landPath;
  const topo = landTopology as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land) as unknown as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  const parts: string[] = [];
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) {
      for (const ring of poly) {
        let d = '';
        let prevX: number | null = null;
        for (const [lon, lat] of ring) {
          const [x, y] = project(lon, lat);
          // Break the ring where it wraps the antimeridian instead of drawing across the map.
          d += `${prevX === null || Math.abs(x - prevX) > W / 2 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          prevX = x;
        }
        parts.push(`${d}Z`);
      }
    }
  }
  landPath = parts.join('');
  return landPath;
}

/** The land shapes, written once per build as dives/land.svg and drawn behind every map. */
export function landSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${land()}" fill="#22302A"/></svg>`;
}

/**
 * Dive sites on the map. With `focus`, the view closes in on those dives (an
 * expedition) instead of showing the whole world; the land is the same shared
 * drawing either way.
 */
export function worldMap(dives: readonly DiveSummary[], highlight?: string, focus?: readonly DiveSummary[]): string {
  let vx = 0; let vy = 0; let vw = W; let vh = H;
  if (focus && focus.length) {
    const pts = focus.map((d) => project(d.longitude, d.latitude));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    vw = Math.min(W, Math.max(120, (Math.max(...xs) - Math.min(...xs)) * 1.6, (Math.max(...ys) - Math.min(...ys)) * 3.2));
    vh = vw / 2;
    vx = Math.max(0, Math.min(W - vw, cx - vw / 2));
    vy = Math.max(0, Math.min(H - vh, cy - vh / 2));
  }
  const k = vw / W;
  const dots = dives.map((d) => {
    const [x, y] = project(d.longitude, d.latitude);
    const on = highlight === d.id;
    return `<a href="${esc(divePageUrl(d.id))}"><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${((on ? 7 : 3.2) * k).toFixed(2)}" fill="${on ? '#F4EFE7' : '#B0886B'}" fill-opacity="${on ? 1 : 0.85}"><title>${esc(`${diveTitle(d)}, ${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m`)}</title></circle></a>`;
  }).join('');
  return `<svg class="map" viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" role="img" aria-label="Map of dive sites">
  <image href="${SITE_URL}/dives/land.svg" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>
  ${dots}
</svg>`;
}

/** Depth over time, with every sighting marked where it happened. */
export function depthProfile(d: DiveDetail): string {
  const w = 1000;
  const h = 260;
  const padL = 56;
  const padB = 28;
  const padT = 12;
  const tMax = Math.max(1, d.track.t[d.track.t.length - 1]);
  const dMax = Math.max(50, ...d.track.depth) * 1.05;
  const x = (t: number) => padL + (t / tMax) * (w - padL - 10);
  const y = (m: number) => padT + (m / dMax) * (h - padT - padB);
  let path = '';
  d.track.t.forEach((t, i) => { path += `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(d.track.depth[i]).toFixed(1)}`; });
  const area = `${path}L${x(tMax).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const ticks: string[] = [];
  const step = dMax > 3000 ? 1000 : dMax > 1200 ? 500 : dMax > 400 ? 200 : 100;
  for (let m = 0; m <= dMax; m += step) {
    ticks.push(`<line x1="${padL}" x2="${w - 10}" y1="${y(m)}" y2="${y(m)}" stroke="rgba(215,201,187,.08)"/><text x="${padL - 8}" y="${y(m) + 4}" text-anchor="end" font-size="12" fill="rgba(215,201,187,.55)">${m.toLocaleString('en-US')} m</text>`);
  }
  const hourTicks: string[] = [];
  for (let s = 3600; s < tMax; s += 3600) {
    hourTicks.push(`<text x="${x(s)}" y="${h - 8}" text-anchor="middle" font-size="12" fill="rgba(215,201,187,.55)">${s / 3600} h</text>`);
  }
  const marks = d.sightings.map((s) => {
    const depth = s.depth ?? instrumentsAt(d.track, [], s.t).depth;
    const { primary } = sightingLabel(s);
    return `<circle cx="${x(s.t).toFixed(1)}" cy="${y(depth).toFixed(1)}" r="3" fill="#F4EFE7" fill-opacity=".8"><title>${esc(`${formatClock(s.t)} · ${primary} · ${Math.round(depth).toLocaleString('en-US')} m`)}</title></circle>`;
  }).join('');
  return `<svg class="profile" viewBox="0 0 ${w} ${h}" role="img" aria-label="Depth of the vehicle over the dive, with sightings marked">
  ${ticks.join('')}${hourTicks.join('')}
  <path d="${area}" fill="rgba(176,136,107,.10)"/>
  <path d="${path}" fill="none" stroke="#B0886B" stroke-width="2"/>
  ${marks}
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export interface AtlasContext {
  /** Site paths of stills that exist in the build. */
  stills: Set<string>;
}

function stillSrc(ctx: AtlasContext, diveId: string, file: string | undefined): string | undefined {
  if (!file) return undefined;
  const p = stillPath(diveId, file);
  return ctx.stills.has(p) ? p : undefined;
}

export function diveCoverPath(d: DiveDetail, ctx: AtlasContext): string | undefined {
  return stillSrc(ctx, d.id, coverStill(d)?.file);
}

const REPLAY_MESSAGE = '<strong>frontier go</strong> plays real deep-sea and space footage continuously, credited to the agencies that shot it, and places every dive on a globe. Free, no account, no ads.';

export function renderDivePage(d: DiveDetail, ctx: AtlasContext, neighbours: DiveSummary[]): string {
  const title = diveTitle(d);
  const cover = diveCoverPath(d, ctx);
  const strip = stripSightings(d, 6)
    .map(({ sighting, still }) => ({ sighting, src: stillSrc(ctx, d.id, still.file) }))
    .filter((x) => x.src);
  const expedition = shortExpedition(d.expedition);
  const description = `${title}: a NOAA Okeanos Explorer ROV dive to ${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m on ${diveSubtitle(d).split(' · ')[1]}. ${d.sightingCount ? `${d.sightingCount} sightings logged by the science team, including ${d.groups.slice(0, 3).join(', ').toLowerCase()}.` : ''}`.trim();

  const rows = d.sightings.map((s) => {
    const { primary, secondary } = sightingLabel(s);
    const utc = new Date((d.startUnix + s.t) * 1000).toISOString().slice(11, 19);
    return `<tr id="t${Math.round(s.t)}"><td class="n">${formatClock(s.t)}</td><td>${esc(primary)}${secondary ? ` <i>${esc(secondary)}</i>` : ''}${s.note ? `<br><span style="color:rgba(215,201,187,.6);font-size:13px">${esc(s.note)}</span>` : ''}</td><td class="n">${s.depth ? `${Math.round(s.depth).toLocaleString('en-US')} m` : ''}</td><td class="n">${typeof s.tempC === 'number' ? `${s.tempC.toFixed(1)} °C` : ''}</td><td class="n">${utc}</td></tr>`;
  }).join('');

  const body = `
  <div class="crumbs"><a href="${ATLAS_URL}">Deep Atlas</a>${expedition ? ` &middot; ${esc(expedition)}` : ''}</div>
  ${cover ? `<div class="cover" style="background-image:url('${esc(`${SITE_URL}/${cover}`)}')" role="img" aria-label="${esc(title)}"></div>` : ''}
  <div class="eyebrow">${esc(d.cruise)} &middot; dive ${d.dive}</div>
  <h1>${esc(title)}</h1>
  <div class="place">${esc(diveSubtitle(d))}</div>
  ${d.purpose ? `<p class="desc">${esc(d.purpose)}</p>` : ''}
  <div class="stats">
    <div class="stat"><b>${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m</b><span>deepest</span></div>
    ${d.bottomSeconds ? `<div class="stat"><b>${hours(d.bottomSeconds)}</b><span>on the bottom</span></div>` : ''}
    <div class="stat"><b>${d.sightingCount.toLocaleString('en-US')}</b><span>sightings</span></div>
    ${d.videoSeconds ? `<div class="stat"><b>${hours(d.videoSeconds)}</b><span>of camera footage</span></div>` : ''}
  </div>
  <h2>The descent</h2>
  ${depthProfile(d)}
  ${strip.length ? `<h2>Seen on this dive</h2><div class="grid">${strip.map(({ sighting, src }) => {
    const { primary, secondary } = sightingLabel(sighting);
    return `<a class="card" href="#t${Math.round(sighting.t)}">${img(src, primary)}<div class="body"><div class="t">${esc(primary)}</div><div class="s">${secondary ? `${esc(secondary)} · ` : ''}${sighting.depth ? `${Math.round(sighting.depth).toLocaleString('en-US')} m · ` : ''}${formatClock(sighting.t)} into the dive</div></div></a>`;
  }).join('')}</div>` : ''}
  ${d.sightings.length ? `<h2>Every sighting, as it was logged</h2>
  <table><thead><tr><th>Into dive</th><th>What</th><th>Depth</th><th>Water</th><th>UTC</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
  <h2>Where</h2>
  ${worldMap(neighbours, d.id, neighbours)}
  <dl class="facts" style="margin-top:16px">
    <dt>Position</dt><dd>${Math.abs(d.latitude).toFixed(4)}&deg; ${d.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(d.longitude).toFixed(4)}&deg; ${d.longitude >= 0 ? 'E' : 'W'} (where the vehicle reached the bottom)</dd>
    ${d.area ? `<dt>Area</dt><dd>${esc(d.area)}</dd>` : ''}
    ${d.expedition ? `<dt>Expedition</dt><dd>${esc(d.expedition)}</dd>` : ''}
    <dt>Vessel</dt><dd>NOAA Ship Okeanos Explorer, ROV Deep Discoverer</dd>
    <dt>Source</dt><dd><a href="${esc(d.source.landingPage)}" rel="noopener">NOAA archive for ${esc(d.cruise)}</a> &middot; <a href="${SITE_URL}/dives/data/${esc(d.id)}.json">this dive as data</a></dd>
    <dt>Credit</dt><dd>${esc(d.source.credit)}. Photographs are the vehicle's own framegrabs.</dd>
  </dl>
  ${getTheApp(`frontiergo://dive/${d.id}`, REPLAY_MESSAGE)}`;

  return shell({
    title: `${title} — ${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m dive — frontier go`,
    description,
    image: cover ? `${SITE_URL}/${cover}` : undefined,
    canonical: divePageUrl(d.id),
    body,
    wide: true,
    css: ATLAS_CSS,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${title} (${d.cruise} dive ${d.dive})`,
      description,
      url: divePageUrl(d.id),
      creator: { '@type': 'Organization', name: 'NOAA Ocean Exploration' },
      license: 'https://www.usa.gov/government-works',
      temporalCoverage: d.date,
      spatialCoverage: { '@type': 'Place', geo: { '@type': 'GeoCoordinates', latitude: d.latitude, longitude: d.longitude } },
      isAccessibleForFree: true,
    },
  });
}

export function renderGroupPage(g: GroupAtlas, details: Map<string, DiveDetail>, ctx: AtlasContext): string {
  const cards = g.highlights.map(({ diveId, sighting: deepest }) => {
    const d = details.get(diveId)!;
    const sighting = pictureFor(d, g.name, deepest);
    const still = stillNear(d.stills, sighting.t);
    const src = stillSrc(ctx, diveId, still?.file);
    const { primary, secondary } = sightingLabel(sighting);
    return `<a class="card" href="${esc(divePageUrl(diveId))}#t${Math.round(sighting.t)}">${img(src, primary)}<div class="body"><div class="t">${esc(primary)}${secondary ? ` <i style="color:rgba(215,201,187,.6)">${esc(secondary)}</i>` : ''}</div><div class="s">${sighting.depth ? `${Math.round(sighting.depth).toLocaleString('en-US')} m · ` : ''}${esc(diveTitle(d))}, ${esc(d.date.slice(0, 4))}</div></div></a>`;
  }).join('');
  const taxa = g.taxa.map((t) => `<li><span><i>${esc(t.taxon)}</i>${t.common ? ` &middot; ${esc(t.common)}` : ''}</span><span class="m">${t.count.toLocaleString('en-US')}</span></li>`).join('');
  const range = g.deepest ? `${Math.round(g.shallowest).toLocaleString('en-US')} to ${Math.round(g.deepest).toLocaleString('en-US')} m` : '';
  const description = `${g.name} in the deep sea: ${g.count.toLocaleString('en-US')} sightings on ${g.dives} NOAA ROV dives${range ? `, ${range} down` : ''}, each linked to the second it was logged.`;
  const body = `
  <div class="crumbs"><a href="${ATLAS_URL}">Deep Atlas</a> &middot; Life in the deep</div>
  <div class="hero"><div class="eyebrow">Life in the deep</div><h1>${esc(g.name)}</h1>
  <p class="lede">${esc(description)}</p></div>
  <div class="stats">
    <div class="stat"><b>${g.count.toLocaleString('en-US')}</b><span>sightings</span></div>
    <div class="stat"><b>${g.dives}</b><span>dives</span></div>
    ${g.deepest ? `<div class="stat"><b>${Math.round(g.deepest).toLocaleString('en-US')} m</b><span>deepest</span></div>` : ''}
  </div>
  <h2>One from each dive, deepest first</h2>
  <div class="grid">${cards}</div>
  ${taxa ? `<h2>Most often logged</h2><ul class="list">${taxa}</ul>` : ''}
  ${getTheApp('frontiergo://', REPLAY_MESSAGE)}`;
  const first = g.highlights.map(({ diveId, sighting }) => {
    const d = details.get(diveId)!;
    return stillSrc(ctx, diveId, stillNear(d.stills, pictureFor(d, g.name, sighting).t)?.file);
  }).find(Boolean);
  return shell({ title: `${g.name} of the deep sea — frontier go`, description, image: first ? `${SITE_URL}/${first}` : undefined, canonical: groupPageUrl(g.slug), body, wide: true, css: ATLAS_CSS });
}

export function renderAtlasHome(dives: readonly DiveSummary[], groups: GroupAtlas[], details: Map<string, DiveDetail>, ctx: AtlasContext): string {
  const hoursTotal = dives.reduce((s, d) => s + d.videoSeconds, 0) / 3600;
  const sightings = dives.reduce((s, d) => s + d.sightingCount, 0);
  const deepest = [...dives].sort((a, b) => b.maxDepthMeters - a.maxDepthMeters)[0];
  const years = [...new Set(dives.map((d) => d.date.slice(0, 4)))].sort();

  const groupCards = groups.filter((g) => g.slug !== OTHER_LIFE.slug).map((g) => {
    // The group's card uses the first of its dives with a real picture.
    const src = g.highlights.map((h) => {
      const d = details.get(h.diveId)!;
      return stillSrc(ctx, h.diveId, stillNear(d.stills, pictureFor(d, g.name, h.sighting).t, 30)?.file);
    }).find(Boolean);
    return `<a class="card" href="${esc(groupPageUrl(g.slug))}">${img(src, g.name)}<div class="body"><div class="t">${esc(g.name)}</div><div class="s">${g.count.toLocaleString('en-US')} sightings · ${g.dives} dives${g.deepest ? ` · to ${Math.round(g.deepest).toLocaleString('en-US')} m` : ''}</div></div></a>`;
  }).join('');

  const byExpedition = new Map<string, DiveSummary[]>();
  for (const d of dives) {
    const key = `${d.cruise.slice(0, 6)}|${shortExpedition(d.expedition) || d.cruise}`;
    const list = byExpedition.get(key) || [];
    list.push(d);
    byExpedition.set(key, list);
  }
  const expeditions = [...byExpedition.entries()]
    .sort((a, b) => b[1][0].date.localeCompare(a[1][0].date))
    .map(([key, list]) => `<h3 style="font-weight:400;font-size:16px;margin:26px 0 6px">${esc(key.split('|')[1])} <span style="color:rgba(215,201,187,.55);font-size:13px">${esc(list[0].date.slice(0, 4))}</span></h3>
    <ul class="list">${list.map((d) => `<li><a href="${esc(divePageUrl(d.id))}">${esc(diveTitle(d))}</a><span class="m">${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m${d.sightingCount ? ` · ${d.sightingCount} sightings` : ''}</span></li>`).join('')}</ul>`).join('');

  const body = `
  <div class="hero">
    <div class="eyebrow">The Deep Atlas</div>
    <h1>Every dive, every animal, to the second.</h1>
    <p class="lede">Since ${years[0]}, NOAA Ship Okeanos Explorer has sent its remotely operated vehicle to the deep sea
      ${dives.length} times, recording the camera, the vehicle's position and depth every second, and every animal the
      scientists named as it appeared. frontier go lines the three up. Here is all of it.</p>
  </div>
  <div class="stats">
    <div class="stat"><b>${dives.length.toLocaleString('en-US')}</b><span>dives</span></div>
    <div class="stat"><b>${Math.round(hoursTotal).toLocaleString('en-US')} h</b><span>of camera footage</span></div>
    <div class="stat"><b>${sightings.toLocaleString('en-US')}</b><span>sightings</span></div>
    <div class="stat"><b>${Math.round(deepest.maxDepthMeters).toLocaleString('en-US')} m</b><span>deepest dive</span></div>
  </div>
  ${worldMap(dives)}
  <h2>Life in the deep</h2>
  <div class="grid">${groupCards}</div>
  <h2>Every dive</h2>
  ${expeditions}
  <p class="credit" style="margin-top:28px">Source: NOAA Ocean Exploration's archive of Okeanos Explorer ROV dives (dive summaries, 1&nbsp;Hz vehicle tracks, science annotations and framegrabs). Public domain; credited to NOAA Ocean Exploration.</p>
  ${getTheApp('frontiergo://', REPLAY_MESSAGE)}`;
  return shell({
    title: 'The Deep Atlas: every NOAA deep-sea ROV dive — frontier go',
    description: `${dives.length} deep-sea ROV dives, ${Math.round(hoursTotal).toLocaleString('en-US')} hours of footage and ${sightings.toLocaleString('en-US')} logged sightings, each placed on the map and timed to the second.`,
    canonical: ATLAS_URL,
    body,
    wide: true,
    css: ATLAS_CSS,
  });
}

/** All pages for the sitemap. */
export function atlasUrls(dives: readonly DiveSummary[], groups: GroupAtlas[]): string[] {
  return [ATLAS_URL, ...groups.map((g) => groupPageUrl(g.slug)), ...dives.map((d) => divePageUrl(d.id))];
}
