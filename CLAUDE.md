# CLAUDE.md — frontier go (hardwired project context)

Loaded automatically whenever an AI session works in this folder. Single source
of truth for what this project is and the rules of the road. Deeper detail:
`docs/ARCHITECTURE.md`, `docs/FRONTIER-GO-MIGRATION.md`, `docs/RIGHTS-REVIEW.md`.

## What this app is

**frontier go** — an iOS app (Capacitor 7 + React 18 + TypeScript + Vite 5) that
plays a continuous channel of real public-domain footage, every clip placed
on the globe: national parks (wildlife, plants, landscapes, landmarks,
historic sites), early film and government film from the Library of
Congress, NOAA deep-ocean ROV dives, NASA orbital and mission footage. Open it
and something is already playing. Tap Shuffle and you are somewhere else.
Choose a place on the globe to see everything filmed there and nearby.
No account.

- Bundle id `app.trailerroulette.ios` · Apple ID 6764209094 · repo `github.com/HOboGoblin45/frontier-go` (renamed 2026-09-22 from `trailer-roulette-ios`; GitHub redirects the old name)
- Reoriented from **Trailer Roulette** at v3.4.3 (`main`). Version series restarts at **v4.0.0**.
- **Trailer Roulette is retired (decided by Charlie, 2026-09-22).** Its approved-but-never-released 1.0 is withdrawn and frontier go ships as the first public release on the same App Store record. `release/public-3.5` is closed and kept only as history; `frontier-go` is the default branch.
- **Business direction (Charlie, 2026-09-22): free for users, no ads, no IAP — built to be acquired by a larger company, with a product that is novel and valuable to one.** `docs/ACQUISITION-THESIS.md` is the thesis (the dive index, Dive Replay and the Deep Atlas); `docs/GROWTH-AND-ACQUISITION-PLAN.md` keeps the measurement and milestones. Every change is judged on whether it grows a provable, engaged audience. Apple will not transfer an app until a version has been released, so shipping publicly came first.
- **Content scope (Charlie, 2026-09-23):** nature (animals by group: mammals, birds, reptiles and amphibians, fish, sea life, insects; plants), landmarks and human history as well as the deep sea and space - "National Geographic, Science Channel, History and Discovery all in one" from public-domain or stock footage - with everything placed where it is on the globe, so footage can be found by location. Built in 4.4.0 (NPS and Library of Congress providers, subjects, place search).
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
- **Every native method is registered twice.** `FrontierPlayer.m`'s
  `CAP_PLUGIN_METHOD` list overrides the Swift `pluginMethods` at runtime, so a
  method missing from the `.m` is unreachable from JS even though Swift lists
  it. `plugin-registration.test.ts` enforces parity; add new methods to both.
