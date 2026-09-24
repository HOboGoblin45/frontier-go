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
  /**
   * False means no web view was ever bound to the player, so every attempt to
   * make it transparent was a silent no-op. Distinguishes "bound but opaque"
   * from "never bound", which have different causes and different fixes.
   */
  webViewBound?: boolean;
  /**
   * True when the video surface is a sibling of the web view rather than a
   * subview of it. Capacitor's view controller uses the WKWebView as its own
   * `view`, so the naive attachment puts the player layer inside WebKit's
   * hierarchy, where WebKit owns the ordering. False means it is still there.
   */
  surfaceDetached?: boolean;
  pipSupported?: boolean;
  audioSessionCategory?: string;
  /**
   * The picture's inset from the top and bottom of the screen as the native
   * player has actually applied it. Both zero while the interface is showing
   * means the layout hint never arrived and the text is over the picture.
   */
  /** What AirPlay is doing right now. See describeAirPlay(). */
  airPlay?: AirPlayDiagnostics;
  /** Where the native AirPlay picker is: "over the button", "hidden", "not mounted" or "none". */
  routePicker?: string;
  /** How many times iOS has opened the AirPlay list this session. */
  routePickerPresentations?: number;
  videoInsetTop?: number;
  videoInsetBottom?: number;
  implementation: 'native-avfoundation' | 'web-video-element';
}

export interface AirPlayDiagnostics {
  /** The player is sending the picture to the TV (AVPlayer external playback). */
  externalVideo?: boolean;
  /** "Living Room (AirPlay)", "Speaker (Speaker)". */
  audioOutputs?: string;
  routeSharingPolicy?: string;
  externalNudges?: number;
  externalAfterNudge?: boolean;
  itemStatus?: string;
  itemError?: string;
  lastStreamError?: string;
  audioSessionError?: string;
}

/**
 * One line that says which of the AirPlay failures this is. The two that look
 * alike on the sofa have different causes: sound on the TV with the picture
 * still on the phone (the player never switched to external playback), and
 * nothing on the TV at all (the TV could not play the stream).
 */
export function describeAirPlay(a: AirPlayDiagnostics | undefined): { text: string; bad: boolean } {
  if (!a) return { text: 'n/a', bad: false };
  const toTv = /airplay/i.test(a.audioOutputs || '');
  if (a.audioSessionError) return { text: `audio session: ${a.audioSessionError}`, bad: true };
  if (a.externalVideo) {
    return a.lastStreamError || a.itemError
      ? { text: `video to TV \u00b7 stream error: ${a.lastStreamError || a.itemError}`, bad: true }
      : { text: 'video to TV', bad: false };
  }
  if (toTv) {
    return { text: `SOUND ONLY \u00b7 picture stayed on the phone${a.externalNudges ? ` \u00b7 retried ${a.externalNudges}` : ''}`, bad: true };
  }
  return { text: `not casting \u00b7 ${a.audioOutputs || 'no output'}`, bad: false };
}

/** What happened to the last layout hint sent to the player, for Diagnostics. */
export interface VideoInsetStatus {
  state: 'unreported' | 'applied' | 'failed';
  top?: number;
  bottom?: number;
  message?: string;
}

/**
 * One line for Profile -> Diagnostics saying whether the picture is being
 * moved clear of the interface. `bad` colours the line as a fault.
 */
export function describeVideoInset(
  status: VideoInsetStatus,
  diag: Pick<PlayerDiagnostics, 'native' | 'videoInsetTop' | 'videoInsetBottom'> | null,
): { text: string; bad: boolean } {
  if (status.state === 'failed') return { text: `NOT APPLIED \u00b7 ${status.message || 'rejected'}`, bad: true };
  if (status.state === 'unreported') return { text: 'no report yet', bad: false };
  const native = diag?.native
    ? ` \u00b7 native ${Math.round(diag.videoInsetTop ?? 0)}/${Math.round(diag.videoInsetBottom ?? 0)}`
    : '';
  return { text: `top ${status.top ?? 0} \u00b7 bottom ${status.bottom ?? 0}${native}`, bad: false };
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
  /**
   * Where the interface's AirPlay button is, in CSS pixels from the top left
   * of the web view, and whether it is the visible, tappable thing there.
   * The native layer lays Apple's own route picker over it.
   */
  setRoutePickerFrame(options: { x: number; y: number; width: number; height: number; visible: boolean }): Promise<{ state: string }>;
  getState(): Promise<Partial<PlaybackState> & { status: string; queueDepth?: number; failedIds?: string[] }>;
  setNowPlayingMetadata(options: { title: string; place: string; organization: string; artworkUrl?: string }): Promise<{ applied: boolean }>;
  /**
   * Inset the picture so it is not drawn underneath the interface.
   *
   * The player fits the frame inside whatever rect it is given, so the caller
   * reports the space its own chrome occupies in CSS pixels and the picture
   * moves clear of it. The caller measures; nothing here assumes a layout.
   */
  setVideoInsets(options: { top: number; bottom: number; animated?: boolean }): Promise<{ top: number; bottom: number }>;
  getDiagnostics(): Promise<Record<string, unknown>>;
  addListener(event: PlayerEvent, cb: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>;
}
