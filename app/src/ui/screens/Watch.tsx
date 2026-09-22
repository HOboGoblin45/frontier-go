import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FrontierMediaItem } from '../../core/types/media';
import type { PlaybackState } from '../../core/types/playback';
import { accuracyNote, locationHeadline } from '../../core/types/location';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { Icon } from '../components/Icon';
import { Scrubber } from '../components/Scrubber';
import { setVideoInsets } from '../../player/frontierPlayer';

/**
 * Watch is the television.
 *
 * The footage is the screen. Chrome lives in two scrims that fade out after a
 * few idle seconds and come back on a tap, so the steady state is roughly nine
 * parts picture to one part interface. The eyebrow, title and place are the
 * only text that earns permanent space; everything else is one tap away.
 *
 * The scrims and the picture share a plane, and the player centres the frame in
 * whatever rect it is given. Left alone, a 16:9 clip on an upright phone lands
 * exactly under the text block - the title was sitting on the footage, and on
 * NOAA material directly over the expedition card burned into the opening
 * seconds. So this screen measures its own chrome and hands the numbers to the
 * player: picture above, reading matter below, never both in one place. When
 * the chrome fades the insets go to zero and the picture takes the whole
 * screen, which is the point of idling in the first place.
 */

const IDLE_MS = 4200;

/**
 * How much of the picture plane the interface is covering, in CSS pixels.
 *
 * Measured from the chrome block's TOP EDGE to the bottom of the viewport, not
 * from the block's own height. The picture plane is the whole window; the tab
 * bar sits below the block and is painted over that same plane. Subtracting the
 * block alone leaves the frame overlapping the tab bar by exactly the bar's
 * height, which is the kind of near-miss that looks like a rounding error and
 * is not one.
 *
 * Idle chrome covers nothing: the picture takes the screen, which is the point
 * of idling.
 */
export function chromeInset(
  rect: { top: number } | null | undefined,
  viewportHeight: number,
  idle: boolean,
): number {
  if (idle || !rect) return 0;
  return Math.max(0, viewportHeight - rect.top);
}

function eyebrowFor(item: FrontierMediaItem): string {
  switch (item.environment) {
    case 'deep_ocean': return 'Into the deep';
    case 'shallow_ocean': return 'Coastal waters';
    case 'surface_vessel': return 'On station';
    case 'polar': return 'At the poles';
    case 'volcanic': return 'Where the earth opens';
    case 'orbit': return 'From orbit';
    case 'lunar': return 'On the Moon';
    case 'martian': return 'On Mars';
    case 'deep_space': return 'Further out';
    case 'wilderness': return 'Wild earth';
    case 'laboratory': return 'Under test';
    case 'launch_site': return 'On the pad';
    default: return 'Somewhere else';
  }
}

