import type { SavedDiscovery } from '../types/history';
import { SITE_URL } from '../platform/site';
import { thumbnailFor } from '../catalog/artwork';
import type { FrontierMediaItem } from '../types/media';
import { locationHeadline } from '../types/location';

/** Saved discoveries. Save, Saved. No folders, no playlists, no organising. */

export function toSaved(item: FrontierMediaItem, at = new Date().toISOString()): SavedDiscovery {
  return {
    itemId: item.id,
    savedAt: at,
    title: item.title,
    placeLabel: item.location?.displayName || item.location?.regionName || locationHeadline(item.location),
    organization: item.source.organization,
    thumbnailUrl: thumbnailFor(item),
  };
}

export function toggleSaved(list: SavedDiscovery[], item: FrontierMediaItem): SavedDiscovery[] {
  const exists = list.some((s) => s.itemId === item.id);
  if (exists) return list.filter((s) => s.itemId !== item.id);
  return [toSaved(item), ...list];
}

export function isSaved(list: SavedDiscovery[], itemId: string): boolean {
  return list.some((s) => s.itemId === itemId);
}

/**
 * A shareable reference to a discovery. It carries the identity and the
 * provenance, never a copy of the media: redistributing the source file is
 * exactly the thing the rights metadata does not grant.
 */
export interface ShareablePayload {
  title: string;
  text: string;
  url: string;
}

export const DEEP_LINK_SCHEME = 'frontiergo';
/**
 * Shared links open a page on the frontier go site that plays the clip in any
 * browser and offers the app. They used to point at the agency's own page, or
 * at `frontier.go` - which is not a domain - so a share never introduced
 * anyone to the app.
 */
export const WEB_LINK_BASE = `${SITE_URL}/d`;

export function deepLink(itemId: string): string {
  return `${DEEP_LINK_SCHEME}://discovery/${encodeURIComponent(itemId)}`;
}

/**
 * A URL-safe, stable name for a discovery's share page.
 *
 * Item ids carry colons and spaces (`nasa:0158 35sec Green Run Clip`), which a
 * static host cannot use as a directory name. The slug keeps the readable part
 * and appends a short hash of the whole id, so two ids that simplify to the
 * same words still get different pages. The site build and the app both call
 * this, which is the only thing keeping links and pages in step.
 */
export function shareSlug(itemId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < itemId.length; i += 1) {
    h ^= itemId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const readable = itemId
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${readable || 'discovery'}-${h.toString(36)}`;
}

export function webLink(itemId: string): string {
  return `${WEB_LINK_BASE}/${shareSlug(itemId)}/`;
}

/**
 * Turn whatever a link carried - an id from the app's own scheme, or a slug
 * from a shared web page - into an item in the pool.
 */
export function resolveDiscovery<T extends { id: string }>(pool: readonly T[], ref: string): T | undefined {
  return pool.find((i) => i.id === ref) ?? pool.find((i) => shareSlug(i.id) === ref);
}

export function parseDeepLink(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.protocol.startsWith(DEEP_LINK_SCHEME) && u.hostname === 'discovery' && parts[0]) {
      return decodeURIComponent(parts[0]);
    }
    // Only our own site's /d/ links; an arbitrary https URL is not a discovery.
    // The site lives under a path, so match on the full prefix, not the origin.
    if (url.startsWith(`${WEB_LINK_BASE}/`)) {
      const slug = url.slice(WEB_LINK_BASE.length + 1).split(/[/?#]/)[0];
      return slug ? decodeURIComponent(slug) : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function shareable(item: FrontierMediaItem): ShareablePayload {
  const place = item.location?.displayName || item.location?.regionName;
  const lines = [
    place ? `${item.title} — ${place}` : item.title,
    item.source.organization,
  ].filter(Boolean);
  return {
    title: item.title,
    text: `${lines.join('\n')}\n\nSeen on frontier go.`,
    url: webLink(item.id),
  };
}
