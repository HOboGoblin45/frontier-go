import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useFrontier } from './state/useFrontier';
import { useDiveReplay } from './state/useDiveReplay';
import { parseDiveLink } from './core/dives/atlas';
import { DiveScreen } from './ui/screens/DiveScreen';
import { constraintForItem } from './core/shuffle/constraint';
import { isSaved as isSavedIn, shareable, parseDeepLink, resolveDiscovery } from './core/history/saved';
import { get, set, KEYS } from './core/platform/storage';
import { track } from './core/analytics/analytics';
import { TabBar, type TabKey } from './ui/components/TabBar';
import { TravelTransition, TravelAnnouncement } from './ui/components/TravelTransition';
import { InfoSheet } from './ui/components/InfoSheet';
import { KeepExploringCard } from './ui/components/KeepExploringCard';
import { ChannelSheet } from './ui/components/ChannelSheet';
import { SleepSheet, sleepLabel as formatSleep, type SleepChoice } from './ui/components/SleepSheet';
import { CHANNEL_LABELS, inChannel, type FrontierChannel } from './core/types/media';
import { Onboarding } from './ui/screens/Onboarding';
import { Watch } from './ui/screens/Watch';
import { GlobeScreen } from './ui/screens/GlobeScreen';
import { Passport } from './ui/screens/Passport';
import { Profile } from './ui/screens/Profile';
import { visitedPlaces } from './core/history/passport';
import { SITE_URL } from './core/platform/site';

const VERSION = (import.meta.env.VITE_APP_VERSION as string) || '0.0.0';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch { return undefined; }
  }, []);
  return reduced;
}

