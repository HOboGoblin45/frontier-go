# Trailer Roulette to frontier go — audit and migration

Written during the reorientation, from the repository at `af535e1`
(v3.4.3). Everything below about the old product is what the code actually
did, not what the documentation claimed.

---

## 1. Current architecture (as found)

```
app/                          Capacitor 7 + React 18 + Vite 5, JavaScript (no TypeScript)
  src/
    App.jsx                   one screen
    components/TrailerRoulette.jsx   754 lines: queue engine, cycle timer, watchlist, filters
    components/Player.jsx     platform router -> Player.web.jsx | Player.ios.jsx
    features/                 six "fun modes" (Blind Date, Cinema, Guess Year, Roulette Wheel,
                              Time Machine, Trope Bingo)
    lib/tmdb.js               TMDB discover/search/trailer; VITE_TMDB_API_KEY at build time
    lib/endDetection.js       309 lines of ad-aware end detection
    lib/theaters.js           Alamo Drafthouse lineup adapter (Theater Mode)
  local-plugins/
    trailer-player/           2,013-line Swift plugin: a modal WKWebView that navigates to a
                              Vercel proxy page hosting a YouTube iframe
    airplay-plugin/           76-line AVRoutePickerView wrapper
  ios/App/                    committed Xcode project, bundle id app.trailerroulette.ios
landing-page/api/embed.js     Vercel Edge Function: the proxy page, load-bearing for playback
.github/workflows/            ci.yml (ubuntu), ios-bootstrap.yml (one-time), ios-release.yml (macOS)
```

Execution flow: `main.jsx` -> `App.jsx` -> `TrailerRoulette.jsx` fetches a
stratified random mix from TMDB, resolves each film to a YouTube key, and calls
`TrailerPlayer.openTrailer()`. The native plugin presents a modal WKWebView
that navigates to `https://trailer-roulette.vercel.app/embed?v=ID`. That page
hosts a YouTube iframe and posts player events back over
`webkit.messageHandlers.trailerEvent`.

**TypeScript was not in use.** The brief assumed it was. There is no
`tsconfig.json` in the repository at `af535e1`; `@types/react` is present but
unused. Introducing TypeScript was therefore a migration step, not a given —
see §6.

## 2. Player architecture (as found)

Three mirrors of the same logic, which the project's own `CLAUDE.md` warns must
always change together:

| Layer | File | Role |
| --- | --- | --- |
| Native | `trailer-player/ios/Plugin/TrailerPlayer.swift` | modal WKWebView, watchdog, chrome, end detection |
| Web | `app/src/lib/endDetection.js` | same end detection for the browser |
| Proxy | `landing-page/api/embed.js` | the page YouTube actually loads |

The structural problems, in the order they cost the product:

1. **Advertising is not ours to control.** Every shuffle can trigger another
   pre-roll. Nothing in an embedded player can change that, and suppressing it
   would violate YouTube's API Services Developer Policies.
2. **"Did it end?" is a research problem.** 2,013 lines of Swift, a 309-line
   web mirror, a 1-second heartbeat, a liveness watchdog, a duration pin and
   three named bug classes (B1, B2, B3) exist to answer a question AVFoundation
   answers with one notification.
3. **AirPlay video does not work from an iframe.** The AirPlay button routed
   audio at best.
4. **No preloading, no caching, no buffering control**, so every shuffle was a
   fresh page load behind an ad.
5. **App Review risk.** The repo's own `docs/APP-STORE-STRATEGY.md` records the
   YouTube-wrapper rejection risk and recommends adding original features to
   survive it.

## 3. Reusable systems (PRESERVE)