- **AirPlay is Apple's picker laid over our button** (4.4.1). Never go back to
  triggering a hidden AVRoutePickerView from code; it did nothing on device.
  The web layer reports the button's frame (`setRoutePickerFrame`) and hides
  the picker whenever the button is not what a tap would hit.
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
| Providers | `providers/noaa/`, `providers/nasa/`, `providers/nps/` (National Park Service), `providers/loc/` (Library of Congress National Screening Room), `providers/gazetteer.ts` |
| Place names to reference points (Natural Earth, public domain) | `providers/places.ts`, data `app/data/places/gazetteer.json`, built by `tools/places/build.ts` |
| Subjects (what a clip is of) | `core/types/subjects.ts`, `core/catalog/subjects.ts`; re-derive without re-ingest: `tools/ingest/resubject.ts` |
| Find by place (globe filters, here-and-nearby list) | `core/catalog/nearby.ts`, `ui/screens/GlobeScreen.tsx` |
| Native player | `local-plugins/frontier-player/ios/Plugin/FrontierPlayer.swift`, registration `FrontierPlayer.m` (must list every method; `src/player/__tests__/plugin-registration.test.ts`) |
| JS player wrapper + web implementation | `src/player/frontierPlayer.ts`, `src/player/webPlayer.ts` |
| App state (the only place the pieces meet) | `src/state/useFrontier.ts` |
| Design tokens | `src/ui/styles/tokens.css` |
| Globe | `src/ui/globe/globeScene.ts`, `earthTexture.ts`, `FrontierGlobe.tsx` |
| Shipped-catalog guard | `src/core/__tests__/shipped-catalog.test.ts` |
| Collections (Explore → Collections) | `core/catalog/collections.ts`, `ui/components/CollectionsList.tsx` |
| Title and description hygiene | `core/catalog/text.ts` (every rule traced to real titles) |
| Artwork that is fit to show (NOAA emblem title cards excluded) | `core/catalog/artwork.ts` |
| Remote catalog refresh | `loadRemoteCatalog` / `shouldAdopt` in `core/catalog/catalog.ts` |
| Website, share pages, catalog hosting | `landing-page/`, `app/tools/site/`, `.github/workflows/deploy-site.yml` |
| App Store listing (source of truth + apply) | `store-listing/`, `.github/scripts/asc-store.mjs`, `.github/workflows/store-listing.yml` |
| Analytics pull (run locally; repo is public) | `.github/scripts/asc-analytics.mjs`, `docs/data-room/METRICS.md` |
| Data room for buyers | `docs/data-room/` |
| Dive index (NOAA ROV dives: track, sightings, segments, stills) | `tools/dives/crawl.ts`, parsers `src/providers/noaaDives/`, data `app/data/dives/`, workflow `dive-index.yml` |
| Dive model, telemetry clock, groups, links | `src/core/dives/` (`types`, `telemetry`, `groups`, `atlas`, `link`, `remote`) |
| Dive Replay (app) | `src/state/useDiveReplay.ts`, `ui/screens/DiveScreen.tsx`, `ui/components/DepthScrubber.tsx`, `DivesList.tsx` |
| Deep Atlas (website) | `tools/site/atlas.ts`, stills `tools/dives/stills.ts` (cache `app/.cache/stills`) |
| Dive footage mirror | `tools/dives/mirror.ts`, `tools/dives/sigv4.ts`, workflow `mirror-dives.yml` (needs MIRROR_* secrets) |
| Site URLs (one place) | `core/platform/site.ts` — `https://hobogoblin45.github.io/frontier-go` |

## Verification status

At v4.4.0: **329 vitest tests passing**, typecheck and lint clean. The
catalog is 6,310 clips / 475 hours (NPS 4,275, NASA 1,184, NOAA 450, Library
of Congress 401), 5,104 of them on the globe. In the browser harness the
Animals filter, place search, the here-and-nearby list and Play all worked
against the real catalog. **Not verified:** NPS or LoC playback on a device.

At v4.3.0: **262 vitest tests passing**, typecheck and lint clean. The dive
index covers 528 dives, 2,428 h of main-camera video and 22,866 sightings. In
the browser harness Dive Replay played two real EX2104 dive 5 segments
(transcoded to VP9 for headless Chromium), with the gauges following
playback, the sighting chip changing, and "Next" crossing into the next
segment. The mirror ran end to end against a local S3 stand-in. **Not
verified:** the mirror against real R2/S3, and Dive Replay on a device.

At v4.2.0: **220 vitest tests passing**, `tsc --noEmit` clean, `eslint` clean,
`vite build` green, catalog gates re-verified against the committed file. The
shipped catalog is **1,634 items / 104 hours** across 12 environments, none
above a quarter of the whole. Shuffle latency measured at 48-139 ms in Chromium
against the full catalog, so the <300 ms target survives the larger file
(4.9 MB, 545 KB over the wire, 93 ms to load).

The Swift plugin is **typechecked against the real iOS SDK on macOS** by
`ios-check.yml`, which runs on every push to `frontier-go` and is the gate that
matters; it is additionally syntax-checked locally (`swiftc -frontend -parse`)
and its item parser is **compiled and run** under Linux Swift 5.10 via
`ios/Tests/extract-and-run.sh`, which diffs its extracted copy against the
source so a stale harness fails rather than passes.