export default function App() {
  const frontier = useFrontier();
  const { state, start } = frontier;
  const reducedMotion = usePrefersReducedMotion();

  const [tab, setTab] = useState<TabKey>('watch');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleep, setSleep] = useState<{ kind: 'off' } | { kind: 'minutes'; endsAt: number } | { kind: 'clip'; itemId: string }>({ kind: 'off' });
  const [clock, setClock] = useState(() => Date.now());
  const [diveOpen, setDiveOpen] = useState(false);
  const replay = useDiveReplay(frontier);
  const openDive = useCallback((diveId: string, at?: number) => {
    setInfoOpen(false);
    setDiveOpen(true);
    void replay.open(diveId, at);
  }, [replay]);
  const closeDive = useCallback(() => {
    setDiveOpen(false);
    void replay.close();
  }, [replay]);

  useEffect(() => {
    void get<boolean>(KEYS.ONBOARDED).then((v) => setOnboarded(!!v));
    void get<boolean>(KEYS.AMBIENT).then((v) => setAmbient(!!v));
    document.body.dataset.native = String(Capacitor.isNativePlatform());
  }, []);

  // Once onboarding is behind us, the app opens straight into footage.
  const { ready, current } = state;
  useEffect(() => {
    if (onboarded && ready && !current && !starting) {
      setStarting(true);
      void start().finally(() => setStarting(false));
    }
  }, [onboarded, ready, current, starting, start]);

  // Deep links: frontiergo://discovery/<id>
  useEffect(() => {
    let handle: { remove: () => void } | null = null;
    void CapApp.addListener('appUrlOpen', ({ url }) => {
      const diveId = parseDiveLink(url, SITE_URL);
      if (diveId) { openDive(diveId); return; }
      const ref = parseDeepLink(url);
      const item = ref ? resolveDiscovery(frontier.state.pool, ref) : undefined;
      if (item) { setTab('watch'); void frontier.goTo(item.id); }
    }).then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, [frontier, openDive]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2200);
  }, []);

  const handleStart = useCallback(async () => {
    setStarting(true);
    await set(KEYS.ONBOARDED, true);
    setOnboarded(true);
    await start();
    setStarting(false);
  }, [start]);

  const handleShare = useCallback(async () => {
    const item = current;
    if (!item) return;
    const payload = shareable(item);
    track('discovery_shared', { itemId: item.id });
    try {
      await Share.share({ title: payload.title, text: payload.text, url: payload.url });
    } catch {
      // Share sheets get dismissed constantly; that is not an error worth
      // showing anyone. Fall back to the clipboard only when sharing is absent.
      try {
        await navigator.clipboard?.writeText(`${payload.text}\n${payload.url}`);
        showToast('Copied');
      } catch { /* nothing further to offer */ }
    }
  }, [current, showToast]);

  const handleShareApp = useCallback(async () => {
    track('discovery_shared', { itemId: 'app' });
    try {
      await Share.share({
        title: 'frontier go',
        text: 'Deep-sea dives, spacewalks, launches and Mars, playing continuously. Free, no account, no ads.',
        url: SITE_URL,
      });
    } catch { /* dismissed */ }
  }, []);

  const toggleAmbient = useCallback(() => {
    setAmbient((a) => {
      const next = !a;
      void set(KEYS.AMBIENT, next);
      return next;
    });
    setTab('watch');
  }, []);

  // ------------------------------------------------------------ sleep timer
  const { pause } = frontier;
  const fireSleep = useCallback(() => {
    setSleep({ kind: 'off' });
    void pause();
    track('sleep_timer_fired');
    showToast('Sleep timer ended');
  }, [pause, showToast]);

  useEffect(() => {
    if (sleep.kind !== 'minutes') return undefined;
    const tick = () => {
      const now = Date.now();
      if (now >= sleep.endsAt) fireSleep(); else setClock(now);
    };
    const t = window.setInterval(tick, 5000);
    return () => window.clearInterval(t);
  }, [sleep, fireSleep]);

  // "End of this clip": the channel advances on its own, so the moment the
  // clip on screen is no longer the one the timer was set on, stop.
  useEffect(() => {
    if (sleep.kind === 'clip' && current && current.id !== sleep.itemId) fireSleep();
  }, [sleep, current, fireSleep]);

  const chooseSleep = useCallback((choice: SleepChoice) => {
    if (choice.kind === 'off') { setSleep({ kind: 'off' }); showToast('Sleep timer off'); return; }
    if (choice.kind === 'clip') {
      if (!current) return;
      setSleep({ kind: 'clip', itemId: current.id });
      track('sleep_timer_set', { mode: 'clip' });
      showToast('Stopping at the end of this clip');
      return;
    }
    setSleep({ kind: 'minutes', endsAt: Date.now() + choice.minutes * 60_000 });
    setClock(Date.now());
    track('sleep_timer_set', { mode: 'minutes', minutes: choice.minutes });
    showToast(`Stopping in ${choice.minutes} min`);
  }, [current, showToast]);

  const sleepText = sleep.kind === 'off' ? null : formatSleep(sleep.kind === 'minutes' ? sleep.endsAt - clock : null, sleep.kind === 'clip');

  const channelCounts = useMemo(() => {
    const counts: Partial<Record<FrontierChannel, number>> = {};
    for (const c of ['deep_sea', 'space', 'wild_earth', 'field_science', 'archives'] as FrontierChannel[]) {
      counts[c] = state.pool.filter((i) => inChannel(i, c)).length;
    }
    counts.everything = state.pool.length;
    return counts;
  }, [state.pool]);

  const available = useMemo(() => (current ? constraintForItem(current) : null), [current]);
  const saved = current ? isSavedIn(state.saved, current.id) : false;
  const places = useMemo(() => visitedPlaces(state.history), [state.history]);

  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <>
        <Onboarding onStart={handleStart} busy={starting || !state.ready} />
        {state.error ? <div className="toast">{state.error}</div> : null}
      </>
    );
  }

  if (diveOpen) {
    return (
      <>
        <DiveScreen
          replay={replay.state}
          onClose={closeDive}
          onSeek={(t) => { void replay.seek(t); }}
          onTogglePlay={() => { void replay.togglePlay(); }}
        />
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    );
  }

  return (
    <>
      {tab === 'watch' ? (
        <Watch
          item={state.current}
          playback={state.playback}
          constraint={state.constraint}
          channelLabel={state.channel === 'everything' ? null : CHANNEL_LABELS[state.channel]}
          sleepLabel={sleepText}
          isSaved={saved}
          ambient={ambient}
          onChannels={() => setChannelsOpen(true)}
          onSleep={() => setSleepOpen(true)}
          onShuffle={frontier.shuffle}
          onTogglePlay={frontier.togglePlay}
          onSeekBy={frontier.seekBy}
          onSeek={frontier.seekTo}
          onSave={() => { frontier.toggleSave(); showToast(saved ? 'Removed' : 'Saved'); }}
          onInfo={() => { setInfoOpen(true); track('info_opened'); }}
          onAirPlay={frontier.presentAirPlay}
          onPiP={frontier.enterPiP}
          onExplore={() => setExploreOpen(true)}
          onToggleAmbient={toggleAmbient}
        />
      ) : null}

      {tab === 'globe' ? (
        <GlobeScreen
          pool={state.pool}
          current={state.current}
          visited={places}
          reducedMotion={reducedMotion}
          active={tab === 'globe'}
          constraint={state.constraint}
          onOpenDive={(id) => { track('dives_opened'); openDive(id); }}
          onOpenCollection={(c) => {
            setTab('watch');
            void frontier.exploreCollection(c);
            showToast(`Exploring ${c.title}`);
          }}
          onGoTo={(id) => {
            track('globe_location_selected', { itemId: id });
            setTab('watch');
            void frontier.goTo(id);
          }}
        />
      ) : null}

      {tab === 'saved' ? (
        <Passport
          saved={state.saved}
          history={state.history}
          pool={state.pool}
          onOpen={(id) => { setTab('watch'); void frontier.goTo(id); }}
          onRemove={frontier.removeSaved}
        />
      ) : null}

      {tab === 'profile' ? (
        <Profile
          catalog={state.catalog}
          ambient={ambient}
          version={VERSION}
          onToggleAmbient={toggleAmbient}
          onShareApp={handleShareApp}
        />
      ) : null}

      {!ambient ? (
        <TabBar
          active={tab}
          onChange={(next) => {
            setTab(next);
            if (next === 'globe') track('globe_opened');
          }}
        />
      ) : null}

      <TravelTransition
        token={state.travel?.token ?? 0}
        to={state.travel?.to ?? null}
        reducedMotion={reducedMotion}
      />
      <TravelAnnouncement to={state.current} />

      <InfoSheet
        item={state.current}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onShare={handleShare}
        onOpenDive={(id) => openDive(id)}
      />

      <ChannelSheet
        open={channelsOpen}
        channel={state.channel}
        constraint={state.constraint}
        counts={channelCounts}
        onChannel={(c) => { frontier.setChannel(c); showToast(c === 'everything' ? 'Everything' : CHANNEL_LABELS[c]); }}
        onGoAnywhere={() => { frontier.goAnywhere(); showToast('Going anywhere'); }}
        onClose={() => setChannelsOpen(false)}
      />

      <SleepSheet
        open={sleepOpen}
        activeLabel={sleepText}
        onChoose={chooseSleep}
        onClose={() => setSleepOpen(false)}
      />

      <KeepExploringCard
        item={state.current}
        constraint={state.constraint}
        available={available}
        open={exploreOpen}
        onKeep={() => { frontier.keepExploringHere(); setExploreOpen(false); showToast('Staying here'); }}
        onAnywhere={() => { frontier.goAnywhere(); setExploreOpen(false); showToast('Going anywhere'); }}
        onClose={() => setExploreOpen(false)}
      />

      {state.nativeWarning ? <div className="toast">{state.nativeWarning}</div> : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {state.error ? <div className="toast">{state.error}</div> : null}
    </>
  );
}
