import type { Collection } from '../../core/catalog/collections';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { Icon } from './Icon';

/**
 * Collections, as a list you can scroll with a thumb.
 *
 * Posters are the agencies' own published frames. Everything else is text,
 * because the list is a doorway, not a gallery - one tap and the footage is
 * playing.
 */
export function CollectionsList({
  collections, constraint, onOpen,
}: {
  collections: Collection[];
  constraint: ExplorationConstraint | null;
  onOpen: (c: Collection) => void;
}) {
  if (collections.length === 0) {
    return <p className="empty">Collections appear once the catalog has loaded.</p>;
  }

  const sections: Array<{ key: string; label: string; items: Collection[] }> = [
    { key: 'new', label: 'Just arrived', items: collections.filter((c) => c.kind === 'new') },
    { key: 'subject', label: 'Subjects', items: collections.filter((c) => c.kind === 'subject') },
    { key: 'expedition', label: 'Whole expeditions', items: collections.filter((c) => c.kind === 'expedition') },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="collections scroll-y">
      {sections.map((section) => (
        <section key={section.key} style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="eyebrow" style={{ margin: '0 0 var(--space-3)' }}>{section.label}</h2>
          <div className="row-list">
            {section.items.map((c) => {
              const active = constraint?.kind === 'collection' && constraint.value === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="row"
                  onClick={() => onOpen(c)}
                  aria-label={`${c.title}. ${c.subtitle}${active ? '. Playing now' : ''}`}
                  style={active ? { borderColor: 'var(--accent-primary)' } : undefined}
                >
                  {c.posterUrl
                    ? <img className="row__thumb" src={c.posterUrl} alt="" loading="lazy" />
                    : <span className="row__thumb" aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}><Icon name="stack" size={18} /></span>}
                  <span>
                    <span className="row__title">{c.title}</span>
                    <span className="row__sub" style={{ display: 'block' }}>{c.subtitle}</span>
                    {active ? <span className="row__sub" style={{ display: 'block', color: 'var(--accent-primary)', marginTop: 2 }}>Playing now</span> : null}
                  </span>
                  <Icon name="play" size={18} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="meta muted" style={{ textAlign: 'center', padding: '0 var(--space-4) var(--space-6)' }}>
        A collection plays like the channel does, shuffled and continuous. Go Anywhere from the player leaves it.
      </p>
    </div>
  );
}

export default CollectionsList;
