import type { FrontierChannel } from '../../core/types/media';
import { ALL_CHANNELS, CHANNEL_LABELS } from '../../core/types/media';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { Icon } from './Icon';

const CHANNEL_NOTES: Partial<Record<FrontierChannel, string>> = {
  everything: 'All of it, as far apart as possible',
  deep_sea: 'ROV dives, vents, seamounts, animals',
  space: 'Orbit, the Moon, Mars and further',
  wild_earth: 'Wildlife, plants, landscapes, national parks',
  field_science: 'Engines, aircraft, labs and fieldwork',
  archives: 'Historic sites, early film, Apollo',
};

/**
 * Where Shuffle can take you, one tap from the player.
 *
 * Channels used to live at the top of the Profile screen, which is the one
 * place nobody looks while something is playing. Choosing a channel is a
 * viewing decision, so it belongs on the viewing screen. The sheet also shows
 * any narrowing currently in force - a collection, an expedition - with the
 * single way out of it.
 */
export function ChannelSheet({
  open, channel, constraint, counts, onChannel, onGoAnywhere, onClose,
}: {
  open: boolean;
  channel: FrontierChannel;
  constraint: ExplorationConstraint | null;
  counts: Partial<Record<FrontierChannel, number>>;
  onChannel: (c: FrontierChannel) => void;
  onGoAnywhere: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const channels = ALL_CHANNELS.filter((c) => c !== 'live' && (c === 'everything' || (counts[c] ?? 0) > 0));

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Choose a channel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <div className="eyebrow">Channel</div>
            <h2 className="display" style={{ fontSize: 'var(--step-2)', marginTop: 6 }}>Where Shuffle can take you</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="sheet__body scroll-y">
          {constraint ? (
            <div className="panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <p className="meta muted" style={{ margin: 0 }}>You are exploring</p>
              <p style={{ margin: '4px 0 var(--space-3)', fontSize: 'var(--step-1)' }}>{constraint.label}</p>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => { onGoAnywhere(); onClose(); }}>
                <Icon name="globe" size={18} /> Go Anywhere
              </button>
            </div>
          ) : null}

          <div className="row-list" role="radiogroup" aria-label="Channels">
            {channels.map((c) => {
              const selected = channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="row"
                  style={{ gridTemplateColumns: '1fr auto', borderColor: selected ? 'var(--accent-primary)' : undefined }}
                  onClick={() => { onChannel(c); onClose(); }}
                >
                  <span>
                    <span className="row__title">{CHANNEL_LABELS[c]}</span>
                    <span className="row__sub" style={{ display: 'block' }}>
                      {CHANNEL_NOTES[c]}{counts[c] ? ` · ${counts[c]} clips` : ''}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: selected ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: 'var(--step--1)' }}>
                    {selected ? 'Playing' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default ChannelSheet;
