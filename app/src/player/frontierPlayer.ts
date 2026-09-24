import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FrontierMediaItem } from '../core/types/media';
import { locationHeadline } from '../core/types/location';
import { artworkFor } from '../core/catalog/artwork';
import type { FrontierPlayerPlugin, PlayableItem, PlayerDiagnostics, VideoInsetStatus } from './types';
import { WebFrontierPlayer } from './webPlayer';

/**
 * The single JS entry point to playback.
 *
 * `registerPlugin` silently resolves to the web implementation when the native
 * class is not bound, which is the most expensive failure mode this codebase
 * has: a whole release of native work that ran nowhere, with nothing in any log
 * saying so. `assertNative()` below turns that silence into a visible error,
 * and the About screen reads the same signal.
 */

const FrontierPlayer = registerPlugin<FrontierPlayerPlugin>('FrontierPlayer', {
  web: () => new WebFrontierPlayer(),
});

export const isNativePlayback = Capacitor.getPlatform() === 'ios';

export function toPlayable(item: FrontierMediaItem): PlayableItem {
  return {
    id: item.id,
    // AVPlayer plays HLS natively. A browser <video> mostly does not, so the
    // web build plays an HLS clip's progressive MP4 when it has one.
    url: isNativePlayback || item.stream.type !== 'hls' ? item.stream.url : (item.stream.fallbackUrl || item.stream.url),
    title: item.title,
    place: locationHeadline(item.location),
    organization: item.source.organization,
    // No title cards on the lock screen or behind the letterbox.
    artworkUrl: artworkFor(item),
    durationSeconds: item.stream.durationSeconds,
  };
}

let insetStatus: VideoInsetStatus = { state: 'unreported' };

export function videoInsetStatus(): VideoInsetStatus {
  return insetStatus;
}

/**
 * Report how much of the picture plane the interface is covering.
 *
 * Never lets a layout hint break playback, but no longer hides a failure
 * either: from 4.0.3 to 4.3.1 every call was rejected because the method was
 * missing from the Objective-C registration, and a `.catch(() => undefined)`
 * here made that invisible. The outcome is now kept for Diagnostics and a
 * rejection is logged once.
 */
export function setVideoInsets(top: number, bottom: number, animated = true): void {
  const t = Math.max(0, Math.round(top));
  const b = Math.max(0, Math.round(bottom));
  FrontierPlayer.setVideoInsets({ top: t, bottom: b, animated }).then(
    () => { insetStatus = { state: 'applied', top: t, bottom: b }; },
    (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (insetStatus.state !== 'failed') console.error(`[FrontierPlayer] setVideoInsets failed: ${message}`);
      insetStatus = { state: 'failed', top: t, bottom: b, message };
    },
  );
}

export interface RoutePickerFrame { x: number; y: number; width: number; height: number; visible: boolean }

let lastRouteFrame = '';

/**
 * Tell the native layer where the AirPlay button is. Sent only when it
 * changes; a failure is logged once, never thrown (see setVideoInsets).
 */
export function setRoutePickerFrame(frame: RoutePickerFrame): void {
  const f = {
    x: Math.round(frame.x), y: Math.round(frame.y),
    width: Math.round(frame.width), height: Math.round(frame.height),
    visible: frame.visible,
  };
  const key = JSON.stringify(f);
  if (key === lastRouteFrame) return;
  lastRouteFrame = key;
  FrontierPlayer.setRoutePickerFrame(f).catch((e: unknown) => {
    console.error(`[FrontierPlayer] setRoutePickerFrame failed: ${e instanceof Error ? e.message : String(e)}`);
  });
}

export async function diagnostics(): Promise<PlayerDiagnostics> {
  const raw = await FrontierPlayer.getDiagnostics();
  const native = raw.native === true;
  return {
    native,
    attached: raw.attached as boolean | undefined,
    webViewTransparent: raw.webViewTransparent as boolean | undefined,
    webViewBound: raw.webViewBound as boolean | undefined,
    surfaceDetached: raw.surfaceDetached as boolean | undefined,
    pipSupported: raw.pipSupported as boolean | undefined,
    audioSessionCategory: raw.audioSessionCategory as string | undefined,
    airPlay: raw.airPlay as PlayerDiagnostics['airPlay'],
    routePicker: raw.routePicker as string | undefined,
    routePickerPresentations: raw.routePickerPresentations as number | undefined,
    videoInsetTop: raw.videoInsetTop as number | undefined,
    videoInsetBottom: raw.videoInsetBottom as number | undefined,
    implementation: native ? 'native-avfoundation' : 'web-video-element',
  };
}

/**
 * On iOS a web-implementation answer means the Swift class is not conforming to
 * CAPBridgedPlugin and every native capability — AirPlay, PiP, the queue, the
 * lock screen — is quietly absent. Surface it rather than shipping a build that
 * merely looks like it works.
 */
export async function assertNative(): Promise<{ ok: boolean; message?: string }> {
  if (!isNativePlayback) return { ok: true };
  const d = await diagnostics();
  if (d.native) return { ok: true };
  const message = 'The native player is not registered. Check that FrontierPlayer '
    + 'conforms to CAPBridgedPlugin and declares identifier, jsName and pluginMethods.';
  console.error(`[FrontierPlayer] ${message}`);
  return { ok: false, message };
}

export default FrontierPlayer;
