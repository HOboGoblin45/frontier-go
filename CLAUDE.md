# CLAUDE.md — frontier go (hardwired project context)

Loaded automatically whenever an AI session works in this folder. Single source
of truth for what this project is and the rules of the road. Deeper detail:
`docs/ARCHITECTURE.md`, `docs/FRONTIER-GO-MIGRATION.md`, `docs/RIGHTS-REVIEW.md`.

## What this app is

**frontier go** — an iOS app (Capacitor 7 + React 18 + TypeScript + Vite 5) that
plays a continuous channel of real exploration footage: NOAA deep-ocean ROV
dives, NASA orbital and mission footage. Open it and something is already
playing. Tap Shuffle and you are somewhere else. No account, no search, no
decisions.

- Bundle id `app.trailerroulette.ios` · Apple ID 6764209094 · repo `github.com/HOboGoblin45/trailer-roulette-ios`
- Reoriented from **Trailer Roulette** at v3.4.3 (`main`). Version series restarts at **v4.0.0**.
- **`release/public-3.5` is a separate line** carrying 27 commits of Trailer Roulette v3.5.0 work that `main` does not have. frontier go branches from `main` and does not include it. Four project-level things were ported across: `.gitattributes`, the Apple privacy manifest, `ios-check.yml` and the marketing-version fix. What to do with the rest of that branch is an open decision — see `decisions/0005-frontier-go-reorientation.md`.
- The reasoning this product rests on is in `docs/decisions-evidence/`, written on that branch the day before: there is no lawful non-YouTube trailer catalogue, and every lawful source hands you a direct MP4 or HLS URL.
- The full audit, migration classification and the open decisions are in `docs/FRONTIER-GO-MIGRATION.md`. Read it before proposing structural change.

## Hard rules (never violate)

- **NO EMOJIS anywhere** — not in app UI, not in chat, not in docs. Text, SVG
  glyphs or letter monograms. (Typographic glyphs like ▸ ✓ ∞ · are fine.)
- **Deliver finished work, not plans** ("Boil the Ocean"). Complete
  implementation, tests, docs, version bump, changelog.
- **Rights fail closed.** `unknown` is a rejection. No "probably public domain",
  no inferring a licence from the fact that a file is reachable. The gate is
  `rightsAreClear()` in `core/types/rights.ts` and it runs twice: in the
  pipeline and again on the client.
- **Never fabricate geography.** A location with no published coordinates gets
  `accuracy: 'mission'` and no latitude. Every coordinate carries a
  `coordinateSource` saying what it is. A region reference point is never shown
  as a position.
- **Do not bring YouTube back.** Not as a fallback, not for one channel, not for
  a single item. The whole reorientation exists because embedded playback cost
  this product AirPlay, PiP, preloading, buffering control and an ad-free
  shuffle. There is no `youtube.com` string left in the repo; keep it that way.
- **The native plugin must stay bound.** `FrontierPlayer` conforms to
  `CAPBridgedPlugin` *and* ships the `CAP_PLUGIN` macro. This project already
  lost a release cycle (v3.4.1) to a plugin that compiled, shipped, and was
  never reachable from JS. `assertNative()` and the Profile screen exist to make
  that failure loud.
- **The bundle id is load-bearing.** It is the previous product's name and it
  must not be tidied. See `docs/FRONTIER-GO-MIGRATION.md` §7.
- Charlie is Windows-only with PowerShell 5.1: no `??`, no `&&` chains in
  suggested commands; give plain multi-line blocks.

## Key file map

| Area | Files |
| --- | --- |
| Domain model | `app/src/core/types/` (media, location, rights, safety, playback, history) |
| Rights and safety gates | `core/types/rights.ts`, `core/types/safety.ts`, `core/catalog/eligibility.ts` |
| Shuffle engine | `core/shuffle/engine.ts`, `core/shuffle/constraint.ts` |
| Catalog pipeline | `core/catalog/pipeline.ts`, `quality.ts`, `dedupe.ts`; runner `tools/ingest/run.ts` |
| Providers | `providers/noaa/`, `providers/nasa/`, `providers/gazetteer.ts` |
| Native player | `local-plugins/frontier-player/ios/Plugin/FrontierPlayer.swift` |
| JS player wrapper + web implementation | `src/player/frontierPlayer.ts`, `src/player/webPlayer.ts` |
| App state (the only place the pieces meet) | `src/state/useFrontier.ts` |
| Design tokens | `src/ui/styles/tokens.css` |
| Globe | `src/ui/globe/globeScene.ts`, `earthTexture.ts`, `FrontierGlobe.tsx` |
| Shipped-catalog guard | `src/core/__tests__/shipped-catalog.test.ts` |

