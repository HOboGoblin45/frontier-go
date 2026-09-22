import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FrontierMediaItem } from '../core/types/media';
import { locationHeadline } from '../core/types/location';
import type { FrontierPlayerPlugin, PlayableItem, PlayerDiagnostics } from './types';
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
    url: item.stream.url,
    title: item.title,
    place: locationHeadline(item.location),
    organization: item.source.organization,
    artworkUrl: item.imagery.posterUrl || item.imagery.thumbnailUrl,
    durationSeconds: item.stream.durationSeconds,
  };
}

export async function diagnostics(): Promise<PlayerDiagnostics> {
  const raw = await FrontierPlayer.getDiagnostics();
  const native = raw.native === true;
  return {
    native,
    attached: raw.attached as boolean | undefined,
    webViewTransparent: raw.webViewTransparent as boolean | undefined,
    pipSupported: raw.pipSupported as boolean | undefined,
    audioSessionCategory: raw.audioSessionCategory as string | undefined,
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