| System | Verdict |
| --- | --- |
| GitHub Actions `ci.yml` / `ios-release.yml` | Preserved, extended. Mac-free release pipeline intact. |
| Committed Xcode project, signing setup, bundle id | Preserved exactly. See §7. |
| Capacitor 7 shell and plugin conventions | Preserved, including the CAPBridgedPlugin lesson. |
| `lib/storage.js` (Preferences/localStorage) | Ported to `core/platform/storage.ts`, new key namespace. |
| `lib/haptics.js`, `lib/errorLog.js` | Ported to `core/platform/`. |
| `styles/safe-area.css` | Preserved verbatim. |
| ErrorBoundary pattern | Rebuilt in TypeScript, same role. |
| Icon pipeline (`assets/icon-master-1024.svg` -> PNG set) | Preserved; new artwork through the same path. |
| Vitest + ESLint setup | Preserved, extended to TypeScript. |

## 4. Trailer-specific systems (REPLACE or REMOVE)

| System | Verdict | Why |
| --- | --- | --- |
| `local-plugins/trailer-player/` | REMOVED | Replaced by `frontier-player` on AVFoundation. |
| `local-plugins/airplay-plugin/` | REMOVED | AirPlay is part of the new player, not a separate plugin. |
| `lib/tmdb.js`, `lib/youtube.js`, `lib/ytIframeApi.js` | REMOVED | No movie metadata, no YouTube. |
| `lib/endDetection.js` + tests | REMOVED | `AVPlayerItemDidPlayToEndTime` replaces all of it. |
| `lib/theaters.js`, `TheaterSheet.jsx` (Theater Mode) | REMOVED | Cinema listings are not a frontier. |
| `features/` (six fun modes) | REMOVED | Games about films. |
| `components/TrailerRoulette.jsx`, `MovieSheet`, `FiltersSheet`, `Player.*` | REPLACED | New Watch/Globe/Saved/Profile. |
| `lib/watchlist.js`, `lib/movieFacts.js`, `lib/shuffleWeighting.js` | REPLACED | Saved discoveries; a real weighted engine. |
| `landing-page/api/embed.js` | REMOVED | A YouTube proxy in the repo is the single clearest signal to a reviewer that this is a YouTube wrapper. Removing it also ends the Vercel deploy dependency: frontier go has no server. |
| `VITE_TMDB_API_KEY` secret gate in `ios-release.yml` | REMOVED | Would have failed every release for a key nothing reads. |

## 5. Migration risks, and what was done about each

| Risk | Handling |
| --- | --- |
| Bundle id change would orphan the App Store record and every signing secret | Bundle id unchanged. Display name changed. §7. |
| A new native plugin silently failing to register (this repo lost a release to exactly that in v3.4.1) | `FrontierPlayer` conforms to `CAPBridgedPlugin` **and** ships the `CAP_PLUGIN` macro; `assertNative()` throws on iOS if the web implementation answers; the Profile screen shows the binding state in one line. |
| No Mac, so Swift cannot be typechecked locally | `ios/Tests/extract-and-run.sh` lifts the item parser verbatim, diffs the copy against the source, and compiles and runs it under Linux Swift. The whole file is syntax-checked with `swiftc -frontend -parse`. UIKit/AVFoundation typechecking remains a macOS CI gate. |
| Provider APIs changing or going away | Nothing is fetched at runtime. The catalog is generated by a workflow and committed; the app ships with it and works offline. |
| A regenerated catalog quietly admitting something inadmissible | `shipped-catalog.test.ts` re-runs every rights, safety and quality gate against the committed file, in CI and in the ingest workflow before it commits. |
| Losing the Mac-free release pipeline | `ios-release.yml` still builds, signs and uploads on a macOS runner from a tag push. Only the build-time secret check changed. |

## 6. Decisions the brief left open

**TypeScript was introduced.** The brief specifies the domain model as
TypeScript interfaces and requires a typecheck gate; the repository had neither.
The new code is TypeScript throughout, `npm run typecheck` runs in CI and in the
release workflow, and ESLint is TypeScript-aware.

**Four tabs, not three.** The brief recommends Watch / Globe / Saved. The design
board supplied mid-build shows Home / Explore / Saved / Profile. Four was
adopted: settings, provenance and the native-player diagnostic need somewhere to
live, and burying them in a gesture would have cost more than the fourth tab.