export function Watch({
  item, playback, constraint, channelLabel, sleepLabel, isSaved, ambient,
  onShuffle, onTogglePlay, onSeekBy, onSeek, onSave, onInfo, onAirPlay, onPiP, onExplore, onToggleAmbient,
  onChannels, onSleep,
}: {
  item: FrontierMediaItem | null;
  playback: PlaybackState;
  constraint: ExplorationConstraint | null;
  /** The channel's name, or null for Everything. */
  channelLabel: string | null;
  /** Remaining sleep time, or null when no timer is set. */
  sleepLabel: string | null;
  isSaved: boolean;
  ambient: boolean;
  onChannels: () => void;
  onSleep: () => void;
  onShuffle: () => void;
  onTogglePlay: () => void;
  onSeekBy: (delta: number) => void;
  onSeek: (seconds: number) => void;
  onSave: () => void;
  onInfo: () => void;
  onAirPlay: () => void;
  onPiP: () => void;
  onExplore: () => void;
  onToggleAmbient: () => void;
}) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const wake = () => {
    setIdle(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  };

  useEffect(() => {
    wake();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // Re-arm whenever the item or transport changes.
  }, [item?.id, playback.status]);

  /**
   * Measure, do not guess. The block's height depends on how long the title
   * wraps, whether there is an accuracy note, how tall the safe area is and
   * which way the phone is held - none of which is knowable from here.
   *
   * The top scrim is a light wash rather than a panel, so the picture is only
   * dimmed under it, not hidden; insetting for it too would shrink the frame
   * for no gain. Only the bottom block is subtracted.
   */
  const report = useCallback((animated: boolean) => {
    const rect = bottomRef.current?.getBoundingClientRect();
    setVideoInsets(0, chromeInset(rect, window.innerHeight, idle), animated);
  }, [idle]);

  useLayoutEffect(() => { report(true); }, [report, item?.id]);

  useLayoutEffect(() => {
    const el = bottomRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    // A title that rewraps changes the height without changing any prop.
    const observer = new ResizeObserver(() => report(false));
    observer.observe(el);
    return () => observer.disconnect();
  }, [report]);

  useEffect(() => {
    const onResize = () => report(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [report]);

  // The picture belongs to the app, not to this screen: leaving Watch must not
  // leave the frame squeezed into the top half behind whatever comes next.
  useEffect(() => () => setVideoInsets(0, 0, false), []);

  if (!item) {
    return (
      <div className="watch" onPointerDown={wake}>
        <div />
        <div className="watch__bottom" ref={bottomRef}>
          <div className="eyebrow">Frontier</div>
          <h1 className="display watch__title">Finding somewhere to go</h1>
        </div>
      </div>
    );
  }

  const playing = playback.status === 'playing';
  const note = accuracyNote(item.location);

  if (ambient) {
    return (
      <div className="ambient" onPointerDown={wake}>
        <div className="ambient__mark">
          <div className="wordmark" style={{ fontSize: 'var(--step-3)', textAlign: 'center' }}>
            frontier <span>go</span>
          </div>
          <div className="ambient__tag">Real places. A wilder you.</div>
        </div>
        <div className="watch__bottom" ref={bottomRef} style={{ opacity: idle ? 0 : 1, transition: 'opacity var(--dur-base)' }}>
          <div className="eyebrow">{item.location?.displayName || item.source.organization}</div>
          <h1 className="display watch__title" style={{ fontSize: 'var(--step-2)' }}>{item.title}</h1>
          <Scrubber
            position={playback.positionSeconds}
            duration={playback.durationSeconds}
            buffered={playback.bufferedSeconds || 0}
            onSeek={onSeek}
          />
          <div className="transport">
            <button type="button" className="icon-btn" onClick={() => onSeekBy(-10)} aria-label="Back 10 seconds">
              <Icon name="back-10" size={26} />
            </button>
            <button type="button" className="transport__primary" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} size={26} />
            </button>
            <button type="button" className="icon-btn" onClick={() => onSeekBy(10)} aria-label="Forward 10 seconds">
              <Icon name="forward-10" size={26} />
            </button>
          </div>
          <button type="button" className="btn btn--quiet btn--block" onClick={onToggleAmbient}>
            Leave ambient mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`watch${idle ? ' is-idle' : ''}`} onPointerDown={wake}>
      <div className="watch__top">
        <button type="button" className="icon-btn" onClick={onToggleAmbient} aria-label="Ambient mode">
          <Icon name="chevron-down" />
        </button>
        <button
          type="button"
          className="watch__nowplaying-btn"
          onClick={onChannels}
          aria-label={`${constraint ? `Exploring ${constraint.label}` : channelLabel || 'Now Playing'}. Choose a channel`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {constraint ? `Exploring ${constraint.label}` : channelLabel || 'Now Playing'}
          </span>
          <Icon name="chevron-down" size={14} />
        </button>
        <div className="watch__top-actions">
          <button
            type="button"
            className={`icon-btn${sleepLabel ? ' icon-btn--on icon-btn--wide' : ''}`}
            onClick={onSleep}
            aria-label={sleepLabel ? `Sleep timer, ${sleepLabel} left` : 'Sleep timer'}
          >
            <Icon name="moon" size={20} />
            {sleepLabel ? <span className="watch__sleep-label">{sleepLabel}</span> : null}
          </button>
          <button
            type="button"
            className={`icon-btn${playback.airPlayActive ? ' icon-btn--on' : ''}`}
            onClick={onAirPlay}
            aria-label="AirPlay"
          >
            <Icon name="airplay" />
          </button>
        </div>
      </div>

      <div className="watch__bottom" ref={bottomRef}>
        <div className="eyebrow watch__eyebrow">{eyebrowFor(item)}</div>
        <h1 className="display watch__title">{item.title}</h1>

        <button
          type="button"
          onClick={onExplore}
          className="watch__place"
          style={{ background: 'none', textAlign: 'left' }}
        >
          <Icon name="pin" size={15} />
          <span>{locationHeadline(item.location)}</span>
          <Icon name="chevron-right" size={14} />
        </button>
        {note ? <div className="watch__accuracy">{note}</div> : null}
        {item.description ? <p className="watch__desc">{item.description}</p> : null}

        <Scrubber
          position={playback.positionSeconds}
          duration={playback.durationSeconds}
          buffered={playback.bufferedSeconds || 0}
          onSeek={onSeek}
        />

        <div className="transport">
          <button type="button" className="icon-btn" onClick={() => onSeekBy(-10)} aria-label="Back 10 seconds">
            <Icon name="back-10" size={26} />
          </button>
          <button type="button" className="transport__primary" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={26} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onSeekBy(10)} aria-label="Forward 10 seconds">
            <Icon name="forward-10" size={26} />
          </button>
        </div>

        <div className="watch__actions">
          <button type="button" className="icon-btn" onClick={onInfo} aria-label="About this discovery">
            <Icon name="info" size={20} />
          </button>
          <button type="button" className="btn shuffle" onClick={onShuffle}>
            <Icon name="shuffle" size={18} /> Shuffle
          </button>
          <button
            type="button"
            className={`icon-btn${isSaved ? ' icon-btn--on' : ''}`}
            onClick={onSave}
            aria-label={isSaved ? 'Saved' : 'Save this discovery'}
            aria-pressed={isSaved}
          >
            <Icon name={isSaved ? 'bookmark-filled' : 'bookmark'} size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          <button type="button" className="icon-btn" onClick={onPiP} aria-label="Picture in Picture">
            <Icon name="pip" size={18} />
          </button>
          {item.captionsUrl ? (
            <span className="icon-btn" aria-hidden="true" title="Captions available"><Icon name="captions" size={18} /></span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Watch;
