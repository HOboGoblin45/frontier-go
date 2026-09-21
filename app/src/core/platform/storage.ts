import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Storage. Capacitor Preferences on device (survives a web-origin change,
 * which localStorage does not), localStorage in the browser.
 *
 * Everything the app remembers is on the device. Nothing here syncs, and
 * nothing here is keyed to a person.
 */

const isNative = Capacitor.isNativePlatform();

export async function get<T>(key: string): Promise<T | null> {
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key });
      return value ? (safeParse(value) as T) : null;
    }
    const raw = window.localStorage.getItem(key);
    return raw ? (safeParse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  try {
    const json = JSON.stringify(value);
    if (isNative) await Preferences.set({ key, value: json });
    else window.localStorage.setItem(key, json);
  } catch { /* a full or unavailable store must not break the channel */ }
}

export async function remove(key: string): Promise<void> {
  try {
    if (isNative) await Preferences.remove({ key });
    else window.localStorage.removeItem(key);
  } catch { /* noop */ }
}

function safeParse(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

export const KEYS = Object.freeze({
  ONBOARDED: 'frontier.onboarded',
  MUTED: 'frontier.muted',
  CHANNEL: 'frontier.channel',
  HISTORY: 'frontier.history',
  SAVED: 'frontier.saved',
  RECENT: 'frontier.recent-ids',
  HEALTH: 'frontier.item-health',
  ERROR_LOG: 'frontier.error-log',
  AMBIENT: 'frontier.ambient',
});
