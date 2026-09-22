import { Icon } from './Icon';

export type SleepChoice = { kind: 'off' } | { kind: 'minutes'; minutes: number } | { kind: 'clip' };

const OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '90 min' },
];

export function sleepLabel(remainingMs: number | null, clipMode: boolean): string | null {
  if (clipMode) return 'End of clip';
  if (remainingMs == null) return null;
  const m = Math.max(1, Math.ceil(remainingMs / 60000));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

/**
 * A sleep timer, because the most common way to watch the deep sea for an
 * hour is to be falling asleep to it. When it runs out the picture pauses
 * where it is; nothing fades to an ad, nothing asks a question.
 */
export function SleepSheet({
  open, activeLabel, onChoose, onClose,
}: {
  open: boolean;
  activeLabel: string | null;
  onChoose: (choice: SleepChoice) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const pick = (c: SleepChoice) => { onChoose(c); onClose(); };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Sleep timer" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <div className="eyebrow">Sleep timer</div>
            <h2 className="display" style={{ fontSize: 'var(--step-2)', marginTop: 6 }}>
              {activeLabel ? `Stopping in ${activeLabel}` : 'Stop playing after'}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet__body">
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {OPTIONS.map((o) => (
              <button key={o.minutes} type="button" className="chip" onClick={() => pick({ kind: 'minutes', minutes: o.minutes })}>
                {o.label}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => pick({ kind: 'clip' })}>End of this clip</button>
          </div>
          {activeLabel ? (
            <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 'var(--space-5)' }} onClick={() => pick({ kind: 'off' })}>
              Turn off the timer
            </button>
          ) : (
            <p className="meta muted" style={{ marginTop: 'var(--space-4)' }}>
              Playback pauses where it is. Pair it with Ambient mode for a screen that shows nothing but the picture.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default SleepSheet;
