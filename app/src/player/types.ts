import type { PlaybackState } from '../core/types/playback';

/** The shape the native side expects for one playable item. */
export interface PlayableItem {
  id: string;
  url: string;
  title: string;
  place: string;
  organization: string;
  artworkUrl?: string;
  durationSeconds?: number;
}

export interface PlayerDiagnostics {
  native: boolean;
  attached?: boolean;
  /**
   * False means the web view is painting over the player layer: sound plays,
   * picture does not, and Picture in Picture is the only way to see anything.
   * It is the single most diagnostic line in the app.
   */
  webViewTransparent?: boolean;
  pipSupported?: boolean;
  audioSessionCategory?: string;
  implementation: 'native-avfoundation' | 'web-video-element';
}

export type PlayerEvent =
  | 'onLoading' | 'onReady' | 'onPlaying' | 'onPaused' | 'onBuffering'
  | 'onEnded' | 'onError' | 'onItemChanged' | 'onItemReady' | 'onTransitioning'
  | 'onRouteChanged' | 'onAirPlayChanged' | 'onPiPChanged' | 'onVideoSurfaceChanged'
  | 'onTimeUpdate' | 'onStateChanged' | 'onQueueStarved' | 'onRemoteCommand';

export interface FrontierPlayerPlugin {
  load(options: { item: PlayableItem; autoplay?: boolean }): Promise<{ loaded: boolean; itemId: string }>;
  enqueue(options: { item: PlayableItem }): Promise<{ queued: boolean; itemId?: string }>;
  play(): Promise<{ playing: boolean }>;
  pause(): Promise<{ paused: boolean }>;
  skipToNext(options?: { reason?: string }): Promise<{ advanced: boolean }>;
  seek(options: { seconds: number }): Promise<{ sought: boolean }>;
  setMuted(options: { muted: boolean }): Promise<{ muted: boolean }>;
  clearQueue(options?: { keepCurrent?: boolean }): Promise<{ cleared: boolean }>;
  enterPiP(): Promise<{ entered: boolean }>;
  exitPiP(): Promise<{ exited: boolean }>;
  presentRoutePicker(): Promise<{ presented: boolean }>;
  getState(): Promise<Partial<PlaybackState> & { status: string; queueDepth?: number; failedIds?: string[] }>;
  setNowPlayingMetadata(options: { title: string; place: string; organization: string; artworkUrl?: string }): Promise<{ applied: boolean }>;
  getDiagnostics(): Promise<Record<string, unknown>>;
  addListener(event: PlayerEvent, cb: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>;
}
