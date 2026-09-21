import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useFrontier } from './state/useFrontier';
import { constraintForItem } from './core/shuffle/constraint';
import { isSaved as isSavedIn, shareable, parseDeepLink } from './core/history/saved';
import { get, set, KEYS } from './core/platform/storage';
import { track } from './core/analytics/analytics';
import { TabBar, type TabKey } from './ui/components/TabBar';
import { TravelTransition, TravelAnnouncement } from './ui/components/TravelTransition';
import { InfoSheet } from './ui/components/InfoSheet';
import { KeepExploringCard } from './ui/components/KeepExploringCard';
import { Onboarding } from './ui/screens/Onboarding';
import { Watch } from './ui/screens/Watch';
import { GlobeScreen } from './ui/screens/GlobeScreen';
import { Passport } from './ui/screens/Passport';
import { Profile } from './ui/screens/Profile';
import { visitedPlaces } from './core/history/passport';

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
      const id = parseDeepLink(url);
      if (id) { setTab('watch'); void frontier.goTo(id); }
    }).then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, [frontier]);

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

  const toggleAmbient = useCallback(() => {
    setAmbient((a) => {
      const next = !a;
      void set(KEYS.AMBIENT, next);
      return next;
    });
    setTab('watch');
  }, []);

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

  return (
    <>
      {tab === 'watch' ? (
        <Watch
          item={state.current}
          playback={state.playback}
          constraint={state.constraint}
          isSaved={saved}
          ambient={ambient}
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
          channel={state.channel}
          ambient={ambient}
          version={VERSION}
          onChannel={frontier.setChannel}
          onToggleAmbient={toggleAmbient}
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
