export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * The progress line. It is a real control — a range input sits invisibly over
 * the track so it is draggable and reachable by VoiceOver — but it reads as a
 * hairline, because a chunky scrubber on top of footage is the fastest way to
 * make a window look like a media player.
 */
export function Scrubber({
  position, duration, buffered, onSeek,
}: {
  position: number;
  duration: number;
  buffered: number;
  onSeek: (seconds: number) => void;
}) {
  const safeDuration = duration > 0 ? duration : 0;
  const pct = safeDuration > 0 ? Math.min(100, (position / safeDuration) * 100) : 0;
  const bufPct = safeDuration > 0 ? Math.min(100, ((position + buffered) / safeDuration) * 100) : 0;

  return (
    <div className="scrubber">
      <div className="scrubber__track" style={{ position: 'relative' }}>
        <div className="scrubber__buffer" style={{ width: `${bufPct}%` }} />
        <div className="scrubber__fill" style={{ width: `${pct}%` }} />
        <input
          className="scrubber__input"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(safeDuration))}
          step={1}
          value={Math.floor(position)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Playback position"
          aria-valuetext={`${formatClock(position)} of ${formatClock(safeDuration)}`}
        />
      </div>
      <div className="scrubber__times">
        <span>{formatClock(position)}</span>
        <span>{formatClock(safeDuration)}</span>
      </div>
    </div>
  );
}

export default Scrubber;
