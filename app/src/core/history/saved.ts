import type { SavedDiscovery } from '../types/history';
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
    thumbnailUrl: item.imagery.thumbnailUrl || item.imagery.posterUrl,
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
export const WEB_LINK_BASE = 'https://frontier.go/d';

export function deepLink(itemId: string): string {
  return `${DEEP_LINK_SCHEME}://discovery/${encodeURIComponent(itemId)}`;
}

export function webLink(itemId: string): string {
  return `${WEB_LINK_BASE}/${encodeURIComponent(itemId)}`;
}

export function parseDeepLink(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.protocol.startsWith(DEEP_LINK_SCHEME) && u.hostname === 'discovery' && parts[0]) {
      return decodeURIComponent(parts[0]);
    }
    if (parts[0] === 'd' && parts[1]) return decodeURIComponent(parts[1]);
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
    url: item.source.assetUrl || webLink(item.id),
  };
}
