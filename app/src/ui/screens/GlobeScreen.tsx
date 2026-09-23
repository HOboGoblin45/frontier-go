import { useMemo, useState } from 'react';
import type { FrontierMediaItem } from '../../core/types/media';
import type { VisitedPlace } from '../../core/types/history';
import { globePoints, offEarthGroups } from '../../core/catalog/catalog';
import { buildCollections, type Collection } from '../../core/catalog/collections';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { FrontierGlobe, type GlobeMarker } from '../globe/FrontierGlobe';
import { CollectionsList } from '../components/CollectionsList';
import { DivesList } from '../components/DivesList';
import { thumbnailFor } from '../../core/catalog/artwork';
import { Icon } from '../components/Icon';
import { GLOBE_FILTERS, itemsNear, matchesGlobeFilter, placeMatches, type GlobeFilter } from '../../core/catalog/nearby';
import { SUBJECT_LABELS } from '../../core/types/subjects';

export type { GlobeFilter };

/** How many clips the place panel lists before "Play all here" takes over. */
const PLACE_LIST_LIMIT = 40;

/**
 * The globe replaces the browse page.
 *
 * It is not a catalog: there are no rows, no covers, no genres. It shows where
 * there is something to see, where this person has already been, and where
 * they are right now — and every marker has exactly one action, which is to go
 * there. The filter is a row of kinds of thing (animals, plants, landmarks,
 * history) because the viewer is exploring, not running a query. Choosing a
 * place lists what there is to see there and nearby - the location-first way
 * to find footage - with one button to play all of it.
 */

type ExploreView = 'globe' | 'collections' | 'dives';

export function GlobeScreen({
  pool, current, visited, reducedMotion, active, constraint, onGoTo, onOpenCollection, onOpenDive,
}: {
  pool: FrontierMediaItem[];
  current: FrontierMediaItem | null;
  visited: VisitedPlace[];
  reducedMotion: boolean;
  active: boolean;
  constraint: ExplorationConstraint | null;
  onGoTo: (itemId: string) => void;
  onOpenCollection: (c: Collection) => void;
  onOpenDive: (diveId: string) => void;
}) {
  const [view, setView] = useState<ExploreView>('globe');
  const collections = useMemo(() => buildCollections(pool), [pool]);
  const [filter, setFilter] = useState<GlobeFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; token: number } | null>(null);

  const filtered = useMemo(() => pool.filter((i) => matchesGlobeFilter(i, filter)), [pool, filter]);
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
    const byId = new Map(filtered.map((i) => [i.id, i]));
    return points
      .filter((p) => placeMatches(q, p, p.itemIds.map((id) => byId.get(id)).filter((i): i is FrontierMediaItem => !!i)))
      .slice(0, 12);
  }, [points, query, filtered]);

  const selectedPoint = points.find((p) => p.key === selected) || null;
  const here = useMemo(() => (selectedPoint
    ? itemsNear(filtered, selectedPoint)
    : []), [filtered, selectedPoint]);
  const playHere = () => {
    if (!selectedPoint || here.length === 0) return;
    onOpenCollection({
      id: `place:${selectedPoint.key}:${filter}`,
      kind: 'site',
      title: selectedPoint.displayName,
      subtitle: `${here.length} ${here.length === 1 ? 'clip' : 'clips'} here and nearby`,
      itemIds: here.map((h) => h.item.id),
      totalSeconds: here.reduce((sum, h) => sum + (h.item.stream.durationSeconds || 0), 0),
    });
  };

  const goToPoint = (key: string) => {
    const point = points.find((p) => p.key === key);
    if (!point) return;
    setSelected(key);
    setFocus({ latitude: point.latitude, longitude: point.longitude, token: Date.now() });
  };

  const tabs = (
    <div className="segmented" role="tablist" aria-label="Explore by">
      <button type="button" role="tab" className="segmented__item" aria-selected={view === 'globe'} onClick={() => setView('globe')}>
        Globe
      </button>
      <button type="button" role="tab" className="segmented__item" aria-selected={view === 'collections'} onClick={() => { setView('collections'); setSearching(false); }}>
        Collections{collections.length ? ` \u00b7 ${collections.length}` : ''}
      </button>
      <button type="button" role="tab" className="segmented__item" aria-selected={view === 'dives'} onClick={() => { setView('dives'); setSearching(false); }}>
        Dives
      </button>
    </div>
  );

  if (view === 'dives') {
    return (
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">Explore</h1>
        </header>
        {tabs}
        <div className="screen__body" style={{ padding: 'var(--space-4) var(--gutter) 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DivesList onOpen={onOpenDive} />
        </div>
      </div>
    );
  }

  if (view === 'collections') {
    return (
      <div className="screen">
        <header className="screen__header">
          <h1 className="screen__title">Explore</h1>
        </header>
        {tabs}
        <div className="screen__body" style={{ padding: 'var(--space-4) var(--gutter) 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CollectionsList collections={collections} constraint={constraint} onOpen={onOpenCollection} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Explore</h1>
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
      {tabs}
      <div style={{ height: 'var(--space-3)' }} />

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
            {GLOBE_FILTERS.map((f) => (
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
        ) : selectedPoint && here.length > 0 ? (
          <div className="globe__list panel" style={{ padding: 'var(--space-2)', display: 'flex', flexDirection: 'column' }}>
            <div className="globe__place-head">
              <span>
                <span className="row__title">{selectedPoint.displayName}</span>
                <span className="row__sub" style={{ display: 'block' }}>
                  {here.length} {here.length === 1 ? 'clip' : 'clips'} here and nearby
                </span>
              </span>
              <button type="button" className="btn btn--primary btn--small" onClick={playHere}>
                <Icon name="play" size={16} /> Play all
              </button>
              <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close this place">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="row-list scroll-y" style={{ minHeight: 0 }}>
              {here.slice(0, PLACE_LIST_LIMIT).map(({ item, distanceKm }) => (
                <button key={item.id} type="button" className="row" onClick={() => onGoTo(item.id)}>
                  {thumbnailFor(item)
                    ? <img className="row__thumb" src={thumbnailFor(item)} alt="" loading="lazy" />
                    : <span className="row__thumb" aria-hidden="true" />}
                  <span>
                    <span className="row__title">{item.title}</span>
                    <span className="row__sub" style={{ display: 'block' }}>
                      {[
                        item.subjects?.[0] ? SUBJECT_LABELS[item.subjects[0]] : null,
                        item.source.organization,
                        distanceKm >= 1 ? `${Math.round(distanceKm)} km away` : null,
                      ].filter(Boolean).join(' \u00b7 ')}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              ))}
            </div>
          </div>
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