**A place finder exists on the globe, and only there.** The brief says not to
build a search experience; the design board shows a search affordance on the
Explore screen. What shipped finds a *place* among the globe's markers. It
cannot search content, it is behind an icon, and it doubles as the non-drag path
to every marker for anyone who cannot rotate a sphere.

**The Earth is drawn, not photographed.** Natural Earth 110m land polygons
(public domain, 55 KB, `world-atlas`) are rasterised to a canvas texture at
runtime. A satellite basemap would have been a large binary asset with its own
licence to verify, and it would fight a design that is editorial rather than
photographic.

**Ambient mode replaces "TV mode".** The design board's sixth screen. It is a
display mode of Watch, not a separate screen.

## 7. The bundle identifier

`app.trailerroulette.ios` is unchanged, deliberately.

Apple does not allow a bundle id to change after first submission. A new one
means a new App Store Connect record, new provisioning profiles, new signing
secrets, and a first review from zero — and it would break the Mac-free
pipeline, on a Windows-only machine, immediately. The app's *name* is what
people see and can be changed freely in App Store Connect.

The consequence to be aware of: the identifier string appears in the Xcode
project, the provisioning profile, `ExportOptions.plist` in `ios-release.yml`,
and the deep-link `CFBundleURLName`. It is a name from the previous product, and
it is load-bearing. Do not tidy it.

## 8. `release/public-3.5`

`main` is at `af535e1` (v3.4.3) and frontier go branches from it.
`release/public-3.5` is a **separate line with 27 commits** that `main` does not
have: a first-run consent gate, /privacy, /terms and /support pages, native iOS
screenshots captured on a runner, an AirPlay routing fix, a stalled-skip fix, a
whole-catalogue feed change, and the pivot research that led here.

frontier go does not include them. Almost all of it is about a product that no
longer exists, and merging it would mean resolving conflicts in files that this
branch deletes outright.

Four things were ported across, because they are about the *project* rather
than the product:

| Ported | Why it survives the product change |
| --- | --- |
| `.gitattributes` | Stops this Windows/OneDrive checkout rewriting 23 tracked files to CRLF, which once produced a 38,000-line diff with no content change. |
| `PrivacyInfo.xcprivacy` + 4 `project.pbxproj` lines | Apple requires a privacy manifest. Rewritten for frontier go's actual API use: no tracking, nothing collected, UserDefaults under CA92.1. |
| `.github/workflows/ios-check.yml` | A macOS compile of the app and the native plugin on every push. frontier go needs it more than v3.5.0 did: the player is now 870 lines of AVFoundation that cannot be typechecked anywhere else. Extended here to assert the CAPBridgedPlugin registration. |
| `ios-release.yml` marketing-version fix, `deploy-landing.yml` | A dispatched TestFlight build was being labelled 1.0; the landing page had no deploy path off a keyboard. |

Deliberately not ported: the consent gate (frontier go has no first-run consent
to gather), `verify-production.mjs` and the proxy gate (there is no proxy), the
3.5.0 screenshots, and everything that touches TMDB, the fun modes or Theater
Mode.

**What to do with `release/public-3.5` is a decision for Charlie**, not one this
branch makes. The realistic options are to ship 3.5.0 as a final Trailer
Roulette release before frontier go replaces it, or to close it.

## 9. What a reviewer should be able to see

- No YouTube anywhere: no embed, no iframe, no proxy, no `youtube.com` string.
- Every clip streams from the publishing agency's own CDN over HTTPS.
- Every item carries a rights classification, a credit line and a link to the
  agency's published usage terms, all visible in the app's information sheet.
- No user-generated content, no uploads, no comments, no accounts, no social
  graph, no location permission.
- `docs/CATALOG-REJECTIONS.md`, regenerated on every ingest, shows what was
  excluded and why.
