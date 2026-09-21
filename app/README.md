# frontier go — app

The Capacitor 7 + React 18 + TypeScript + Vite 5 client. See the repository
`README.md` for what the product is and `docs/ARCHITECTURE.md` for how the
pieces fit.

```bash
npm install
npm run dev          # browser, real catalog, real streams
npm run typecheck
npm run lint
npm run test
npm run build
npm run ingest       # rebuild public/catalog from the providers
npm run ios:sync     # build + npx cap sync ios
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/core/` | Platform-agnostic: types, catalog gates, shuffle engine, passport, analytics. No React, no Capacitor, no DOM. |
| `src/providers/` | NOAA and NASA adapters, the gazetteer, the rights rules. Ingestion-side. |
| `src/player/` | The Capacitor plugin wrapper and a real web implementation of the same contract. |
| `src/state/` | `useFrontier` — the only place the catalog, engine and player meet. |
| `src/ui/` | Design tokens, components, screens, the Three.js globe. |
| `tools/ingest/` | The catalog pipeline runner. |
| `public/catalog/` | The generated catalog, committed, shipped in the bundle. |
| `local-plugins/frontier-player/` | Swift: AVQueuePlayer, AirPlay, PiP, Now Playing. |

## Environment

No API keys. Nothing is fetched from a provider at runtime. `VITE_APP_VERSION`
is injected from `package.json` by `vite.config.js`;
`VITE_PRIVACY_POLICY_URL` is optional.

`.env.local.template` is kept for future use and is currently empty of required
values.
