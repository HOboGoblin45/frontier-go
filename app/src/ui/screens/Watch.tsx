import { useEffect, useRef, useState } from 'react';
import type { FrontierMediaItem } from '../../core/types/media';
import type { PlaybackState } from '../../core/types/playback';
import { accuracyNote, locationHeadline } from '../../core/types/location';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { Icon } from '../components/Icon';
import { Scrubber } from '../components/Scrubber';

/**
 * Watch is the television.
 *
 * The footage is the screen. Chrome lives in two scrims that fade out after a
 * few idle seconds and come back on a tap, so the steady state is roughly nine
 * parts picture to one part interface. The eyebrow, title and place are the
 * only text that earns permanent space; everything else is one tap away.
 */

const IDLE_MS = 4200;

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
    default: return 'Somewhere else';
  }
}

export function Watch({
  item, playback, constraint, isSaved, ambient,
  onShuffle, onTogglePlay, onSeekBy, onSeek, onSave, onInfo, onAirPlay, onPiP, onExplore, onToggleAmbient,
}: {
  item: FrontierMediaItem | null;
  playback: PlaybackState;
  constraint: ExplorationConstraint | null;
  isSaved: boolean;
  ambient: boolean;
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

  if (!item) {
    return (
      <div className="watch" onPointerDown={wake}>
        <div />
        <div className="watch__bottom">
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
        <div className={idle ? 'watch__bottom' : 'watch__bottom'} style={{ opacity: idle ? 0 : 1, transition: 'opacity var(--dur-base)' }}>
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
        <span className="watch__nowplaying">{constraint ? `Exploring ${constraint.label}` : 'Now Playing'}</span>
        <button
          type="button"
          className={`icon-btn${playback.airPlayActive ? ' icon-btn--on' : ''}`}
          onClick={onAirPlay}
          aria-label="AirPlay"
        >
          <Icon name="airplay" />
        </button>
      </div>

      <div className="watch__bottom">
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
