// Theater Mode stays available for development, pending permission for public use.
export const THEATER_MODE_ENABLED = import.meta.env.VITE_ENABLE_THEATER_MODE === 'true';
export const POLICY_VERSION = '2026-09-21';
/**
 * Tri-state consent gate: should the first-run policy sheet be shown?
 *
 * `undefined` is the ONLY input meaning "the stored value has not been read
 * yet" -- storage.get() resolves to null for a missing key and never to
 * undefined, so the two cases stay distinguishable. That distinction is the
 * whole point. A boolean gate has to guess before the read lands, and
 * guessing `true` mounted the sheet on frame one of every cold launch, so
 * returning users watched it appear and play its 240ms exit animation before
 * the accepted value arrived. Guessing `false` would be worse: it would flash
 * the player at someone who has never agreed to anything.
 *
 *   undefined       -> null    not read yet; render neither sheet nor player
 *   POLICY_VERSION  -> false   accepted THIS version; go straight to play
 *   anything else   -> true    show the sheet
 *
 * A read that throws must pass null (or any non-matching value) so the gate
 * fails closed. Consent for the linked policies is the thing being recorded
 * here, so a device whose persistence is broken has to be asked again rather
 * than assumed to have agreed. The match is exact, not truthy: a stored
 * acceptance of an older POLICY_VERSION is not acceptance of this one.
 */
export function consentGate(stored) {
  if (stored === undefined) return null;
  return stored !== POLICY_VERSION;
}

/**
 * How long a consent read may take before it is treated as failed.
 *
 * The gate's unknown state renders neither the sheet nor the player, which is
 * correct for the moment before the read lands and catastrophic if that moment
 * never ends. `catch` does not cover a promise that simply never settles, and
 * on native this read crosses the Capacitor bridge. Three seconds is long
 * enough that a slow-but-working bridge is not cut off, and short enough that
 * nobody sits in front of a black stage wondering whether the app is dead.
 */
export const POLICY_READ_TIMEOUT_MS = 3000;

/**
 * `promise`, but rejected if it has not settled within `ms`.
 *
 * Deliberately rejects rather than resolving to a default: the caller already
 * has a catch that fails closed, and routing a timeout through the same path
 * as a thrown read keeps one answer to "we could not establish consent" rather
 * than two. The timer is always cleared, so a promise that settles late cannot
 * leave a pending timeout behind.
 */
export function withTimeout(promise, ms = POLICY_READ_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export const LINKS = Object.freeze({
  privacy: 'https://trailer-roulette.vercel.app/privacy',
  terms: 'https://trailer-roulette.vercel.app/terms',
  support: 'https://trailer-roulette.vercel.app/support',
  youtube: 'https://www.youtube.com/t/terms',
  google: 'https://policies.google.com/privacy',
});
