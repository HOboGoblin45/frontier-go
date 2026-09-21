// Theater Mode stays available for development, pending permission for public use.
export const THEATER_MODE_ENABLED = import.meta.env.VITE_ENABLE_THEATER_MODE === 'true';
export const POLICY_VERSION = '2026-09-21';
export const LINKS = Object.freeze({
  privacy: 'https://trailer-roulette.vercel.app/privacy',
  terms: 'https://trailer-roulette.vercel.app/terms',
  support: 'https://trailer-roulette.vercel.app/support',
  youtube: 'https://www.youtube.com/t/terms',
  google: 'https://policies.google.com/privacy',
});
