import { useMemo, useState } from 'react';
import type { DiscoveryHistory, SavedDiscovery } from '../../core/types/history';
import type { FrontierMediaItem } from '../../core/types/media';
import { passportTotals, visitedPlaces } from '../../core/history/passport';
import { Icon } from '../components/Icon';

/**
 * Saved and the Discovery Passport.
 *
 * A record, not a scoreboard. Three numbers, because they are facts about
 * where someone has been — no points, no levels, no streak to protect. The
 * fastest way to ruin a product whose whole proposition is calm is to give
 * someone something to keep up.
 */

type Tab = 'saved' | 'visited';

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Passport({
  saved, history, pool, onOpen, onRemove,
}: {
  saved: SavedDiscovery[];
  history: DiscoveryHistory;
  pool: FrontierMediaItem[];
  onOpen: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('saved');
  const totals = useMemo(() => passportTotals(history, saved.length), [history, saved.length]);
  const places = useMemo(() => visitedPlaces(history), [history]);
  const byId = useMemo(() => new Map(pool.map((i) => [i.id, i])), [pool]);

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">My Discovery Passport</h1>
      </header>

      <div className="segmented" role="tablist" aria-label="Passport sections">
        <button type="button" role="tab" className="segmented__item" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>
          Saved
        </button>
        <button type="button" role="tab" className="segmented__item" aria-selected={tab === 'visited'} onClick={() => setTab('visited')}>
          Visited
        </button>
      </div>

      <div className="screen__body scroll-y" style={{ padding: 'var(--space-4) var(--gutter) var(--space-6)' }}>
        <div className="passport-stats" style={{ marginBottom: 'var(--space-5)' }}>
          <p className="passport-stats__lead">A more connected you</p>
          <div>
            <div className="passport-stats__value">{totals.placesVisited}</div>
            <div className="passport-stats__label">Places visited</div>
          </div>
          <div>
            <div className="passport-stats__value">{totals.saved}</div>
            <div className="passport-stats__label">Saved</div>
          </div>
          <div>
            <div className="passport-stats__value">{totals.discoveries}</div>
            <div className="passport-stats__label">Discoveries</div>
          </div>
        </div>

        {tab === 'saved' ? (
          saved.length === 0 ? (
            <p className="empty">
              Nothing saved yet. Tap the bookmark while something is playing and it will keep.
            </p>
          ) : (
            <div className="row-list" role="list">
              {saved.map((s) => {
                const playable = byId.has(s.itemId);
                return (
                  <div className="row" key={s.itemId} role="listitem">
                    {s.thumbnailUrl
                      ? <img className="row__thumb" src={s.thumbnailUrl} alt="" loading="lazy" />
                      : <span className="row__thumb" aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => playable && onOpen(s.itemId)}
                      disabled={!playable}
                      style={{ textAlign: 'left', background: 'none' }}
                    >
                      <span className="row__title">{s.title}</span>
                      <span className="row__sub" style={{ display: 'block' }}>
                        {s.placeLabel}
                        {playable ? '' : ' · no longer in the catalog'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onRemove(s.itemId)}
                      aria-label={`Remove ${s.title} from saved`}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : places.length === 0 ? (
          <p className="empty">Nowhere yet. Places appear here once you have been.</p>
        ) : (
          <div className="row-list" role="list">
            {places.map((p) => (
              <div className="row" key={p.key} role="listitem">
                <span className="row__thumb" aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
                  <Icon name="pin" size={18} />
                </span>
                <span>
                  <span className="row__title">{p.displayName}</span>
                  <span className="row__sub" style={{ display: 'block' }}>
                    Visited {p.visits} {p.visits === 1 ? 'time' : 'times'} &middot; last {relativeDate(p.lastVisitedAt)}
                  </span>
                </span>
                <span />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Passport;
