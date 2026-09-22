import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { DiveSighting } from '../../core/dives/types';
import type { ReplayState } from '../../state/useDiveReplay';
import { diveSubtitle, diveTitle, sightingLabel } from '../../core/dives/atlas';
import { currentSightings, formatClock, formatDepth, formatPosition, instrumentsAt, nextSighting } from '../../core/dives/telemetry';
import { setVideoInsets } from '../../player/frontierPlayer';
import { SITE_URL } from '../../core/platform/site';
import { DepthScrubber } from '../components/DepthScrubber';
import { Icon } from '../components/Icon';

/**
 * Dive Replay.
 *
 * The camera above, the vehicle's instruments on it, and the dive below as a
 * depth line you can move through. Everything runs on the dive's own clock:
 * the depth is the vehicle's depth at this second, the animal named is the one
 * the science team logged a moment ago, and tapping a sighting goes to it.
 */
export function DiveScreen({
  replay, onClose, onSeek, onTogglePlay,
}: {
  replay: ReplayState;
  onClose: () => void;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
}) {
  const { detail, time, hasVideo, playing, status } = replay;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);

  // The picture sits between the header and the panel, never under either.
  const report = useCallback(() => {
    if (!hasVideo) return;
    const top = headerRef.current?.getBoundingClientRect().bottom ?? 0;
    const panelTop = panelRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    setVideoInsets(top, Math.max(0, window.innerHeight - panelTop), false);
  }, [hasVideo]);
  useLayoutEffect(() => { report(); }, [report, detail?.id]);
  useEffect(() => {
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, [report]);
  useEffect(() => () => setVideoInsets(0, 0, false), []);

  const inst = useMemo(() => (detail ? instrumentsAt(detail.track, detail.sightings, time) : null), [detail, time]);
  const now = useMemo(() => (detail ? currentSightings(detail.sightings, time, 25).slice(-1)[0] : undefined), [detail, time]);
  const upcoming = useMemo(() => (detail ? nextSighting(detail.sightings, time) : null), [detail, time]);
  const photos = useMemo(() => new Map((detail?.photos || []).map((p) => [Math.round(p.t), p.url])), [detail]);
  const nowPhoto = now ? photos.get(Math.round(now.t)) : undefined;

  // Keep the sighting list scrolled to the present.
  const activeIndex = detail ? detail.sightings.findIndex((s) => s.t > time + 0.5) : -1;
  useEffect(() => {
    const el = listRef.current?.children[Math.max(0, activeIndex - 1)] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="dive dive--solid">
        <div className="dive__header" ref={headerRef}>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dive"><Icon name="chevron-left" /></button>
        </div>
        <p className="empty" style={{ marginTop: 'var(--space-7)' }}>Reading the dive log…</p>
      </div>
    );
  }

  if (status === 'error' || !detail || !inst) {
    return (
      <div className="dive dive--solid">
        <div className="dive__header" ref={headerRef}>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dive"><Icon name="chevron-left" /></button>
        </div>
        <p className="empty" style={{ marginTop: 'var(--space-7)' }}>This dive could not be loaded. Check the connection and try again.</p>
      </div>
    );
  }

  const position = formatPosition(inst.lat, inst.lon);
  const label = (s: DiveSighting) => sightingLabel(s);

  return (
    <div className={`dive${hasVideo ? '' : ' dive--solid'}`}>
      <div className="dive__header" ref={headerRef}>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dive"><Icon name="chevron-left" /></button>
        <div className="dive__heading">
          <div className="dive__title">{diveTitle(detail)}</div>
          <div className="dive__sub">{diveSubtitle(detail)}</div>
        </div>
      </div>

      <div className="dive__stage">
        {!hasVideo ? (
          <div
            className="dive__still"
            style={nowPhoto || detail.cover ? { backgroundImage: `url(${JSON.stringify(nowPhoto || detail.cover)})` } : undefined}
            role="img"
            aria-label={nowPhoto && now ? label(now).primary : diveTitle(detail)}
          />
        ) : null}
        <div className="dive__gauges" aria-live="off">
          <div className="gauge gauge--depth">
            <span className="gauge__value">{formatDepth(inst.depth)}</span>
            <span className="gauge__label">depth</span>
          </div>
          {inst.tempC !== null ? (
            <div className="gauge">
              <span className="gauge__value">{inst.tempC.toFixed(1)} °C</span>
              <span className="gauge__label">water</span>
            </div>
          ) : null}
          <div className="gauge">
            <span className="gauge__value">{formatClock(time)}</span>
            <span className="gauge__label">into the dive</span>
          </div>
        </div>
        {now ? (
          <div className="dive__now" role="status">
            <span className="dive__now-name">{label(now).primary}</span>
            {label(now).secondary ? <span className="dive__now-sci">{label(now).secondary}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="dive__panel" ref={panelRef}>
        <DepthScrubber detail={detail} time={time} onSeek={onSeek} />
        <div className="dive__controls">
          {hasVideo ? (
            <button type="button" className="transport__primary" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} size={24} />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!upcoming}
            onClick={() => upcoming && onSeek(Math.max(0, upcoming.t - 3))}
          >
            <Icon name="skip-next" size={16} />
            {upcoming ? ` Next: ${label(upcoming).primary}` : ' No more sightings'}
          </button>
        </div>
        {position ? <div className="dive__position">{position}</div> : null}
        {!hasVideo ? (
          <p className="dive__note">
            The camera footage for this dive is in NOAA&rsquo;s archive but not yet streaming in frontier go. Move along the dive to follow the vehicle and everything the scientists logged.
          </p>
        ) : null}

        <ol className="dive__sightings scroll-y" ref={listRef}>
          {detail.sightings.map((s, i) => {
            const { primary, secondary } = label(s);
            const past = s.t <= time + 0.5;
            const photo = photos.get(Math.round(s.t));
            return (
              <li key={`${s.t}-${i}`}>
                <button type="button" className={`sighting${past ? ' is-past' : ''}`} onClick={() => onSeek(Math.max(0, s.t - 3))}>
                  {photo ? <img className="sighting__thumb" src={photo} alt="" loading="lazy" /> : null}
                  <span className="sighting__text">
                    <span className="sighting__name">{primary}{secondary ? <i> {secondary}</i> : null}</span>
                    <span className="sighting__meta">{formatClock(s.t)}{s.depth ? ` · ${formatDepth(s.depth)}` : ''}{typeof s.tempC === 'number' ? ` · ${s.tempC.toFixed(1)} °C` : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {detail.sightings.length === 0 ? <li className="empty">No sightings were logged on this dive.</li> : null}
        </ol>

        <div className="dive__credit">
          {detail.source.credit}. <a href={`${SITE_URL}/dives/${detail.id.toLowerCase()}/`} target="_blank" rel="noreferrer noopener">This dive on the web</a>
        </div>
      </div>
    </div>
  );
}

export default DiveScreen;
