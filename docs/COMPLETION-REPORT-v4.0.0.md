# frontier go — completion report

Branch `frontier-go` at `53c4989`, pushed to
`github.com/HOboGoblin45/trailer-roulette-ios`. Both CI workflows green,
including a macOS compile of the native player against the iOS 26.2 SDK.

---

## IMPLEMENTED

- **frontier go**, an iOS app that plays a continuous channel of real
  exploration footage from NOAA Ocean Exploration and NASA. Open it and
  something is playing; tap Shuffle and you are somewhere else.
- **Domain model** (`core/types/`): `FrontierMediaItem`, `FrontierLocation`,
  `FrontierRightsMetadata`, `FrontierSafetyMetadata`, `FrontierHealthMetadata`,
  `FrontierRankingMetadata`, `FrontierChannel`, `MediaProvider`,
  `PlaybackState`, `DiscoveryHistory`. TypeScript throughout, strict.
- **Provider abstraction** (`providers/`): one interface, two adapters. Nothing
  downstream knows which provider an item came from.
- **Catalog pipeline**: fetch → normalise → rights → safety → quality →
  dedupe → HEAD every stream → commit. Every stage counted, counts shipped
  inside the catalog file.
- **Native AVQueuePlayer** (`local-plugins/frontier-player`, 890 lines of
  Swift): an `AVPlayerLayer` behind a transparent `WKWebView`, with a blurred
  artwork backdrop filling the letterbox. Owns the queue, buffering, errors,
  AirPlay, PiP, the audio session, Now Playing and the remote command centre.
- **Design system** from your board: seven colours as semantic tokens, Playfair
  Display and Inter, motion built around travel, Reduce Motion respected.
- **Six screens**: Onboarding, Watch, Globe, Keep Exploring, Discovery
  Passport, Ambient mode. Four tabs.
- **The Frontier Globe** (Three.js): Earth drawn from Natural Earth coastlines,
  atmosphere, stars, inertial rotation, pinch zoom, markers sized by cluster,
  visited places, camera fly-to, and a list path for anyone who cannot drag.
- **Weighted shuffle engine**: quality, freshness, novelty, session diversity,
  geographic contrast, environment contrast. Each pick becomes the reference
  point for the next, so a deck is a route rather than a bag.
- **Keep Exploring Here / Go Anywhere**, **Discovery Passport**, **Saved**,
  deep links, share payloads.
- **Analytics**: an in-memory ring buffer with no sink, surfaced read-only on
  the Profile screen. Nothing leaves the device.
- **Ingest workflow**: weekly, commits the catalog, re-runs every gate before
  it does.

## PRESERVED

- The bundle identifier `app.trailerroulette.ios`. Changing it would mean a new
  App Store record, new provisioning profiles, new signing secrets and a first
  review from zero — and it would break the Mac-free pipeline immediately.
  `docs/FRONTIER-GO-MIGRATION.md` §7.
- The committed Xcode project, the signing setup, `ios-release.yml` and the
  tag-push-to-TestFlight flow.
- Capacitor shell and plugin conventions, storage, haptics, error log,
  safe-area CSS, the ErrorBoundary pattern, the icon render pipeline, Vitest
  and ESLint.

## REPLACED

- `TrailerRoulette.jsx` and every trailer screen → Watch, Globe, Passport,
  Profile.
- `lib/shuffleWeighting.js` (a uniform Fisher-Yates) → the weighted engine.
- `lib/watchlist.js` → Saved discoveries.
- JavaScript → TypeScript, with a typecheck gate in CI and in the release.
- `airplay-plugin` → AirPlay is part of the player now.

## REMOVED

- **YouTube, entirely.** `trailer-player` (2,013 lines of Swift around a modal
  WKWebView), `landing-page/api/embed.js`, `lib/endDetection.js`, the ad
  watchdog, the heartbeat, `ytIframeApi.js`, `youtube.js`.
- TMDB, `lib/tmdb.js`, `movieFacts.js`, and the `VITE_TMDB_API_KEY` secret gate
  that would otherwise have failed every release for a key nothing reads.
- Theater Mode and the Alamo adapter; the six fun modes; the movie and filter
  sheets.
- A stale `Podfile.lock` that had drifted to Capacitor 6 and a Browser plugin
  that no longer exists. Every pod is a local path pod; `pod install` writes a
  correct one each run.

## NATIVE PLAYER

`AVQueuePlayer` → `AVPlayerLayer` → a `UIView` inserted **behind** the
Capacitor `WKWebView`, which is made transparent. React floats over the
footage, which is what makes "90% picture, 10% interface" literal.
`AVPictureInPictureController` works directly against the layer, so nothing is
lost by not using `AVPlayerViewController`.

Queue depth is three: current plus up to two prepared. `load` / `enqueue` /
`skipToNext` / `seek` / `setMuted` / `clearQueue` / `enterPiP` / `exitPiP` /
`presentRoutePicker` / `getState` / `setNowPlayingMetadata` / `getDiagnostics`,
and seventeen events. Registration is belt and braces: `CAPBridgedPlugin` in
Swift **and** the `CAP_PLUGIN` macro, `assertNative()` throwing on iOS if the
web implementation ever answers, a one-line diagnostic on the Profile screen,
and a CI step that greps the source for all four required declarations.

