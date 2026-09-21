# Review response preparation — 3.5.0

Use the actual Resolution Center message and the tested release build, not a
generic appeal. Reply to what was cited; do not pre-empt guidelines nobody
raised. Every factual claim below must be true of the build that was submitted —
check it before sending, because a response that overstates is worse than a
slow one.

## 4.2 — minimum functionality

The case is that the app does things a collection of web links cannot.

Walk the reviewer through one concrete workflow rather than listing features:
open Filter, pick the 1980s and Horror, press Play, open About this movie for
facts, cast and where-to-watch, Save it, retrieve it from the bookmark button,
then open Modes and play Guess the Year against the trailer that is running.

What is native and local, all of it outside the embedded player: TMDB-derived
movie facts and filter logic, a locally persisted saved list, game state and
scoring across six modes, and native playback and route controls including
AirPlay. The trailer video is YouTube's official embedded player; everything
around it is the app.

Do **not** claim Theater Mode is available — it is disabled in this build. Do
**not** claim any activity works without internet or without YouTube.

## 5.2 — third-party content

Describe the architecture plainly: a real HTTPS page in a WKWebView hosting
YouTube's official IFrame-API player. Video streams directly from YouTube. It is
not extracted, downloaded, rehosted or proxied — the Vercel page is an
origin and event bridge, nothing more. No native view overlaps the player's
rectangle. YouTube's own ads are not blocked, muted, overlaid or replaced.

Supply actual permissions and applicable service terms if asked. Do **not**
invent studio, Alamo Drafthouse or commercial TMDB approval. Theater Mode is
disabled precisely because that permission is unverified. Cite
`research/youtube-tos-embedding.md` as a record of the implementation review,
never as a legal approval — it says so itself.

## Privacy, metadata and screenshots

Supply the live links only after the deploy: `/privacy`, `/terms`, `/support`.
If a reviewer hit a 404, the honest answer is that the pages are now deployed
and to confirm the URL; do not claim they were always there.

Explain the split: preferences, saved list, consent and recent local errors live
in device storage; network requests go to YouTube and Google (playback, and
their own ads), TMDB (metadata, images, and JustWatch-sourced availability) and
Vercel (the player page). No accounts, no analytics SDK, no advertising
identifier, no affiliate links in 3.5.0.

Replace any screenshot that does not match the submitted build. The sets in
`assets/screenshots/release-3.5.0/` are browser drafts — two of them show
YouTube's play button, which the iOS build never displays. Re-answer App Privacy
and the age rating against the final implementation rather than resubmitting the
previous answers.

## Playback

Reproduce the exact device and build first. Then check the production proxy:

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
node scripts/verify-production.mjs
```

A stale proxy is the single most likely cause, and it has been the cause before
(`docs/bugs.md` B4). Capture the message sequence and a failing regression test
**before** changing end-detection code — the three mirrors have been "fixed"
four times against symptoms. A passing unit test is not evidence that a video
advanced on a device.

If the report is that playback stalls in a long unattended session, that is
`docs/bugs.md` B8 and it has a known suspect: the `.fullScreen` presentation
takes the main Capacitor web view out of the window. Measure before changing it.
