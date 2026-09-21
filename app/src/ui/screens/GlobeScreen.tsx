import { useMemo, useState } from 'react';
import type { FrontierMediaItem } from '../../core/types/media';
import type { VisitedPlace } from '../../core/types/history';
import { globePoints, offEarthGroups } from '../../core/catalog/catalog';
import { FrontierGlobe, type GlobeMarker } from '../globe/FrontierGlobe';
import { Icon } from '../components/Icon';

/**
 * The globe replaces the browse page.
 *
 * It is not a catalog: there are no rows, no covers, no genres. It shows where
 * there is something to see, where this person has already been, and where
 * they are right now — and every marker has exactly one action, which is to go
 * there. The filter is four words wide because the viewer is exploring, not
 * running a query.
 */

export type GlobeFilter = 'all' | 'ocean' | 'earth' | 'space' | 'archive';

const FILTERS: Array<{ key: GlobeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'earth', label: 'Earth' },
  { key: 'space', label: 'Space' },
  { key: 'archive', label: 'Archive' },
];

function matchesFilter(item: FrontierMediaItem, filter: GlobeFilter): boolean {
  switch (filter) {
    case 'ocean': return item.channel === 'deep_sea' || item.environment === 'deep_ocean' || item.environment === 'shallow_ocean';
    case 'earth': return item.channel === 'wild_earth' || ['polar', 'volcanic', 'wilderness', 'surface_vessel', 'laboratory'].includes(item.environment);
    case 'space': return item.channel === 'space' || ['orbit', 'lunar', 'martian', 'deep_space'].includes(item.environment);
    case 'archive': return item.channel === 'archives' || (item.channels?.includes('archives') ?? false);
    default: return true;
  }
}

export function GlobeScreen({
  pool, current, visited, reducedMotion, active, onGoTo,
}: {
  pool: FrontierMediaItem[];
  current: FrontierMediaItem | null;
  visited: VisitedPlace[];
  reducedMotion: boolean;
  active: boolean;
  onGoTo: (itemId: string) => void;
}) {
  const [filter, setFilter] = useState<GlobeFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; token: number } | null>(null);

  const filtered = useMemo(() => pool.filter((i) => matchesFilter(i, filter)), [pool, filter]);
  const points = useMemo(() => globePoints(filtered), [filtered]);
  const beyond = useMemo(() => offEarthGroups(filtered), [filtered]);

  const visitedKeys = useMemo(() => new Set(visited.map((v) => v.key)), [visited]);

  const markers: GlobeMarker[] = useMemo(() => points.map((p) => ({
    key: p.key,
    latitude: p.latitude,
    longitude: p.longitude,
    displayName: p.displayName,
    count: p.count,
    visited: visitedKeys.has(p.key),
  })), [points, visitedKeys]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return points.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [points, query]);

  const selectedPoint = points.find((p) => p.key === selected) || null;
  const selectedItem = selectedPoint
    ? filtered.find((i) => i.id === selectedPoint.itemIds[0]) || null
    : null;

  const goToPoint = (key: string) => {
    const point = points.find((p) => p.key === key);
    if (!point) return;
    setSelected(key);
    setFocus({ latitude: point.latitude, longitude: point.longitude, token: Date.now() });
  };

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Explore the World</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={() => { setSearching((s) => !s); setQuery(''); }}
          aria-label={searching ? 'Close place search' : 'Find a place'}
          aria-expanded={searching}
        >
          <Icon name={searching ? 'close' : 'search'} />
        </button>
      </header>

      <div style={{ padding: '0 var(--gutter) var(--space-3)' }}>
        {searching ? (
          <input
            autoFocus
            className="chip"
            style={{ width: '100%', height: 40, paddingInline: 'var(--space-4)', color: 'var(--text-primary)' }}
            placeholder="Find a place"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find a place on the globe"
          />
        ) : (
          <div className="chips scroll-x" role="group" aria-label="Filter the globe">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="chip"
                aria-pressed={filter === f.key}
                onClick={() => { setFilter(f.key); setSelected(null); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="globe">
        <FrontierGlobe
          markers={markers}
          selectedKey={selected}
          focus={focus}
          reducedMotion={reducedMotion}
          active={active && !searching}
          onSelect={setSelected}
        />

        {searching ? (
          <div className="globe__list panel scroll-y" style={{ padding: 'var(--space-2)' }}>
            {searchResults.length === 0 ? (
              <p className="empty">{query ? 'No place by that name.' : 'Type a place name.'}</p>
            ) : (
              <div className="row-list">
                {searchResults.map((p) => (
                  <button key={p.key} type="button" className="row" onClick={() => { setSearching(false); goToPoint(p.key); }}>
                    <span className="row__thumb" aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
                      <Icon name="pin" size={18} />
                    </span>
                    <span>
                      <span className="row__title">{p.displayName}</span>
                      <span className="row__sub" style={{ display: 'block' }}>
                        {p.count} {p.count === 1 ? 'discovery' : 'discoveries'}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={18} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : selectedPoint && selectedItem ? (
          <button
            type="button"
            className="globe__pick"
            onClick={() => onGoTo(selectedItem.id)}
          >
            {selectedItem.imagery.thumbnailUrl
              ? <img src={selectedItem.imagery.thumbnailUrl} alt="" loading="lazy" />
              : <span className="row__thumb" aria-hidden="true" />}
            <span>
              <span className="row__title">{selectedPoint.displayName}</span>
              <span className="row__sub" style={{ display: 'block' }}>
                {selectedItem.source.organization} &middot; {selectedPoint.count} {selectedPoint.count === 1 ? 'discovery' : 'discoveries'}
              </span>
              <span className="row__sub" style={{ display: 'block', marginTop: 4, color: 'var(--accent-primary)' }}>
                Go here
              </span>
            </span>
            <Icon name="chevron-right" size={20} />
          </button>
        ) : (
          <p className="globe__hint">
            {markers.length} {markers.length === 1 ? 'place' : 'places'} on this globe
            {beyond.length > 0 ? ` · ${beyond.length} beyond Earth` : ''}
          </p>
        )}
      </div>

      {/*
        The non-drag path. A globe you must rotate is unusable with VoiceOver,
        with a switch control, or one-handed on a train — so the same places
        are always reachable as a list.
      */}
      {!searching && current ? (
        <div style={{ padding: '0 var(--gutter) var(--space-3)' }}>
          <button type="button" className="btn btn--quiet btn--block" onClick={() => setSearching(true)}>
            Browse places as a list
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default GlobeScreen;
