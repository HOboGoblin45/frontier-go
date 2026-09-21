import { registerPlugin } from '@capacitor/core';

/**
 * FrontierPlayer — the native playback plugin for frontier go.
 *
 * This file exists so the package is self-describing and so anything that
 * imports `frontier-player` directly gets a working handle. The application
 * does NOT import it: `app/src/player/frontierPlayer.ts` registers the same
 * jsName with a full web implementation and a TypeScript contract, and that is
 * the interface the app uses. Both must name the plugin identically, because
 * the Swift class declares `jsName = "FrontierPlayer"` and Capacitor binds on
 * that string.
 *
 * The web object here is deliberately minimal and deliberately loud: if it is
 * ever reached on iOS, the native class has failed to register and every
 * native capability — the queue, AirPlay, Picture in Picture, the lock screen —
 * is silently absent. That exact failure cost this project a release cycle
 * (v3.4.1) when a plugin was missing its CAPBridgedPlugin conformance.
 */
const FrontierPlayer = registerPlugin('FrontierPlayer', {
  web: () => {
    throw new Error(
      'FrontierPlayer has no standalone web implementation. Import '
      + "'src/player/frontierPlayer' from the app instead, which provides one.",
    );
  },
});

export default FrontierPlayer;
export { FrontierPlayer };
