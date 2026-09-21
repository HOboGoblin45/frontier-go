import type { FrontierMediaItem } from '../../core/types/media';
import type { ExplorationConstraint } from '../../core/shuffle/constraint';
import { locationHeadline } from '../../core/types/location';
import { Icon } from './Icon';

/**
 * "Keep Exploring Here" and its way out.
 *
 * Two buttons, no filter interface. Narrowing the universe should feel like
 * choosing to stay somewhere, and widening it again should be one tap from
 * anywhere — which is why "Go Anywhere" is on this card rather than buried in
 * a settings screen.
 */
export function KeepExploringCard({
  item, constraint, available, open, onKeep, onAnywhere, onClose,
}: {
  item: FrontierMediaItem | null;
  constraint: ExplorationConstraint | null;
  available: ExplorationConstraint | null;
  open: boolean;
  onKeep: () => void;
  onAnywhere: () => void;
  onClose: () => void;
}) {
  if (!open || !item) return null;

  const poster = item.imagery.posterUrl || item.imagery.thumbnailUrl;
  const place = item.location?.displayName || item.location?.regionName || item.source.organization;

  return (
    <div
      className="explore-card"
      style={poster ? { backgroundImage: `var(--scrim-heavy), url(${JSON.stringify(poster)})` } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Keep exploring here"
    >
      <button type="button" className="icon-btn explore-card__close" onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>

      <div className="eyebrow">{constraint ? 'You are exploring' : 'This place'}</div>
      <h2 className="display" style={{ fontSize: 'var(--step-3)', marginTop: 'var(--space-2)' }}>{place}</h2>
      <div className="watch__place" style={{ marginTop: 'var(--space-2)' }}>
        <Icon name="pin" size={15} />
        <span>{locationHeadline(item.location)}</span>
      </div>
      {item.source.expedition || item.source.mission ? (
        <p className="meta muted" style={{ marginTop: 'var(--space-3)' }}>
          {item.source.expedition || item.source.mission}
        </p>
      ) : null}

      <div className="explore-card__actions">
        {constraint ? (
          <button type="button" className="btn btn--primary btn--block" onClick={onAnywhere}>
            <Icon name="globe" size={18} /> Go Anywhere
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={onKeep}
            disabled={!available}
          >
            Keep Exploring Here <Icon name="arrow-right" size={18} />
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--block" onClick={constraint ? onClose : onAnywhere}>
          {constraint ? 'Stay here' : 'Go Anywhere'}
        </button>
      </div>

      {!available && !constraint ? (
        <p className="meta muted" style={{ marginTop: 'var(--space-3)', textAlign: 'center' }}>
          This clip has no expedition or region recorded, so there is nowhere narrower to stay.
        </p>
      ) : null}
    </div>
  );
}

export default KeepExploringCard;
