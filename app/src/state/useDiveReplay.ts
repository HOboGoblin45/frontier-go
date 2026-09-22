import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiveDetail, DiveSegment } from '../core/dives/types';
import { loadDive, playableSegments, segmentUrl } from '../core/dives/remote';
import { diveTitle } from '../core/dives/atlas';
import { locate } from '../core/dives/telemetry';
import { track } from '../core/analytics/analytics';
import FrontierPlayer from '../player/frontierPlayer';
import type { PlayableItem } from '../player/types';

/**
 * Dive Replay: a whole ROV dive, played segment after segment on the dive's
 * own clock.
 *
 * NOAA records the main camera in five-minute files. Each one becomes a
 * player item; the next is always queued behind the current one, so the dive
 * plays through the way the channel does. The dive time on screen is the
 * segment's start plus the player's position in it, which is what the
 * instruments and the sightings are keyed to.
 *
 * When a dive has no published video, the screen still works: the dive time
 * is set by scrubbing the profile, and the instruments and sightings follow.
 */

export const SEGMENT_PREFIX = 'dive:';

export function segmentItemId(diveId: string, index: number): string {
  return `${SEGMENT_PREFIX}${diveId}:${index}`;
}

export function parseSegmentItemId(id: string): { diveId: string; index: number } | null {
  const m = id.match(/^dive:(EX[0-9A-Z]+-DIVE\d{2}):(\d+)$/);
  return m ? { diveId: m[1], index: Number(m[2]) } : null;
}

export function segmentPlayable(d: DiveDetail, segs: DiveSegment[], index: number): PlayableItem {
  const s = segs[index];
  return {
    id: segmentItemId(d.id, index),
    url: segmentUrl(d, s),
    title: diveTitle(d),
    place: `${Math.round(d.maxDepthMeters).toLocaleString('en-US')} m dive, ${d.cruise}`,
    organization: 'NOAA Ocean Exploration',
    ...(d.cover ? { artworkUrl: d.cover } : {}),
    durationSeconds: s.duration,
  };
}

export type ReplayStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ReplayState {
  status: ReplayStatus;
  detail: DiveDetail | null;
  /** Seconds since the dive's t = 0. */
  time: number;
  playing: boolean;
  /** False when the dive has no published video: the profile drives the time. */
  hasVideo: boolean;
}

const INITIAL: ReplayState = { status: 'idle', detail: null, time: 0, playing: false, hasVideo: false };

export function useDiveReplay(host: { suspend: () => Promise<void>; resume: () => Promise<void> }) {
  const [state, setState] = useState<ReplayState>(INITIAL);
  const detailRef = useRef<DiveDetail | null>(null);
  const segsRef = useRef<DiveSegment[]>([]);
  const indexRef = useRef(0);
  const ownsTransport = useRef(false);
  const openToken = useRef(0);

  // Transport events, only for our own items.
  useEffect(() => {
    let cancelled = false;
    const removers: Array<() => void> = [];
    const on = async (event: Parameters<typeof FrontierPlayer.addListener>[0], cb: (d: Record<string, unknown>) => void) => {
      const h = await FrontierPlayer.addListener(event, cb);
      if (cancelled) { void h.remove(); return; }
      removers.push(() => { void h.remove(); });
    };
    const ours = (d: Record<string, unknown>) => {
      if (!ownsTransport.current) return null;
      const ref = parseSegmentItemId(String(d.itemId ?? ''));
      return ref && ref.diveId === detailRef.current?.id ? ref : null;
    };
    void (async () => {
      await on('onTimeUpdate', (d) => {
        const ref = ours(d);
        const seg = ref ? segsRef.current[ref.index] : undefined;
        if (!seg || typeof d.positionSeconds !== 'number') return;
        setState((s) => ({ ...s, time: seg.t + (d.positionSeconds as number) }));
      });
      await on('onPlaying', (d) => { if (ours(d)) setState((s) => ({ ...s, playing: true })); });
      await on('onPaused', (d) => { if (ours(d)) setState((s) => ({ ...s, playing: false })); });
      await on('onItemChanged', (d) => {
        const ref = ours(d);
        if (!ref) return;
        indexRef.current = ref.index;
        const next = ref.index + 1;
        const detail = detailRef.current;
        if (detail && next < segsRef.current.length) {
          void FrontierPlayer.enqueue({ item: segmentPlayable(detail, segsRef.current, next) });
        }
      });
      await on('onQueueStarved', () => {
        if (!ownsTransport.current) return;
        // The last recording of the dive has played.
        setState((s) => ({ ...s, playing: false }));
      });
    })();
    return () => { cancelled = true; removers.forEach((r) => r()); };
  }, []);

  const playFrom = useCallback(async (at: number) => {
    const detail = detailRef.current;
    const segs = segsRef.current;
    const pos = locate(segs, at);
    if (!detail || !pos) return;
    indexRef.current = pos.index;
    await FrontierPlayer.load({ item: segmentPlayable(detail, segs, pos.index), autoplay: true });
    if (pos.offset > 1) await FrontierPlayer.seek({ seconds: pos.offset });
    if (pos.index + 1 < segs.length) void FrontierPlayer.enqueue({ item: segmentPlayable(detail, segs, pos.index + 1) });
    setState((s) => ({ ...s, time: segs[pos.index].t + pos.offset }));
  }, []);

  const open = useCallback(async (diveId: string, at?: number) => {
    const token = ++openToken.current;
    setState({ ...INITIAL, status: 'loading' });
    const detail = await loadDive(diveId);
    if (token !== openToken.current) return;
    if (!detail) { setState({ ...INITIAL, status: 'error' }); return; }
    detailRef.current = detail;
    const segs = playableSegments(detail);
    segsRef.current = segs;
    const start = at ?? detail.events.find((e) => e.kind === 'on_bottom')?.t ?? 0;
    track('dive_opened', { diveId, replay: segs.length > 0 });
    setState({ status: 'ready', detail, time: start, playing: false, hasVideo: segs.length > 0 });
    if (segs.length) {
      await host.suspend();
      ownsTransport.current = true;
      await playFrom(start);
    }
  }, [host, playFrom]);

  const close = useCallback(async () => {
    openToken.current += 1;
    const had = ownsTransport.current;
    ownsTransport.current = false;
    detailRef.current = null;
    segsRef.current = [];
    setState(INITIAL);
    if (had) {
      await FrontierPlayer.clearQueue({ keepCurrent: false });
      await host.resume();
    }
  }, [host]);

  /** Go to a moment in the dive: plays from there when there is video, otherwise just moves the clock. */
  const seek = useCallback(async (at: number) => {
    const detail = detailRef.current;
    if (!detail) return;
    const end = detail.track.t[detail.track.t.length - 1] ?? 0;
    const t = Math.max(0, Math.min(end, at));
    if (segsRef.current.length && ownsTransport.current) await playFrom(t);
    else setState((s) => ({ ...s, time: t }));
  }, [playFrom]);

  const togglePlay = useCallback(async () => {
    if (!ownsTransport.current) return;
    if (state.playing) await FrontierPlayer.pause();
    else await FrontierPlayer.play();
  }, [state.playing]);

  return { state, open, close, seek, togglePlay };
}

export type DiveReplayApi = ReturnType<typeof useDiveReplay>;
