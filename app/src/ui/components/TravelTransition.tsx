import { useEffect, useState } from 'react';
import type { FrontierMediaItem } from '../../core/types/media';
import { accuracyNote, locationHeadline } from '../../core/types/location';

/**
 * Shuffle as transportation.
 *
 * A veil rises over the picture, the destination is named, and it falls again
 * on the next place. It is short by design — about a second — because the
 * point is to make the jump feel like distance, not to make anyone wait for an
 * animation. The next asset is already buffering underneath, so this is
 * covering a handover, not a load.
 *
 * With Reduce Motion on, the same information arrives as a brief fade and a
 * label. Nothing moves; nothing is lost.
 */
export function TravelTransition({
  token, to, reducedMotion,
}: {
  token: number;
  to: FrontierMediaItem | null;
  reducedMotion: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!to) return undefined;
    setVisible(true);
    const ms = reducedMotion ? 320 : 1150;
    const timer = window.setTimeout(() => setVisible(false), ms);
    return () => window.clearTimeout(timer);
  }, [token, to, reducedMotion]);

  if (!visible || !to) return null;

  const place = to.location?.displayName || to.location?.regionName;
  const note = accuracyNote(to.location);

  return (
    <div className="travel" aria-hidden="true" key={token}>
      <div className="travel__label">
        <div className="eyebrow">Travelling to</div>
        <div className="travel__place">{place || to.source.organization}</div>
        <div className="meta muted" style={{ marginTop: 'var(--space-2)' }}>
          {locationHeadline(to.location)}
          {note ? ` · ${note}` : ''}
        </div>
      </div>
    </div>
  );
}

/** Live-region announcement of the same change, for VoiceOver. */
export function TravelAnnouncement({ to }: { to: FrontierMediaItem | null }) {
  if (!to) return null;
  return (
    <div className="visually-hidden" role="status" aria-live="polite">
      {`Now playing ${to.title}. ${locationHeadline(to.location)}. Source ${to.source.organization}.`}
    </div>
  );
}

export default TravelTransition;
