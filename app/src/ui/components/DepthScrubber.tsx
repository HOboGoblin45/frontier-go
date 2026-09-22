import { useMemo, useRef } from 'react';
import type { DiveDetail } from '../../core/dives/types';
import { formatClock, formatDepth, instrumentsAt } from '../../core/dives/telemetry';

/**
 * The dive's depth over time, as the way to move through it.
 *
 * Drag or tap anywhere to go to that moment. Every logged sighting is a dot on
 * the line where it happened, so the interesting stretches of an eight-hour
 * dive are visible at a glance - the long descent is empty, the bottom is
 * crowded.
 */
export function DepthScrubber({
  detail, time, onSeek, height = 120,
}: {
  detail: DiveDetail;
  time: number;
  onSeek: (t: number) => void;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);
  const W = 1000;
  const H = height * 4;
  const tMax = Math.max(1, detail.track.t[detail.track.t.length - 1] ?? 1);
  const dMax = Math.max(50, ...detail.track.depth) * 1.08;
  const x = (t: number) => (t / tMax) * W;
  const y = (m: number) => 8 + (m / dMax) * (H - 16);

  const { line, area, dots } = useMemo(() => {
    let p = '';
    detail.track.t.forEach((t, i) => { p += `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(detail.track.depth[i]).toFixed(1)}`; });
    const a = `${p}L${W},${y(0)}L0,${y(0)}Z`;
    const d = detail.sightings.map((s) => ({
      key: `${s.t}-${s.taxon || s.group}`,
      cx: x(s.t),
      cy: y(s.depth ?? instrumentsAt(detail.track, [], s.t).depth),
    }));
    return { line: p, area: a, dots: d };
    // The drawing depends only on the dive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const toTime = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * tMax;
  };

  const cursor = x(Math.max(0, Math.min(tMax, time)));
  const depthNow = instrumentsAt(detail.track, [], time).depth;

  return (
    <svg
      ref={ref}
      className="depth-scrubber"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height }}
      role="slider"
      aria-label="Dive time"
      aria-valuemin={0}
      aria-valuemax={Math.round(tMax)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${formatClock(time)} into the dive, ${formatDepth(depthNow)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek(time + 60);
        if (e.key === 'ArrowLeft') onSeek(time - 60);
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (dragging.current) onSeek(toTime(e.clientX));
        dragging.current = false;
      }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <path d={area} className="depth-scrubber__area" />
      <path d={line} className="depth-scrubber__line" vectorEffect="non-scaling-stroke" />
      {dots.map((d) => <circle key={d.key} cx={d.cx} cy={d.cy} r={7} className="depth-scrubber__dot" />)}
      <line x1={cursor} x2={cursor} y1={0} y2={H} className="depth-scrubber__cursor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default DepthScrubber;