## Verification status

At the reorientation commit: **165 vitest tests passing**, `tsc --noEmit` clean,
`eslint` clean, `vite build` green, catalog gates re-verified against the
committed file. The Swift plugin is **syntax-checked** (`swiftc -frontend
-parse`) and its item parser is **compiled and run** under Linux Swift 5.10 via
`ios/Tests/extract-and-run.sh`, which diffs its extracted copy against the
source so a stale harness fails rather than passes.

**Not verified:** anything that needs a device or a simulator. AirPlay routing,
Picture in Picture, the lock-screen controls, the transparent-web-view overlay,
the native letterbox backdrop, background audio, and AVFoundation/UIKit
typechecking are all first-run-on-device items. The browser harness verified
layout, the state machine, queue handoff and shuffle latency (85-112 ms) against
a local HTTPS server, because the sandbox's headless Chromium has no H.264
decoder and its proxy will not pass large media.

## Environment gotchas (sandbox sessions)

- **No H.264 in the harness browser.** Playwright's Chromium is built without
  proprietary codecs (`DEMUXER_ERROR_NO_SUPPORTED_STREAMS`). To see video
  locally, transcode a clip to VP9/WebM and serve it over local HTTPS; the
  eligibility gate requires `https://`, so plain `vite preview` will not do.
- **The agent proxy will not pass video.** Large media through
  `HTTPS_PROXY` aborts. `curl` works for downloading a sample; Chromium does not.
- **Never set `crossOrigin` on a `<video>`.** Neither provider CDN sends
  `Access-Control-Allow-Origin` on media, and AVPlayer does no CORS at all, so it
  breaks only the web build — silently, and only off-device.
- **The globe canvas needs an explicit CSS size.** Without one the backing store
  drives the layout box, the ResizeObserver feeds back, and the canvas grows
  without bound (it reached 4,915,200 × 2,457,600 px in testing).
- Swift toolchain: `download.swift.org` is reachable; the Ubuntu 22.04 5.10.1
  build runs on this image and gives `swiftc -frontend -parse` plus real
  compile-and-run for Foundation-only code.
- **`device_bash` cannot unlink files.** Use `git --no-optional-locks status` on
  a OneDrive mount; a stale `.git/index.lock` blocks Charlie's next commit and
  cannot be deleted from that tool (`mv` it aside instead).

## Open threads / next steps

1. **First device run.** Confirm `Profile → Diagnostics → Player` reads
   `Native AVFoundation · active`, then AirPlay to a TV, then PiP, then lock the
   screen and confirm audio continues.
2. **Icons and screenshots.** The icon set is regenerated
   (`assets/icon-master-1024.svg`). App Store screenshots in `store-listing/`
   are still Trailer Roulette's and must be recaptured.
3. **App Store Connect.** The app's display name, subtitle, description,
   keywords and privacy answers all need updating; the record itself stays.
4. **More providers.** The adapter registry is `providers/index.ts`.
   `docs/decisions-evidence/PIVOT-OPTIONS-2026-09.md` surveyed the field and
   found roughly 28,000 rights-clean items across the Library of Congress,
   Prelinger, US government films and NASA. Library of Congress and Prelinger
   are the next two adapters; National Park Service, USGS and DVIDS after. Live HLS feeds are
   modelled (`availability: 'live'`) and deliberately out of launch scope.
5. **Dive-level coordinates.** NOAA publishes per-dive positions outside the
   WordPress API. Adding them would raise those items from `accuracy: 'region'`
   to `'exact'` and make the globe genuinely precise.