## FRONTIER GLOBE

Natural Earth 110m land polygons (public domain, 55 KB, in the bundle)
rasterised to a canvas texture at runtime — no basemap to license, download or
keep current. One fresnel atmosphere shell, 900 stars, a warm key light and a
cool fill. Markers are bronze points sized by cluster; visited places are warm
stone; the selection is a pulsing ring. Camera distance is computed from the
viewport's narrower field of view, so the globe fits any shape of screen.
Rendering stops whenever the globe is off screen or the app is hidden.

## CONTENT PIPELINE

Live against both provider APIs.

```
fetched              797
normalized           797
rejected (rights)     92
rejected (safety)     56
rejected (quality)    42
duplicates collapsed  26
PUBLISHED            581      NOAA 442 · NASA 139
by channel           deep_sea 442 · space 74 · field_science 43 · wild_earth 14 · archives 8
```

NOAA is read through its WordPress REST API, which is the difference between a
scraper and an integration: real `media_details` (duration, bitrate,
dimensions, codec), a parent post with the human title, caption and credit, a
link to the expedition, and `dive` / `topic` taxonomies. NASA is read through
the Image and Video Library search plus each asset's `collection.json` and
`metadata.json`.

## RIGHTS / SAFETY SYSTEM

The gate **fails closed** and runs twice — in the pipeline and again on the
client, so a hand-edited catalog cannot smuggle anything through.

- `unknown` classification, no commercial-use permission, or a missing credit
  line where one is required: excluded.
- NOAA marks copyrighted media with the word "copyright" in the caption. Any
  marker in the caption, credit or description demotes the item to `unknown`.
- NASA third-party, licence, music and branding markers are read from the
  metadata **and from the asset filename** — `..._Music_Artemis logo_...` says
  the piece carries licensed music and appears in no metadata field.
- Safety flags for graphic, disturbing, explicit, military and
  identifiable-person content. Any flag excludes the item.
- `cachingAllowed` is false for every item. Source video is streamed, never
  stored.
- `docs/CATALOG-REJECTIONS.md` is regenerated on every run.
  `docs/RIGHTS-REVIEW.md` lists what metadata cannot decide.

## SHUFFLE ENGINE

`baseWeight × quality × freshness × novelty × sessionDiversity ×
geographicContrast × environmentContrast`, drawn without replacement, with each
pick becoming the reference point for the next. No session repeats until the
eligible universe is exhausted. Off-Earth scores as maximally distant from
Earth, which is both true and exactly the jump worth rewarding. Behavioural
signals — early-leave rate, completion rate, startup failures — feed the
quality term; it is content-quality measurement, not personalisation, and it
cannot narrow what someone is shown toward what they already watched.

## DISCOVERY PASSPORT

Visits, visited places with counts and dates, saved discoveries. Repeat visits
collapse onto one point using an ~11 km grid key, so one expedition does not
scatter across the globe. No points, no XP, no streaks, no badges.

## AIRPLAY / PIP / SYSTEM MEDIA

Implemented and **compiled**, not exercised. `allowsExternalPlayback` and
`usesExternalPlaybackWhileExternalScreenIsActive` are on; `AVRoutePickerView`
presents the system picker; `AVPictureInPictureController` binds to the player
layer; `MPNowPlayingInfoCenter` carries title, place, organisation and artwork;
`MPRemoteCommandCenter` maps play, pause, toggle, **next = Shuffle**, previous
and scrub, with the meaningless skip-interval commands disabled.
`UIBackgroundModes: audio` is declared. Route and interruption notifications
are observed.

## TESTS RUN

| Gate | Result |
| --- | --- |
| `vitest run` | **165 passed**, 9 files |
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `vite build` | green, 3.2s |
| `npx cap sync ios` | 5 plugins found, including `frontier-player@1.0.0` |
| `swiftc -frontend -parse FrontierPlayer.swift` | clean (Swift 5.10, Linux) |
| `ios/Tests/extract-and-run.sh` | 12 checks passed — the item parser compiled and **run**, with the extracted copy diffed against the source |
| Browser walkthrough (Playwright, iPhone 14 Pro, local HTTPS) | all six screens, no console errors |
| Shuffle latency, four consecutive | **85, 98, 112, 86 ms** to the next item painting |

Tests include `shipped-catalog.test.ts`, which re-runs every rights, safety and
quality gate against the 581-item catalog in the bundle.

## CI STATUS

| Workflow | Runner | Result |
| --- | --- | --- |
| `ci.yml` — typecheck, lint, test, build, catalog check | ubuntu | **success**, 31s |
| `ios-check.yml` — real compile of the app and the plugin, privacy manifest lint, plugin-registration assertion | macos-15, Xcode 26.3, iOS 26.2 SDK | **success**, 2m34s |
| `ios-release.yml` | macos-15 | unchanged in shape; not yet run (needs a tag) |
| `ingest-catalog.yml` | ubuntu | new; weekly, and on demand |

