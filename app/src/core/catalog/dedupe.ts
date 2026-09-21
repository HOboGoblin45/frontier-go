import type { FrontierMediaItem } from '../types/media';

/**
 * Duplicate collapse.
 *
 * Providers republish the same footage constantly — the same ROV encounter as a
 * dive highlight and again in a year-end compilation, the same launch from four
 * camera positions. Left alone, one striking clip becomes five entries and the
 * shuffle "repeats itself" in a way no session-repeat rule can catch, because
 * the ids genuinely differ.
 */

const NOISE = [
  /\b\d{3,4}\s*[x×]\s*\d{3,4}\b/gi,   // 1280x720
  /\b(hd|sd|4k|uhd|1080p?|720p?|480p?|60fps|30fps)\b/gi,
  /\b(mp4|mov|clip|video|final|master|edit|v\d+)\b/gi,
  /~(orig|large|medium|small|mobile|preview)\b/gi,
  /\bdive\s*0*\d+\b/gi,
  /\b(ex|na)\d{4}\b/gi,
];

export function normalizeTitle(title: string): string {
  let t = title.toLowerCase();
  for (const re of NOISE) t = t.replace(re, ' ');
  return t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Same provider, same de-noised title, same 15-second duration bucket. */
export function duplicateKey(item: FrontierMediaItem): string {
  const title = normalizeTitle(item.title);
  const bucket = Math.round((item.stream.durationSeconds ?? 0) / 15);
  return `${item.provider}|${title}|${bucket}`;
}

export interface DedupeResult {
  kept: FrontierMediaItem[];
  collapsed: number;
}

/**
 * Keeps the best item per group and tags the whole group with a shared
 * `duplicateGroupId`, so the survivors of a future re-ingest can still be
 * recognised as the same footage.
 */
export function collapseDuplicates(items: FrontierMediaItem[]): DedupeResult {
  const groups = new Map<string, FrontierMediaItem[]>();
  for (const item of items) {
    const key = duplicateKey(item);
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const kept: FrontierMediaItem[] = [];
  let collapsed = 0;
  for (const [key, group] of groups.entries()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const q = (b.ranking?.contentQuality ?? 0) - (a.ranking?.contentQuality ?? 0);
      if (Math.abs(q) > 0.001) return q;
      return (b.stream.height ?? 0) - (a.stream.height ?? 0);
    });
    const winner = sorted[0];
    collapsed += group.length - 1;
    kept.push({
      ...winner,
      ranking: { ...winner.ranking, duplicateGroupId: key },
      health: { ...(winner.health || { productionEligible: false }), duplicateGroupId: key },
    });
  }
  return { kept, collapsed };
}
