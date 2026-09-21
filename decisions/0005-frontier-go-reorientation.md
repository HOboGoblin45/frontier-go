# 0005 — Reorient Trailer Roulette into frontier go

**Status:** accepted · **Date:** 2026-09-21 · **Supersedes in part:** 0002, 0003

## Context

This decision follows directly from research done the day before, on the
`release/public-3.5` branch and preserved in `docs/decisions-evidence/`.
`TRAILER-SOURCES-2026-09.md` established that there is no lawful non-YouTube
trailer catalogue, and `PIVOT-OPTIONS-2026-09.md` reached the conclusion this
decision acts on:

> The pivot question and the ad question turn out to have the same answer, and
> it is not a content question. It is a player question: get playback into
> AVPlayer. Every source in this survey that is lawful to use hands you a
> direct `.mp4` or `.m3u8` URL. That is not a coincidence.

That survey recommended adding a second channel rather than pivoting. frontier
go takes the same technical conclusion further and makes the second channel the
product. The difference is scope, not analysis.

Trailer Roulette's product idea worked: open it, something is playing, tap
Shuffle, no decisions. Its content ecosystem did not. Movie trailers resolve to
YouTube ids, and embedded YouTube playback meant:

- an advertisement can precede every shuffle, and suppressing it is against
  YouTube's API Services Developer Policies
- AirPlay video does not work from an iframe
- Picture in Picture is constrained, preloading and caching are unavailable,
  and buffering cannot be controlled
- "did this video end?" needed 2,013 lines of Swift, a web mirror, a proxy
  page, a heartbeat, a liveness watchdog and three named bug classes
- App Review treats YouTube wrappers as rejection candidates; this repo's own
  `docs/APP-STORE-STRATEGY.md` says so

None of that is fixable inside an embedded player. The constraint was the
content, not the code.

## Decision

Keep the loop. Replace the content and the playback foundation.

frontier go plays **rights-clean exploration footage that exposes real
streamable assets** — NOAA Ocean Exploration and NASA publish H.264 MP4s with
documented usage terms — through **AVFoundation**. Geography becomes a product
primitive: every item knows where it came from, and the globe is how you travel.

## Relationship to release/public-3.5

`release/public-3.5` carries 27 commits of Trailer Roulette v3.5.0 work that
`main` does not: a consent gate, policy pages, native screenshots, an AirPlay
fix and a stalled-skip fix. frontier go branches from `main` and does **not**
include them, because almost all of it is about a product that no longer
exists.

Four things from that branch were ported here, because they are about the
project rather than the product:

- `.gitattributes` — stops this Windows/OneDrive checkout rewriting 23 tracked
  files to CRLF
- `app/ios/App/App/PrivacyInfo.xcprivacy` and its four `project.pbxproj`
  references — Apple's required privacy manifest, rewritten for frontier go's
  actual API use
- `.github/workflows/ios-check.yml` — a macOS compile of the app and the native
  plugin on every push, which frontier go needs more than v3.5.0 did
- `.github/workflows/deploy-landing.yml` and the marketing-version fix in
  `ios-release.yml` — a dispatched TestFlight build was being labelled 1.0

Deciding what to do with the rest of `release/public-3.5` is Charlie's call, not
this decision's.

## Consequences

**Gained.** No advertisements between items. Real AirPlay, Picture in Picture
and lock-screen controls. A shuffle that is an advance onto an already-buffering
asset rather than a page load. No end-detection problem at all. No server: the
catalog ships in the bundle, so the app works offline and there is no Vercel
deployment on the critical path. A provenance story a reviewer can verify.

**Given up.** Movie trailers, and with them Theater Mode, the six fun modes and
the watchlist. The catalog is now a build artefact, so new footage arrives with
an app update or a scheduled ingest rather than instantly.

**Kept unchanged.** The bundle identifier, the Xcode project, the signing setup
and the Mac-free release pipeline. See `docs/FRONTIER-GO-MIGRATION.md` §7 — the
identifier is a name from the previous product and it is load-bearing.

**New obligations.** Rights are now part of the data model and must fail closed
forever; `docs/RIGHTS-REVIEW.md` lists what metadata cannot decide. Geography
must never be fabricated: a location with no published coordinates gets none.
