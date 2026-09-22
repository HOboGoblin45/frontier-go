import { useEffect, useMemo, useState } from 'react';
import type { DiveSummary } from '../../core/dives/types';
import { loadDiveIndex } from '../../core/dives/remote';
import { diveTitle } from '../../core/dives/atlas';
import { Icon } from './Icon';

type Sort = 'recent' | 'deepest' | 'life';

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'life', label: 'Most life' },
  { key: 'deepest', label: 'Deepest' },
  { key: 'recent', label: 'Recent' },
];

export function sortDives(dives: readonly DiveSummary[], sort: Sort): DiveSummary[] {
  const list = [...dives];
  if (sort === 'deepest') list.sort((a, b) => b.maxDepthMeters - a.maxDepthMeters);
  else if (sort === 'life') list.sort((a, b) => b.sightingCount - a.sightingCount || b.maxDepthMeters - a.maxDepthMeters);
  else list.sort((a, b) => b.date.localeCompare(a.date) || b.dive - a.dive);
  // Dives that can be replayed with their footage come first in every order.
  return [...list.filter((d) => d.replay), ...list.filter((d) => !d.replay)];
}

/**
 * Every Okeanos Explorer ROV dive, as a list. One tap opens the dive: its
 * depth, its position and everything the scientists logged, on one clock.
 */
export function DivesList({ onOpen }: { onOpen: (diveId: string) => void }) {
  const [dives, setDives] = useState<DiveSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<Sort>('life');

  useEffect(() => {
    let live = true;
    void loadDiveIndex().then((index) => {
      if (!live) return;
      if (index) setDives(index.dives); else setFailed(true);
    });
    return () => { live = false; };
  }, []);

  const sorted = useMemo(() => (dives ? sortDives(dives, sort).slice(0, 200) : []), [dives, sort]);

  if (failed) return <p className="empty">The dive log needs a connection. Try again in a moment.</p>;
  if (!dives) return <p className="empty">Reading the dive log…</p>;

  const hours = Math.round(dives.reduce((s, d) => s + d.videoSeconds, 0) / 3600);
  const sightings = dives.reduce((s, d) => s + d.sightingCount, 0);

  return (
    <div className="collections scroll-y">
      <p className="meta" style={{ margin: '0 0 var(--space-4)' }}>
        {dives.length.toLocaleString('en-US')} deep-sea dives by NOAA Ship Okeanos Explorer, {hours.toLocaleString('en-US')} hours of camera footage and {sightings.toLocaleString('en-US')} logged sightings, each placed where and when it happened.
      </p>
      <div className="chips" role="group" aria-label="Order dives by" style={{ marginBottom: 'var(--space-4)' }}>
        {SORTS.map((s) => (
          <button key={s.key} type="button" className="chip" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="row-list">
        {sorted.map((d) => (
          <button
            key={d.id}
            type="button"
            className="row"
            onClick={() => onOpen(d.id)}
            aria-label={`${diveTitle(d)}. ${Math.round(d.maxDepthMeters)} metres, ${d.sightingCount} sightings${d.replay ? ', replay available' : ''}`}
          >
            {d.cover
              ? <img className="row__thumb" src={d.cover} alt="" loading="lazy" />
              : <span className="row__thumb" aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}><Icon name="dive" size={18} /></span>}
            <span>
              <span className="row__title">{diveTitle(d)}</span>
              <span className="row__sub" style={{ display: 'block' }}>
                {Math.round(d.maxDepthMeters).toLocaleString('en-US')} m · {d.date.slice(0, 4)}{d.sightingCount ? ` · ${d.sightingCount} sightings` : ''}
              </span>
              {d.replay ? <span className="row__sub" style={{ display: 'block', color: 'var(--accent-primary)', marginTop: 2 }}>Replay with footage</span> : null}
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default DivesList;
