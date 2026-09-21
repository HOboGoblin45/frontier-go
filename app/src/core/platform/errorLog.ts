import { get, set, KEYS } from './storage';

/**
 * A capped on-device record of what went wrong, surfaced read-only in
 * Settings. There is no crash reporter and no remote sink; this is the only
 * way to find out what a device did, so it must never throw and never grow.
 */

const MAX = 30;
let buffer: Array<{ t: string; kind: string; message: string; stack?: string }> = [];
let started = false;

export function recordError(kind: string, message: unknown, stack?: unknown) {
  try {
    buffer = [{
      t: new Date().toISOString(),
      kind,
      message: String(message ?? '').slice(0, 300),
      stack: stack ? String(stack).slice(0, 600) : undefined,
    }, ...buffer].slice(0, MAX);
    void set(KEYS.ERROR_LOG, buffer);
  } catch { /* a logger must never throw */ }
}

export async function getErrorLog() {
  return (await get<typeof buffer>(KEYS.ERROR_LOG)) || [];
}

export async function clearErrorLog() {
  buffer = [];
  await set(KEYS.ERROR_LOG, []);
}

export function initErrorLog() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void get<typeof buffer>(KEYS.ERROR_LOG).then((v) => { if (Array.isArray(v)) buffer = v; });
  window.addEventListener('error', (e) => recordError('error', e?.message, e?.error?.stack));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason as { message?: string; stack?: string } | undefined;
    recordError('unhandledrejection', r?.message ?? r, r?.stack);
  });
}
