import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Fire-and-forget. Never awaited in a render path, never blocks a transition. */
const isNative = Capacitor.isNativePlatform();

export const tap = () => { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };
export const commit = () => { if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); };
// A travel jump is a soft nudge, not a confirmation: Light, not Medium.
export const travel = () => { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };
