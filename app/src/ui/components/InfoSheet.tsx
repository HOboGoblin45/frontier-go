import type { FrontierMediaItem } from '../../core/types/media';
import { accuracyNote, locationHeadline } from '../../core/types/location';
import { rightsLabel } from '../../core/types/rights';
import { Icon } from './Icon';

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (<><dt>{label}</dt><dd>{value}</dd></>);
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function coordinates(item: FrontierMediaItem): string | undefined {
  const l = item.location;
  if (!l || typeof l.latitude !== 'number' || typeof l.longitude !== 'number') return undefined;
  const ns = l.latitude >= 0 ? 'N' : 'S';
  const ew = l.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(l.latitude).toFixed(2)}° ${ns}, ${Math.abs(l.longitude).toFixed(2)}° ${ew}`;
}

/**
 * The information sheet. Everything the catalog knows, including the parts
 * that are uncertain — the accuracy qualifier and the coordinate basis are
 * shown rather than hidden, because a region reference point presented as a
 * position is the one thing this product must never do.
 */
export function InfoSheet({
  item, open, onClose, onShare, onOpenDive,
}: {
  item: FrontierMediaItem | null;
  open: boolean;
  onClose: () => void;
  onShare: () => void;
  /** Present when the clip is tied to a whole dive in the dive log. */
  onOpenDive?: (diveId: string) => void;
}) {
  if (!open || !item) return null;
  const l = item.location;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`About ${item.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <div className="eyebrow">{item.source.organization}</div>
            <h2 className="display" style={{ fontSize: 'var(--step-2)', marginTop: 6 }}>{item.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="sheet__body scroll-y">
          {item.description ? (
            <p className="meta" style={{ marginBottom: 'var(--space-5)' }}>{item.description}</p>
          ) : null}

          <dl className="def">
            <Row label="Location" value={locationHeadline(l)} />
            <Row label="Certainty" value={accuracyNote(l) || 'Surveyed position'} />
            <Row label="Coordinates" value={coordinates(item)} />
            <Row label="Coordinate basis" value={l?.coordinateSource} />
            <Row label="Depth" value={l?.depthMeters ? `${Math.round(l.depthMeters).toLocaleString('en-US')} m below sea level` : undefined} />
            <Row label="Altitude" value={l?.altitudeMeters ? `${Math.round(l.altitudeMeters / 1000).toLocaleString('en-US')} km` : undefined} />
            <Row label="Captured" value={formatDate(item.temporal.capturedAt)} />
            <Row label="Expedition" value={item.source.expedition} />
            <Row label="Mission" value={item.source.mission} />
            <Row label="Vessel" value={item.source.vessel} />
            <Row label="Organization" value={item.source.organization} />
            <Row label="Rights" value={rightsLabel(item.rights)} />
            <Row label="Credit" value={item.rights.attributionText} />
            <Row label="Tags" value={item.tags.length ? item.tags.join(', ') : undefined} />
          </dl>

          <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
            {item.source.diveId && onOpenDive ? (
              <button type="button" className="btn btn--block" onClick={() => onOpenDive(item.source.diveId!)}>
                <Icon name="dive" size={18} /> The whole dive this came from
              </button>
            ) : null}
            <button type="button" className="btn btn--secondary btn--block" onClick={onShare}>
              <Icon name="share" size={18} /> Share this discovery
            </button>
            {item.source.assetUrl ? (
              <a
                className="btn btn--quiet btn--block"
                href={item.source.assetUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                View at {item.source.organization}
              </a>
            ) : null}
            {item.rights.sourceRightsUrl ? (
              <a
                className="meta muted"
                style={{ textAlign: 'center', textDecoration: 'none' }}
                href={item.rights.sourceRightsUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Usage terms
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default InfoSheet;
