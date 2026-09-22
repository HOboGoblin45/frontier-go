# Technology and operations

For a technical reviewer. Deeper material: `docs/ARCHITECTURE.md`.

## Stack

| Layer | What | Notes |
| --- | --- | --- |
| App shell | Capacitor 7, React 18, TypeScript, Vite 5 | One codebase; iOS 15+, iPhone and iPad |
| Playback | Native Swift `FrontierPlayer` on `AVQueuePlayer` | AirPlay, Picture in Picture, lock-screen controls, background audio, next clip pre-buffered |
| Globe | Three.js | Natural Earth coastlines (public domain) |
| Catalog | One JSON file, gated twice | Ships in the app and refreshes weekly from the website |
| Ingest | TypeScript pipeline, NOAA and NASA adapters | Rights, safety, quality, dedupe; writes a rejection log |
| Website | Static, GitHub Pages | Landing, privacy, support, 1,634 share pages, the live catalog |
| CI/CD | GitHub Actions | No Mac needed anywhere |

## Pipelines

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | Every push | Typecheck, lint, 220+ tests, web build, catalog re-verified, store listing checked |
| `ios-check.yml` | Every push | Compiles the Swift plugin against the real iOS SDK on macOS |
| `ios-release.yml` | Tag `v*` | Signs, builds, uploads to TestFlight, then confirms with App Store Connect that the build arrived |
| `ingest-catalog.yml` | Weekly | Re-ingests both agencies, commits the new catalog if it passes the gates |
| `deploy-site.yml` | Site or catalog change, after ingest | Builds and deploys the website, then checks it is live |
| `store-listing.yml` | Manual | Makes App Store Connect match `store-listing/` (plan, apply, submit) |

Weekly ingest, then deploy, means new footage reaches every installed app
without an App Store update: the app fetches the new catalog in the background
and re-runs the rights gate before using it.

## Running costs

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99 / year |
| Hosting (GitHub Pages) | $0 |
| CI (GitHub Actions, public repository) | $0 |
| Video delivery | $0: streamed from agency servers |
| Custom domain (optional, recommended before a sale) | about $15 / year |

## Dependencies on third parties

- **NOAA and NASA servers** for the video itself. If a file disappears, the player
  skips it and records it as failed; the next ingest drops it.
- **images-api.nasa.gov and the NOAA WordPress API** for ingest. If either
  changes, the weekly ingest fails loudly and the last good catalog stays live.
- **GitHub** for code, CI and the website.

## Verification status (honest)

- Automated: 220+ unit tests, typecheck, lint, Swift compile on macOS, catalog
  gates in CI, live-site checks after deploy.
- On a device (build 78): native playback, the transparent web view over the
  player, the Watch layout.
- Not yet verified on a device: AirPlay, Picture in Picture, lock-screen
  controls, background audio, iPad, VoiceOver, and the 4.2.0 features.
