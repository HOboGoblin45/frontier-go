/**
 * Product-quality telemetry.
 *
 * Deliberately narrow: how fast the first frame arrives, how fast a shuffle
 * feels, which assets fail, which assets everyone leaves. No device
 * identifiers, no location, no profiling, no social graph — the privacy
 * disclosure in the App Store listing has to be true, and the cheapest way to
 * make it true is to not collect the things it says we do not collect.
 *
 * Events buffer on device. A sink can be attached later; nothing here assumes
 * one exists, and the app behaves identically with none.
 */

export type AnalyticsEvent =
  | 'app_open' | 'time_to_first_frame' | 'playback_started' | 'shuffle'
  | 'auto_advance' | 'keep_exploring_here' | 'go_anywhere' | 'globe_opened'
  | 'globe_location_selected' | 'discovery_saved' | 'discovery_shared'
  | 'info_opened' | 'airplay_started' | 'pip_started' | 'playback_failure'
  | 'buffer_event' | 'channel_changed' | 'session_end' | 'catalog_refreshed'
  | 'collection_opened' | 'sleep_timer_set' | 'sleep_timer_fired';

export interface AnalyticsRecord {
  event: AnalyticsEvent;
  at: number;
  props?: Record<string, string | number | boolean | null>;
}

type Sink = (record: AnalyticsRecord) => void;

const MAX_BUFFER = 400;
let buffer: AnalyticsRecord[] = [];
let sink: Sink | null = null;
const sessionStart = Date.now();

export function setAnalyticsSink(next: Sink | null) { sink = next; }

export function track(event: AnalyticsEvent, props?: AnalyticsRecord['props']) {
  const record: AnalyticsRecord = { event, at: Date.now(), props };
  buffer.push(record);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  try { sink?.(record); } catch { /* telemetry must never break playback */ }
}

/** Percentile over a numeric prop, used by the on-device diagnostics screen. */
export function percentile(event: AnalyticsEvent, prop: string, p: number): number | null {
  const values = buffer
    .filter((r) => r.event === event && typeof r.props?.[prop] === 'number')
    .map((r) => r.props![prop] as number)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const idx = Math.min(values.length - 1, Math.max(0, Math.round((p / 100) * (values.length - 1))));
  return values[idx];
}

export function sessionSummary() {
  const count = (e: AnalyticsEvent) => buffer.filter((r) => r.event === e).length;
  const shuffles = count('shuffle');
  const plays = count('playback_started');
  return {
    sessionSeconds: Math.round((Date.now() - sessionStart) / 1000),
    itemsPlayed: plays,
    shuffles,
    autoAdvances: count('auto_advance'),
    failures: count('playback_failure'),
    bufferEvents: count('buffer_event'),
    firstFrameP50: percentile('time_to_first_frame', 'ms', 50),
    firstFrameP95: percentile('time_to_first_frame', 'ms', 95),
    shuffleP50: percentile('shuffle', 'ms', 50),
    shuffleP95: percentile('shuffle', 'ms', 95),
    earlyShuffleRate: plays > 0 ? Number((buffer.filter((r) => r.event === 'shuffle' && (r.props?.watchedSeconds as number ?? 99) < 5).length / plays).toFixed(3)) : 0,
  };
}

export function drain(): AnalyticsRecord[] {
  const out = buffer;
  buffer = [];
  return out;
}

export function snapshot(): AnalyticsRecord[] { return [...buffer]; }
