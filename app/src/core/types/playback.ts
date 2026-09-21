/**
 * One authoritative playback state model. The native layer owns the truth and
 * emits transitions; React mirrors them and never computes its own.
 */

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'transitioning'
  | 'ended'
  | 'failed';

export interface PlaybackState {
  status: PlaybackStatus;
  /** Frontier item id of whatever the player currently holds. */
  itemId: string | null;
  positionSeconds: number;
  durationSeconds: number;
  /** Seconds of media buffered ahead of the playhead. */
  bufferedSeconds?: number;
  muted: boolean;
  airPlayActive: boolean;
  pipActive: boolean;
  /** Last error message, cleared on the next successful load. */
  error?: string | null;
}

export const INITIAL_PLAYBACK_STATE: PlaybackState = Object.freeze({
  status: 'idle',
  itemId: null,
  positionSeconds: 0,
  durationSeconds: 0,
  bufferedSeconds: 0,
  muted: false,
  airPlayActive: false,
  pipActive: false,
  error: null,
});

/** Statuses in which the transport is actively showing this item. */
export function isActive(status: PlaybackStatus): boolean {
  return status === 'playing' || status === 'paused' || status === 'buffering' || status === 'ready';
}

/** A spinner is only honest during these. */
export function isWaiting(status: PlaybackStatus): boolean {
  return status === 'loading' || status === 'buffering' || status === 'transitioning';
}
