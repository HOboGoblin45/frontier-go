import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FrontierChannel, FrontierMediaItem } from '../core/types/media';
import type { PlaybackState } from '../core/types/playback';
import { INITIAL_PLAYBACK_STATE } from '../core/types/playback';
import type { DiscoveryHistory, SavedDiscovery } from '../core/types/history';
import { EMPTY_HISTORY } from '../core/types/history';
import { loadCatalog, loadRemoteCatalog, shouldAdopt, type LoadedCatalog } from '../core/catalog/catalog';
import { REMOTE_CATALOG_URL } from '../core/platform/site';
import type { Collection } from '../core/catalog/collections';
import { buildDeck } from '../core/shuffle/engine';
import { constraintForItem, type ExplorationConstraint } from '../core/shuffle/constraint';
import { recordVisit, recentIds, applyOutcome, mergeHealth, type LocalHealthMap } from '../core/history/passport';
import { toggleSaved } from '../core/history/saved';
import { get, set, KEYS } from '../core/platform/storage';
import { track } from '../core/analytics/analytics';
import * as haptics from '../core/platform/haptics';
import FrontierPlayer, { assertNative, toPlayable } from '../player/frontierPlayer';

/**
 * The channel.
 *
 * This hook is the only place that knows how catalog, shuffle engine, native
 * transport and passport fit together. Screens read its state and call its
 * verbs; none of them touches the player or the engine directly.
 *
 * The rule that shapes everything here: a routine Shuffle must not touch the
 * network. The next item is loaded into the native queue the moment the
 * current one starts, so the tap is an advance on an already-buffering asset.
 */

const DECK_TARGET = 6;
/** Below this many seconds watched, leaving counts as "not for me". */
const EARLY_LEAVE_SECONDS = 5;

export interface TravelEvent {
  token: number;
  from: FrontierMediaItem | null;
  to: FrontierMediaItem | null;
}

export interface FrontierState {
  ready: boolean;
  error: string | null;
  catalog: LoadedCatalog | null;
  pool: FrontierMediaItem[];
  current: FrontierMediaItem | null;
  upcoming: FrontierMediaItem[];
  playback: PlaybackState;
  channel: FrontierChannel;
  constraint: ExplorationConstraint | null;
  history: DiscoveryHistory;
  saved: SavedDiscovery[];
  travel: TravelEvent | null;
  nativeWarning: string | null;
  starved: boolean;
}