**Device-verified** as of 4.0.3 (build 78): native AVFoundation playback and
the transparent web view over the player layer. The picture inset was NOT
working on device from 4.0.3 to 4.3.1 (the method was missing from the
Objective-C registration; fixed in 4.3.2, not yet device-verified). Check
Profile -> Diagnostics -> Picture inset after any change to the player.

**Not verified:** AirPlay routing, Picture in Picture round-trip, the
lock-screen controls, the native letterbox backdrop, background audio, haptics,
rotation, iPad and VoiceOver are all still first-run-on-device items. The browser harness verified
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
2. **App Store.** Listing copy, keywords and review notes are in
   `store-listing/`; screenshots are generated by `app/tools/screenshots/`.
   Change the listing by editing those files and running `store-listing.yml`
   (`plan` first), never by hand in App Store Connect, or the two drift.
   State on 2026-09-22: build 80 (4.2.0) VALID; blocked only on Charlie
   withdrawing the approved Trailer Roulette 1.0 in the web UI.
   Keep NASA and NOAA out of the app name and keywords, and keep their marks
   and recognisable astronauts out of screenshots (NASA and NOAA terms, Apple
   2.3.7 and 5.2.1).
3. **Growth work, in order** — see `docs/GROWTH-AND-ACQUISITION-PLAN.md` §7:
   Apple TV app, featuring nomination, home-screen widget, more providers,
   NOAA dive coordinates.
4. **More providers.** The adapter registry is `providers/index.ts`.
   Built in 4.4.0: National Park Service and the Library of Congress National
   Screening Room. Researched 2026-09-23 and not built:
   - Internet Archive `usgovfilms` CC0 (6,983 items): no place metadata, so
     nothing could go on the globe.
   - Europeana open-reuse video (12,972): mostly Vimeo embeds.
   - Wikimedia Commons: WebM only.
   - USFWS digital library: moved; not found.
   - USGS video pages: nothing parseable.
   The NPS key is optional (`NPS_API_KEY` secret). DEMO_KEY allows about ten
   requests an hour, and the adapter's large pages fit in that. One page of
   the LoC listing (records 1,101-1,200) answered 404 on 2026-09-23; the
   adapter skips it and a later run retries.
   `docs/decisions-evidence/PIVOT-OPTIONS-2026-09.md` surveyed the field and
   found roughly 28,000 rights-clean items across the Library of Congress,
   Prelinger, US government films and NASA. Library of Congress and Prelinger
   are the next two adapters; National Park Service, USGS and DVIDS after. Live HLS feeds are
   modelled (`availability: 'live'`) and deliberately out of launch scope.

   NOAA is now exhausted: its media library holds 1,569 video attachments
   across 575 parent posts, which is 451 publishable items and will not grow
   except as NOAA posts more. Further volume has to come from a new provider.

5. **NASA query tuning.** `NASA_QUERIES` in `providers/nasa/adapter.ts` is 96
   one- and two-word queries because NASA's search ANDs every term - a
   descriptive phrase matches nothing. Measure any new query against
   `images-api.nasa.gov/search?q=...&media_type=video` before adding it; a
   query that returns 0 hits looks identical in the code to one that works.

6. **Dive footage.** Dive Replay needs the main-camera segments published
   (NOAA's archive is zipped and cannot be streamed). Charlie creates the
   storage (Cloudflare R2 recommended: no egress fees), adds the MIRROR_*
   secrets, then runs `mirror-dives.yml` with dry_run first. Dives light up in
   the app from the next site deploy, no app update needed.
7. **Dive data gotchas.** Track depth is negative from 2021 and positive
   before; 2018-19 annotations use a different export with the lineage in the
   description; some cruises publish dive summaries as `noaa_*_DS*.pdf` with
   the dive number only inside the PDF. All handled in
   `providers/noaaDives/parse.ts` and `tools/dives/crawl.ts`, with tests.
   Never carry the science team's names through; they are dropped at parse
   time and a test checks it.