The first macOS run **failed**, which is why it was worth porting: `CAPPlugin`
has no `willAppear()` to override. Reading the file in that light found three
more things no Linux toolchain could have caught — a PiP initialiser that is
failable in some SDKs and not others, KVO on `UIView.bounds` (not dependably
KVO-compliant), and `as? Double` silently dropping a whole-second duration that
arrived as an `Int`. All four are fixed in `53c4989` and the runner is green.

## NOT VERIFIED

Everything that needs a device or a simulator run:

- **AirPlay** routing video to a television, switching items while routed,
  disconnect and reconnect.
- **Picture in Picture**: start, stop, background, return, and whether the
  React UI stays in step.
- **Lock screen and Control Center**: transport, next-as-Shuffle, artwork.
- **Background audio** with the screen locked.
- **The transparent web view over the native layer.** This is the single
  riskiest unverified thing: if `webView.isOpaque = false` does not take, the
  interface will be correct and the picture will be black.
- The native letterbox backdrop, haptics, real H.264 playback, real network
  conditions, cellular, memory under a long session.
- Rotation, iPad layout, VoiceOver.

The browser harness could not play H.264 at all: Playwright's Chromium ships
without proprietary codecs, and the agent proxy aborts large media. Playback,
queue handoff and shuffle latency were verified against VP9 transcodes served
over local HTTPS, which exercises the whole state machine but not the codec.

## KNOWN LIMITATIONS

- **581 items, 76% of them NOAA.** The deep sea will dominate until more
  providers land. Channel and contrast weighting mitigate it; they do not fix
  it.
- **Geography is region-level for almost everything.** NOAA's WordPress API
  publishes no per-dive coordinates, so most items resolve to a named operating
  area or an ocean basin, labelled as such. NASA items are mostly mission-level
  with no coordinates at all. This is honest, and it is less precise than the
  globe deserves.
- **Depth appears only where a caption states it.** Roughly a third of NOAA
  items say it in prose; the rest have no depth in the app because inventing
  one was not an option.
- **NASA's catalog is full of produced explainers**, and the filters that keep
  them out also keep out some real footage. Several curated queries return
  nothing at all. The rejection log shows exactly what was dropped.
- **The catalog is 1.55 MB inside the bundle.** Parsed once at launch. Fine
  today; it will need paging somewhere north of a few thousand items.
- **Three.js is 470 KB** (118 KB gzipped) in its own chunk, loaded when the
  globe first opens.
- **Live channel is modelled and empty.** `availability: 'live'` exists in the
  model; no live provider is wired.

## APP STORE / RIGHTS ITEMS REQUIRING HUMAN REVIEW

`docs/RIGHTS-REVIEW.md` is the full list. The ones that need a decision:

1. **NASA insignia.** NASA states plainly that its insignia and logotype are
   not public domain. Whether a clip contains one on a fairing or a flight suit
   cannot be read from metadata. Low risk for a free app crediting NASA;
   revisit before any paid tier or advertising.
2. **Identifiable people appearing incidentally.** The filter removes items
   that are *about* a person, not a crew member in the corner of a deck shot.
   Fine as published; review before any commercial use or before using a frame
   as marketing artwork.
3. **Unlabelled music** in older NOAA highlight reels. The filename and
   metadata markers catch the labelled cases.
4. **The App Store record still says Trailer Roulette.** Name, subtitle,
   description, keywords, screenshots and the privacy answers all need
   updating. Copy is written in `store-listing/`; the six screenshots must be
   recaptured on a device.
5. **`release/public-3.5`.** You have 27 commits of Trailer Roulette v3.5.0
   there that `main` does not. frontier go branches from `main` and does not
   include them. Four project-level things were ported across (`.gitattributes`,
   the Apple privacy manifest, `ios-check.yml`, the marketing-version fix).
   Whether to ship 3.5.0 as a final Trailer Roulette release or close that
   branch is your call.

## NEXT HIGHEST-VALUE TASKS

1. **Get it on a phone.** Tag and let the release workflow run, then open
   Profile → Diagnostics. It must read `Native AVFoundation · active`. Then
   AirPlay to a TV, then PiP, then lock the screen.

   ```
   git checkout frontier-go
   git push origin frontier-go
   git tag v4.0.0
   git push origin v4.0.0
   ```

2. **More providers.** Your own `docs/decisions-evidence/PIVOT-OPTIONS-2026-09.md`
   found roughly 28,000 rights-clean items across the Library of Congress,
   Prelinger, US government films and NASA. Two are live. Library of Congress
   and Prelinger are the next two adapters, and `providers/index.ts` is the only
   file that has to know they exist.
3. **Dive-level coordinates.** NOAA publishes per-dive positions outside the
   WordPress API. Adding them raises those items from `region` to `exact` and
   makes the globe genuinely precise — the single biggest quality jump available.
4. **Recapture the App Store screenshots** from the six design-board frames.
5. **Decide on `release/public-3.5`.**