export function useFrontier() {
  const [catalog, setCatalog] = useState<LoadedCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<FrontierMediaItem | null>(null);
  const [upcoming, setUpcoming] = useState<FrontierMediaItem[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>(INITIAL_PLAYBACK_STATE);
  const [channel, setChannelState] = useState<FrontierChannel>('everything');
  const [constraint, setConstraint] = useState<ExplorationConstraint | null>(null);
  const [history, setHistory] = useState<DiscoveryHistory>(EMPTY_HISTORY);
  const [saved, setSaved] = useState<SavedDiscovery[]>([]);
  const [travel, setTravel] = useState<TravelEvent | null>(null);
  const [nativeWarning, setNativeWarning] = useState<string | null>(null);
  const [starved, setStarved] = useState(false);
  const [localHealth, setLocalHealth] = useState<LocalHealthMap>({});

  // Refs hold everything the event handlers need without re-subscribing.
  const deckRef = useRef<FrontierMediaItem[]>([]);
  const sessionPlayedRef = useRef<string[]>([]);
  const currentRef = useRef<FrontierMediaItem | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const completedRef = useRef(false);
  const shuffleStartedRef = useRef<number | null>(null);
  const openedAtRef = useRef(Date.now());
  const firstFrameSentRef = useRef(false);
  const travelTokenRef = useRef(0);
  const catalogRef = useRef<LoadedCatalog | null>(null);
  const channelRef = useRef<FrontierChannel>('everything');
  const constraintRef = useRef<ExplorationConstraint | null>(null);
  const historyRef = useRef<DiscoveryHistory>(EMPTY_HISTORY);
  const healthRef = useRef<LocalHealthMap>({});
  /**
   * True while something else (Dive Replay) owns the transport. The channel's
   * event handlers stand down so a dive's segments are never mistaken for, or
   * replaced by, channel items.
   */
  const suspendedRef = useRef(false);

  const pool = useMemo(() => {
    if (!catalog) return [];
    return mergeHealth(catalog.eligible, localHealth);
  }, [catalog, localHealth]);
  const poolRef = useRef<FrontierMediaItem[]>([]);
  useEffect(() => { poolRef.current = pool; }, [pool]);

  // ---------------------------------------------------------------- deck

  const replenishDeck = useCallback(() => {
    const items = poolRef.current;
    if (items.length === 0) return;
    const next = buildDeck(items, {
      channel: channelRef.current,
      sessionPlayedIds: sessionPlayedRef.current,
      recentlyPlayedIds: recentIds(historyRef.current),
      lastItem: currentRef.current,
      constraint: constraintRef.current,
    }, DECK_TARGET);
    deckRef.current = next.filter((i) => i.id !== currentRef.current?.id);
    setUpcoming(deckRef.current.slice(0, 3));
  }, []);

  const takeNext = useCallback((): FrontierMediaItem | null => {
    if (deckRef.current.length <= 2) replenishDeck();
    const next = deckRef.current.shift() || null;
    setUpcoming(deckRef.current.slice(0, 3));
    return next;
  }, [replenishDeck]);

  /** Keep exactly one item prepared behind the current one. */
  const primeNext = useCallback(async () => {
    const next = deckRef.current[0];
    if (!next) { replenishDeck(); return; }
    const res = await FrontierPlayer.enqueue({ item: toPlayable(next) });
    if (res.queued) {
      deckRef.current.shift();
      setUpcoming(deckRef.current.slice(0, 3));
    }
  }, [replenishDeck]);

  // ------------------------------------------------------------- outcome

  const closeOutCurrent = useCallback((reason: 'shuffle' | 'ended' | 'jump' | 'failed') => {
    const item = currentRef.current;
    if (!item) return;
    const watched = positionRef.current;
    const duration = durationRef.current;
    const completed = reason === 'ended'
      || completedRef.current
      || (duration > 0 && watched >= duration - 1.5);

    setHistory((h) => {
      const next = recordVisit(h, item, { watchedSeconds: watched, completed });
      historyRef.current = next;
      void set(KEYS.HISTORY, next);
      return next;
    });
    setLocalHealth((m) => {
      const next = applyOutcome(m, item.id, { watchedSeconds: watched, completed, failed: reason === 'failed' });
      healthRef.current = next;
      void set(KEYS.HEALTH, next);
      return next;
    });

    if (reason === 'shuffle') {
      track('shuffle', {
        itemId: item.id,
        watchedSeconds: Math.round(watched),
        early: watched < EARLY_LEAVE_SECONDS,
        ms: shuffleStartedRef.current ? Date.now() - shuffleStartedRef.current : 0,
      });
    }
    if (reason === 'ended') track('auto_advance', { itemId: item.id });
    completedRef.current = false;
    positionRef.current = 0;
  }, []);

  // -------------------------------------------------------------- events

  useEffect(() => {
    let cancelled = false;
    const removers: Array<() => void> = [];

    const on = async (event: Parameters<typeof FrontierPlayer.addListener>[0], cb: (d: Record<string, unknown>) => void) => {
      const handle = await FrontierPlayer.addListener(event, cb);
      if (cancelled) { void handle.remove(); return; }
      removers.push(() => { void handle.remove(); });
    };

    const mirror = (d: Record<string, unknown>) => {
      setPlayback((prev) => {
        const next: PlaybackState = {
          status: (d.status as PlaybackState['status']) || prev.status,
          itemId: (d.itemId as string | null) ?? prev.itemId,
          positionSeconds: typeof d.positionSeconds === 'number' ? d.positionSeconds : prev.positionSeconds,
          durationSeconds: typeof d.durationSeconds === 'number' && d.durationSeconds > 0 ? d.durationSeconds : prev.durationSeconds,
          bufferedSeconds: typeof d.bufferedSeconds === 'number' ? d.bufferedSeconds : prev.bufferedSeconds,
          muted: typeof d.muted === 'boolean' ? d.muted : prev.muted,
          airPlayActive: typeof d.airPlayActive === 'boolean' ? d.airPlayActive : prev.airPlayActive,
          pipActive: typeof d.pipActive === 'boolean' ? d.pipActive : prev.pipActive,
          error: prev.error,
        };
        positionRef.current = next.positionSeconds;
        durationRef.current = next.durationSeconds;
        return next;
      });
    };

    void (async () => {
      await on('onTimeUpdate', mirror);
      await on('onStateChanged', mirror);
      await on('onPlaying', (d) => {
        mirror(d);
        setStarved(false);
        if (!firstFrameSentRef.current) {
          firstFrameSentRef.current = true;
          track('time_to_first_frame', { ms: Date.now() - openedAtRef.current });
        }
        if (!suspendedRef.current) track('playback_started', { itemId: currentRef.current?.id ?? '' });
      });
      await on('onPaused', mirror);
      await on('onReady', mirror);
      await on('onBuffering', (d) => { mirror(d); track('buffer_event', { itemId: currentRef.current?.id ?? '' }); });
      await on('onTransitioning', mirror);
      await on('onAirPlayChanged', (d) => {
        setPlayback((p) => ({ ...p, airPlayActive: !!d.active }));
        if (d.active) track('airplay_started');
      });
      await on('onPiPChanged', (d) => {
        setPlayback((p) => ({ ...p, pipActive: !!d.active }));
        if (d.active) track('pip_started');
      });
      await on('onEnded', () => { completedRef.current = true; });
      await on('onError', (d) => {
        track('playback_failure', { itemId: String(d.itemId ?? ''), message: String(d.message ?? '') });
      });
      await on('onRemoteCommand', (d) => {
        if (d.command === 'shuffle') shuffleStartedRef.current = Date.now();
      });

      // The transport moved on. Work out to what, close out the old item, and
      // prepare the next one. Nothing user-visible waits on this.
      await on('onItemChanged', (d) => {
        if (suspendedRef.current) return;
        const id = String(d.itemId ?? '');
        const items = poolRef.current;
        const next = items.find((i) => i.id === id) || null;
        if (!next || next.id === currentRef.current?.id) return;

        const from = currentRef.current;
        closeOutCurrent(completedRef.current ? 'ended' : 'shuffle');

        currentRef.current = next;
        setCurrent(next);
        sessionPlayedRef.current = [...sessionPlayedRef.current, next.id];
        positionRef.current = 0;
        durationRef.current = next.stream.durationSeconds ?? 0;

        travelTokenRef.current += 1;
        setTravel({ token: travelTokenRef.current, from, to: next });
        haptics.travel();

        void primeNext();
      });

      await on('onQueueStarved', () => {
        if (suspendedRef.current) return;
        // The queue emptied — usually the last prepared item finished while the
        // deck was rebuilding. Recover by loading a fresh item rather than
        // leaving a frozen frame on someone's television.
        setStarved(true);
        const next = takeNext();
        if (next) {
          currentRef.current = next;
          setCurrent(next);
          sessionPlayedRef.current = [...sessionPlayedRef.current, next.id];
          void FrontierPlayer.load({ item: toPlayable(next), autoplay: true }).then(() => primeNext());
        }
      });
    })();

    return () => { cancelled = true; removers.forEach((r) => r()); };
  }, [closeOutCurrent, primeNext, takeNext]);

  // ---------------------------------------------------------------- boot

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loaded, storedHistory, storedSaved, storedChannel, storedMuted, storedHealth] = await Promise.all([
          loadCatalog(),
          get<DiscoveryHistory>(KEYS.HISTORY),
          get<SavedDiscovery[]>(KEYS.SAVED),
          get<FrontierChannel>(KEYS.CHANNEL),
          get<boolean>(KEYS.MUTED),
          get<LocalHealthMap>(KEYS.HEALTH),
        ]);
        if (cancelled) return;

        if (storedHistory?.visits) { setHistory(storedHistory); historyRef.current = storedHistory; }
        if (Array.isArray(storedSaved)) setSaved(storedSaved);
        if (storedChannel) { setChannelState(storedChannel); channelRef.current = storedChannel; }
        if (storedHealth) { setLocalHealth(storedHealth); healthRef.current = storedHealth; }
        if (storedMuted) { setPlayback((p) => ({ ...p, muted: true })); void FrontierPlayer.setMuted({ muted: true }); }

        catalogRef.current = loaded;
        setCatalog(loaded);
        poolRef.current = mergeHealth(loaded.eligible, storedHealth || {});
        track('app_open', { catalogItems: loaded.eligible.length, generatedAt: loaded.generatedAt });

        const check = await assertNative();
        if (!check.ok) setNativeWarning(check.message || 'Native player unavailable');

        // New footage without an app update. The bundled catalog is already
        // playing; this only ever swaps in a newer, healthy one, and only the
        // pool changes - whatever is on screen keeps playing.
        const remote = await loadRemoteCatalog(REMOTE_CATALOG_URL);
        if (cancelled || !remote || !catalogRef.current || !shouldAdopt(catalogRef.current, remote)) return;
        catalogRef.current = remote;
        setCatalog(remote);
        poolRef.current = mergeHealth(remote.eligible, healthRef.current);
        track('catalog_refreshed', { items: remote.eligible.length, generatedAt: remote.generatedAt });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the catalog');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** First play. Separate from boot so onboarding can decide when it happens. */
  const start = useCallback(async () => {
    if (currentRef.current || poolRef.current.length === 0) return;
    replenishDeck();
    const first = takeNext();
    if (!first) { setError('No eligible content in the catalog'); return; }
    currentRef.current = first;
    setCurrent(first);
    sessionPlayedRef.current = [first.id];
    durationRef.current = first.stream.durationSeconds ?? 0;
    openedAtRef.current = Date.now();
    await FrontierPlayer.load({ item: toPlayable(first), autoplay: true });
    void primeNext();
  }, [primeNext, replenishDeck, takeNext]);

  // --------------------------------------------------------------- verbs

  const shuffle = useCallback(async () => {
    haptics.commit();
    shuffleStartedRef.current = Date.now();
    const res = await FrontierPlayer.skipToNext({ reason: 'user' });
    if (!res.advanced) {
      // Nothing was prepared. This is the slow path and it should be rare;
      // it exists so a starved queue is a beat of latency, not a dead screen.
      const next = takeNext();
      if (!next) return;
      const from = currentRef.current;
      closeOutCurrent('shuffle');
      currentRef.current = next;
      setCurrent(next);
      sessionPlayedRef.current = [...sessionPlayedRef.current, next.id];
      travelTokenRef.current += 1;
      setTravel({ token: travelTokenRef.current, from, to: next });
      await FrontierPlayer.load({ item: toPlayable(next), autoplay: true });
      void primeNext();
    }
  }, [closeOutCurrent, primeNext, takeNext]);

  const goTo = useCallback(async (itemId: string) => {
    const next = poolRef.current.find((i) => i.id === itemId);
    if (!next) return;
    haptics.commit();
    const from = currentRef.current;
    closeOutCurrent('jump');
    currentRef.current = next;
    setCurrent(next);
    sessionPlayedRef.current = [...sessionPlayedRef.current, next.id];
    durationRef.current = next.stream.durationSeconds ?? 0;
    travelTokenRef.current += 1;
    setTravel({ token: travelTokenRef.current, from, to: next });
    deckRef.current = [];
    await FrontierPlayer.load({ item: toPlayable(next), autoplay: true });
    replenishDeck();
    void primeNext();
  }, [closeOutCurrent, primeNext, replenishDeck]);

  const setChannel = useCallback((next: FrontierChannel) => {
    channelRef.current = next;
    setChannelState(next);
    void set(KEYS.CHANNEL, next);
    track('channel_changed', { channel: next });
    deckRef.current = [];
    void FrontierPlayer.clearQueue({ keepCurrent: true });
    replenishDeck();
    void primeNext();
  }, [primeNext, replenishDeck]);

  const keepExploringHere = useCallback(() => {
    const item = currentRef.current;
    if (!item) return;
    const next = constraintForItem(item);
    if (!next) return;
    constraintRef.current = next;
    setConstraint(next);
    track('keep_exploring_here', { kind: next.kind, value: next.value });
    deckRef.current = [];
    void FrontierPlayer.clearQueue({ keepCurrent: true });
    replenishDeck();
    void primeNext();
  }, [primeNext, replenishDeck]);

  /**
   * Step inside a collection: narrow the universe to exactly its members and
   * jump straight to one of them. It then plays like the channel does -
   * shuffled and continuous - and "Go Anywhere" leaves it, as it leaves any
   * other narrowing.
   */
  const exploreCollection = useCallback(async (collection: Collection) => {
    if (collection.itemIds.length === 0) return;
    const members = new Set(collection.itemIds);
    const next: ExplorationConstraint = { kind: 'collection', label: collection.title, value: collection.id, memberIds: members };
    constraintRef.current = next;
    setConstraint(next);
    track('collection_opened', { id: collection.id, size: collection.itemIds.length });
    const played = new Set(sessionPlayedRef.current);
    const candidates = poolRef.current.filter((i) => members.has(i.id));
    const fresh = candidates.filter((i) => !played.has(i.id));
    const choice = (fresh.length ? fresh : candidates)[Math.floor(Math.random() * (fresh.length || candidates.length))];
    if (choice) await goTo(choice.id);
  }, [goTo]);

  const goAnywhere = useCallback(() => {
    constraintRef.current = null;
    setConstraint(null);
    track('go_anywhere');
    deckRef.current = [];
    void FrontierPlayer.clearQueue({ keepCurrent: true });
    replenishDeck();
    void primeNext();
  }, [primeNext, replenishDeck]);

  const toggleSave = useCallback(() => {
    const item = currentRef.current;
    if (!item) return;
    haptics.tap();
    setSaved((list) => {
      const next = toggleSaved(list, item);
      void set(KEYS.SAVED, next);
      if (next.length > list.length) track('discovery_saved', { itemId: item.id });
      return next;
    });
  }, []);

  const removeSaved = useCallback((itemId: string) => {
    setSaved((list) => {
      const next = list.filter((s) => s.itemId !== itemId);
      void set(KEYS.SAVED, next);
      return next;
    });
  }, []);

  const togglePlay = useCallback(async () => {
    haptics.tap();
    if (playback.status === 'playing') await FrontierPlayer.pause();
    else await FrontierPlayer.play();
  }, [playback.status]);

  /** An explicit pause, for things that must not accidentally resume playback. */
  const pause = useCallback(async () => { await FrontierPlayer.pause(); }, []);

  const seekBy = useCallback(async (delta: number) => {
    haptics.tap();
    await FrontierPlayer.seek({ seconds: Math.max(0, positionRef.current + delta) });
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    await FrontierPlayer.seek({ seconds });
  }, []);

  const toggleMute = useCallback(async () => {
    const next = !playback.muted;
    await FrontierPlayer.setMuted({ muted: next });
    setPlayback((p) => ({ ...p, muted: next }));
    void set(KEYS.MUTED, next);
  }, [playback.muted]);

  /** Hand the transport to something else (Dive Replay). The item on screen is closed out. */
  const suspend = useCallback(async () => {
    if (suspendedRef.current) return;
    closeOutCurrent('jump');
    suspendedRef.current = true;
    deckRef.current = [];
    await FrontierPlayer.clearQueue({ keepCurrent: false });
  }, [closeOutCurrent]);

  /** Take the transport back and carry on with the channel where it left off. */
  const resume = useCallback(async () => {
    if (!suspendedRef.current) return;
    suspendedRef.current = false;
    const item = currentRef.current || takeNext();
    if (!item) return;
    currentRef.current = item;
    setCurrent(item);
    positionRef.current = 0;
    durationRef.current = item.stream.durationSeconds ?? 0;
    await FrontierPlayer.load({ item: toPlayable(item), autoplay: true });
    replenishDeck();
    void primeNext();
  }, [primeNext, replenishDeck, takeNext]);

  /**
   * Normally the tap never reaches here: Apple's picker sits over the button
   * and takes it. This is the path for VoiceOver and for a tap in the moment
   * before the picker was placed. False means iOS did not open the list.
   */
  const presentAirPlay = useCallback(async (): Promise<boolean> => {
    try {
      const { presented } = await FrontierPlayer.presentRoutePicker();
      track('airplay_opened', { presented });
      return presented;
    } catch {
      return false;
    }
  }, []);
  const enterPiP = useCallback(async () => { await FrontierPlayer.enterPiP(); }, []);

  const state: FrontierState = {
    ready: !!catalog,
    error,
    catalog,
    pool,
    current,
    upcoming,
    playback,
    channel,
    constraint,
    history,
    saved,
    travel,
    nativeWarning,
    starved,
  };

  return {
    state,
    start,
    shuffle,
    goTo,
    setChannel,
    keepExploringHere,
    exploreCollection,
    goAnywhere,
    toggleSave,
    removeSaved,
    togglePlay,
    pause,
    suspend,
    resume,
    seekBy,
    seekTo,
    toggleMute,
    presentAirPlay,
    enterPiP,
  };
}

export type FrontierApi = ReturnType<typeof useFrontier>;
