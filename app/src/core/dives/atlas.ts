import type { DiveDetail, DiveSighting, DiveSummary } from './types';
import { OTHER_LIFE, TAXON_GROUPS } from './groups';

/**
 * Titles and cross-dive views of the dive index: what a dive is called, and
 * "every octopus across every dive" for the atlas pages and collections.
 */

/** A site code ("4aE", "GB648", "AT 251") names a target for the team, not a place for a viewer. */
export function isNamedPlace(s: string | undefined): s is string {
  if (!s) return false;
  if (!/\p{L}{3,}/u.test(s)) return false;
  if (/^[A-Z]{1,3}\s?\d+[A-Z]?$/.test(s.trim())) return false;
  return true;
}

/** Short expedition name: "2021 North Atlantic Stepping Stones" from the full NOAA title. */
export function shortExpedition(name: string | undefined): string | undefined {
  if (!name) return undefined;
  let t = name.replace(/\s*\((?:EX|ROV)[^)]*\)\s*$/i, '').trim();
  const colon = t.indexOf(':');
  if (colon > 8) t = t.slice(0, colon).trim();
  return t || name;
}

/**
 * What a dive is called: its site when the team named one, otherwise its area
 * or expedition with the dive number, because an expedition's dives would
 * otherwise all share one title.
 */
export function diveTitle(d: Pick<DiveSummary, 'site' | 'area' | 'expedition' | 'dive'>): string {
  if (isNamedPlace(d.site)) return d.site;
  const broader = isNamedPlace(d.area) ? d.area : shortExpedition(d.expedition);
  return broader ? `${broader}, dive ${d.dive}` : `Dive ${d.dive}`;
}

export function diveSubtitle(d: Pick<DiveSummary, 'date' | 'maxDepthMeters' | 'cruise' | 'dive'>): string {
  const date = new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m · ${date} · ${d.cruise} dive ${d.dive}`;
}

/** URL-safe slug for a dive's page: "ex2104-dive05". */
export function diveSlug(id: string): string {
  return id.toLowerCase();
}

/** What a sighting is called on screen: the logged common name, else the group, with the scientific name beside it. */
export function sightingLabel(s: DiveSighting): { primary: string; secondary?: string } {
  const common = s.common ? s.common.charAt(0).toUpperCase() + s.common.slice(1) : undefined;
  if (common) return { primary: common, ...(s.taxon && s.taxon.toLowerCase() !== s.common ? { secondary: s.taxon } : {}) };
  return { primary: s.group === OTHER_LIFE.name && s.taxon ? s.taxon : s.group, ...(s.taxon && s.group !== OTHER_LIFE.name ? { secondary: s.taxon } : {}) };
}

export interface GroupSighting {
  diveId: string;
  sighting: DiveSighting;
}

export interface GroupAtlas {
  slug: string;
  name: string;
  count: number;
  dives: number;
  deepest: number;
  shallowest: number;
  /** Most-logged scientific names within the group. */
  taxa: { taxon: string; common?: string; count: number }[];
  /** Up to `limit` sightings spread across dives, deepest first. */
  highlights: GroupSighting[];
}

/** Every group across the given dives, most-sighted first. */
export function buildGroupAtlas(details: readonly DiveDetail[], limit = 60): GroupAtlas[] {
  const byGroup = new Map<string, GroupSighting[]>();
  for (const d of details) {
    for (const s of d.sightings) {
      const list = byGroup.get(s.group) || [];
      list.push({ diveId: d.id, sighting: s });
      byGroup.set(s.group, list);
    }
  }
  const all = [...TAXON_GROUPS, OTHER_LIFE];
  const out: GroupAtlas[] = [];
  for (const g of all) {
    const list = byGroup.get(g.name);
    if (!list?.length) continue;
    const depths = list.map((x) => x.sighting.depth).filter((v): v is number => typeof v === 'number');
    const taxa = new Map<string, { taxon: string; common?: string; count: number }>();
    for (const { sighting } of list) {
      if (!sighting.taxon) continue;
      const t = taxa.get(sighting.taxon) || { taxon: sighting.taxon, ...(sighting.common ? { common: sighting.common } : {}), count: 0 };
      t.count += 1;
      taxa.set(sighting.taxon, t);
    }
    // One highlight per dive first, deepest first, so the list spans the ocean.
    const perDive = new Map<string, GroupSighting>();
    for (const x of list) {
      const cur = perDive.get(x.diveId);
      if (!cur || (x.sighting.depth ?? 0) > (cur.sighting.depth ?? 0)) perDive.set(x.diveId, x);
    }
    out.push({
      slug: g.slug,
      name: g.name,
      count: list.length,
      dives: new Set(list.map((x) => x.diveId)).size,
      deepest: depths.length ? Math.max(...depths) : 0,
      shallowest: depths.length ? Math.min(...depths) : 0,
      taxa: [...taxa.values()].sort((a, b) => b.count - a.count).slice(0, 12),
      highlights: [...perDive.values()].sort((a, b) => (b.sighting.depth ?? 0) - (a.sighting.depth ?? 0)).slice(0, limit),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/**
 * A link to a dive: frontiergo://dive/EX2104-DIVE05 from the website's
 * "Open in the app", or the website's own dive page URL.
 */
export function parseDiveLink(url: string, siteUrl: string): string | null {
  const scheme = url.match(/^frontiergo:\/\/dive\/([A-Za-z0-9-]+)/);
  const web = url.startsWith(`${siteUrl}/dives/`) ? url.slice(siteUrl.length + 7).match(/^([A-Za-z0-9-]+)/) : null;
  const raw = (scheme?.[1] || web?.[1] || '').toUpperCase();
  return /^EX[0-9A-Z]+-DIVE\d{2}$/.test(raw) ? raw : null;
}
