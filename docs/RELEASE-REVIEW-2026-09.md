# Release review — v3.5.0 public App Store candidate

Date: 2026-09-21. Branch `release/public-3.5`, PR #1, branched from `main` at
`af535e1`. `main` is untouched, no tag pushed, nothing deployed.

This is the record of what was changed, what was actually verified, what was
not, and the exact sequence to ship. Where this file and `CLAUDE.md`,
`docs/HANDOFF.md` or `docs/bugs.md` disagree about the 3.5.0 release, this file
is the one that was written last.

---

## 1. Status in one paragraph

The app has never been public. v3.5.0 is the first build aimed at the App Store
rather than TestFlight. The code is in a state where it can be submitted; it has
not been run on a device, and the Vercel deploy that the live app depends on has
not happened. Those two things, in that order, are what stand between here and
submission.

---

## 2. What was verified, and how

Every line here has had its output seen. Anything not in this section is
unverified, whatever else in the repo may imply.

| Gate | Result | How |
| --- | --- | --- |
| Unit tests | **224 passing, 12 files** | `npm test` in `app/`, Windows node v24.14.0 |
| Lint | **exit 0** | `npm run lint` (`eslint . --max-warnings 0`) |
| Web build | **exit 0** | `npm run build` (vite 5.4.21) |
| iOS compile | **green** | GitHub Actions "iOS simulator compile", unsigned, on `6222870` |
| CI lint/test/build | **green** | GitHub Actions "CI (lint + test + web build)" |
| iPad layout fix | **measured** | Chromium at 1032x1376: `.app-shell` 520 -> 1032, `max-width` 520px -> none, `border-left` 1px -> 0px |
| Browser smoke | **48 assertions, 4 viewports** | `node scripts/release-smoke.mjs` against a dev server. First run outside its author. |
| First-run consent path | **exercised in a browser** | The screenshot capture waits for "Agree and continue", clicks it, waits for the dialog to be hidden, then drives filters, modes, movie details and About. It completed for both device sizes after the consent change. |

`scripts/release-smoke.mjs` had never been run by anyone but its author and was
referenced nowhere. It is real coverage and it passes: 390x844, 844x390,
1032x1376 and 1376x1032, with TMDB stubbed deterministically and YouTube and
Alamo aborted, asserting the consent sheet cannot be escaped and all three of
its links resolve, that no theater request is made even with a theater source
stored in localStorage, that About hides plugin diagnostics until asked, that a
late filter response cannot replace a newer selection, that an empty filter
result falls back with a banner, and that an offline reload recovers on
**Try again** with no page errors. Run it before every release; it is step 0 in
section 6.

Test count moved 193 -> 224: +9 consent gate, +17 policy pages, +5 desktop dev
view. Two of those files are gates that did not exist before and would have
caught shipped defects:

- `policyPages.test.js` asserts that every URL `lib/release.js` ships inside the
  binary resolves to a file that exists, that both effective dates match
  `POLICY_VERSION`, and that the pages carry the YouTube and third-party
  disclosures. `/terms` and `/support` were 404 through every previously green
  build because nothing connected the app's links to the `landing-page/` files.
- `desktopDevView.test.js` keeps the browser-only layout rule out of shipped
  builds, and asserts the screenshot script emulates touch — without which the
  capture reproduces the bug instead of catching it.

---

## 3. What was NOT verified

**No physical-device test has been run against 3.5.0 at any point.** The
following are reasoned, not seen, and two of them can change code:

1. **Unattended auto-advance under `.fullScreen`** (`docs/bugs.md` B8). The
   presentation style changed from `.overFullScreen` to `.fullScreen` so UIKit
   consults the player's `supportedInterfaceOrientations` and iPad rotates. That
   takes the app's main Capacitor web view out of the window while a trailer
   plays, and iOS may throttle or suspend its JavaScript. If it does, queue
   feeding stalls in a long session. Inference, never measured.
2. **The swipe-down dismissal** (`docs/bugs.md` B6). Fixed and compiled, never
   performed on hardware.
3. **iPad rotation and split-screen viewport.** YouTube's Required Minimum
   Functionality sets a 200x200 minimum for the embedded player; split-screen at
   the narrowest column is the case to check.
4. **AirPlay** against a real receiver.
5. **Ad behaviour** — whether `infoDelivery` streams during a pre-roll and
   whether `initialDelivery` carries the content duration. Both are inferred
   from this repo's recorded observations, not re-measured.
6. **`UIGlassEffect` on iOS 26** in a signed build.

The iPad layout fix is measured in Chromium at iPad width. That is evidence
about the CSS, not about iPadOS.

---

## 4. Screenshots: not submittable as captured

`assets/screenshots/release-3.5.0/` holds five captures at each required size,
**1320 x 2868** (6.9-inch iPhone) and **2064 x 2752** (13-inch iPad), taken from
the real web UI with live TMDB data and no injected movies. They are correct
pixel sizes and current UI, and they are useful as reference.

They are **browser drafts** and two of them cannot be submitted as they are:

- `03-modes` and `04-movie` show **YouTube's red play button** blurred into the
  backdrop. The web preview mounts a YouTube iframe on the stage; the iOS build
  plays in a native modal and never shows this. Third-party branding in a store
  screenshot is its own metadata risk, separately from being inaccurate.
- Nothing in a browser capture can show the native player, the glass chrome, the
  progress line, or AirPlay — which is most of what the app looks like in use.

Capture the submitted set on a device during the device test below, and replace
these wherever the appearance differs.

---

## 5. Owner decisions taken 2026-09-21

| Decision | Choice | Consequence in the tree |
| --- | --- | --- |
| Theater Mode | **Hidden** in the public build | `VITE_ENABLE_THEATER_MODE` unset; privacy, terms, support, store copy and review notes all already say so; `policyPages.test.js` fails if the flag is turned on without revisiting that wording |
| iPad support | **Keep** | 13-inch screenshots required; iPad rotation on the device test; drove the B7 fix |
| Support contact | `crescicharles@gmail.com` | Published on all three pages, in About, and in the store listing |
| Public version | **3.5.0** | Matches `app/package.json`, the branch, the changelog entry and `store-listing/whats-new-v3.5.0.md` |
| Monetization | **After launch** | Options and the TMDB commercial-rights question in `docs/MONETIZATION-2026-09.md`; 3.5.0 has no purchases, no ads sold by us, no affiliate links |

One inherited claim to be aware of: `research/youtube-tos-embedding.md` states
"Charlie approved disabling Theater Mode until permission exists." That approval
had not been given when the sentence was written. It is now true as of the
decision above, so the file stands, but the sentence predated the decision.

---

## 6. Release sequence

PowerShell 5.1. One command per line. No `&&`, no `??`. Use `curl.exe`, not
`curl`.

### Step 0 — local gates

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette\app"
npm test
npm run lint
npm run build
```

Then the browser smoke, which needs a dev server. Two terminals: start the
server in the first, leave it running, and run the smoke in the second.

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette\app"
npm run dev
```

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
node scripts/release-smoke.mjs
```

Expect `PASS 48 browser assertions across four viewport sizes`. It needs real
Chrome; set `PLAYWRIGHT_CHANNEL` if yours is not the default channel. Close the
dev server afterwards.

### Step 1 — deploy the landing page. Do this first.

This one deploy ships the embed proxy **and** the three policy pages. Production
was serving the v1.9.0 proxy at review time, so no installed build can
auto-advance until this lands (`docs/bugs.md` B4), and the consent sheet in the
shipped binary links to two pages that do not yet exist.

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette\landing-page"
vercel login
vercel --prod
```

### Step 2 — prove the deploy took

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
node scripts/verify-production.mjs
```

Every line must read `true`, and the last line must not say the release is
blocked. It checks three markers in the live proxy (`announcePlaying`,
`subscribeToPlayerEvents`, `youtubeEventsSeen`), hashes the live page against
this checkout's handler, and fetches `/privacy`, `/terms` and `/support`.

A quick manual spot check of the same thing:

```powershell
curl.exe -s "https://trailer-roulette.vercel.app/embed?v=dQw4w9WgXcQ" | Select-String "subscribeToPlayerEvents"
curl.exe -s -o NUL -w "%{http_code}`n" "https://trailer-roulette.vercel.app/terms"
curl.exe -s -o NUL -w "%{http_code}`n" "https://trailer-roulette.vercel.app/support"
curl.exe -s -o NUL -w "%{http_code}`n" "https://trailer-roulette.vercel.app/privacy"
```

Three `200`s and one match. If `/terms` returns 404, the deploy did not include
the new files.

### Step 3 — device test

See section 7. Record the results in `store-listing/review-notes.md` before
submitting; that file says so itself.

### Step 4 — merge and tag

Only after steps 1 through 3 pass.

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
git checkout main
git merge --no-ff release/public-3.5
git push origin main
git tag -a v3.5.0 -m "v3.5.0 - first public release"
git push origin v3.5.0
```

The tag triggers `.github/workflows/ios-release.yml`, which now runs
`verify-production.mjs`, then lint and tests, before it signs anything.

**A green workflow is not proof of upload.** Open the run and confirm the
`Build archive` and `Upload to App Store Connect` steps both succeeded by name,
then allow 5 to 15 minutes for processing.

### Step 5 — App Store Connect

1. **Apps > Trailer Roulette > App Store > iOS App > + Version**, enter `3.5.0`.
2. **Build**: select the build the tag produced. **Build 2.11.0 (60), submitted
   2026-07-03, must never be released** — if it is the one offered, stop.
3. **Screenshots**: 6.9-inch iPhone and 13-inch iPad, from the device capture.
4. **Description / Promotional Text / Keywords / Subtitle**: paste from
   `store-listing/`. What's New: `store-listing/whats-new-v3.5.0.md`.
5. **App Privacy**: re-answer against the final build. Do not carry over "Data
   Not Collected" by default. Open questions in
   `docs/PRIVACY-NUTRITION-LABEL.md`. Do **not** declare location: the public
   build makes no location request.
6. **Privacy Policy URL**: `https://trailer-roulette.vercel.app/privacy`.
7. **Age rating**: re-answer. Trailers carry violence, language and mature
   themes that the app does not control.
8. **App Review Information**: paste `store-listing/review-notes.md` after
   adding the tested device models, iOS versions and the exact build number.
9. **Release option**: manual.

---

## 7. Device test script

Run on a physical iPhone and a physical iPad. Record model, iOS version and
build number. A test that was not run is not a test that passed.

**P0 — the bridge is alive**

1. Launch. **About > Troubleshooting details** must show the native player and
   AirPlay plugins active. If either is missing, stop; nothing below is
   meaningful.

**P1 — consent, once and only once**

2. Fresh install. The consent sheet appears. It cannot be dismissed by tapping
   outside it or by a back gesture. All three links open.
3. Tap **Agree and continue**. Playback starts.
4. Force-quit and relaunch, three times. **The sheet must not appear at all —
   not even for a frame.** This is `docs/bugs.md` B5; a flash means the fix did
   not hold on device.

**P2 — unattended auto-advance. The one that can change code.**

5. Press Play. **Put the device down and do not touch it. Watch more than eight
   trailers.** Note any trailer that ends and does not advance, any gap longer
   than a few seconds, and whether a pre-roll ad preceded the failure.
6. If it stalls, this is `docs/bugs.md` B8. Bring the trailer count, the timing
   and whether an ad played **before** anything is changed. Do not switch the
   presentation style back and forth to chase it.

**P3 — the player**

7. During a trailer: **Done** closes it. **Skip** advances. **Mute** toggles and
   the setting survives a relaunch.
8. **Drag down from the glass header — on the title or the empty glass, not on a
   button.** The player should follow your finger and dismiss past roughly a
   third of the screen. This is `docs/bugs.md` B6 and has never been done on
   hardware. Confirm Done, Mute and Skip still take ordinary taps afterwards.
9. No native view may overlap the YouTube rectangle at any point, in either
   orientation. Artwork and spinner belong in the header.
10. **Do not** expect YouTube's ads to be absent. They must play untouched.

**P4 — iPad specifically**

11. **The app must fill the screen.** No phone-width column, no hairline borders
    down the sides. This is `docs/bugs.md` B7; it is measured in a browser only.
12. Rotate through all four orientations, during playback and on the stage.
13. Split-screen at the narrowest column: the embedded player must stay at least
    200 x 200 (YouTube Required Minimum Functionality).

**P5 — the rest**

14. Filter: pick a decade and a genre, apply, confirm the feed narrows. Pick a
    combination with no results and confirm the fallback banner appears and the
    Filter pill stays lit.
15. Six modes open and close. About this movie: facts, cast, providers, Save,
    Share.
16. Save a movie, force-quit, relaunch, retrieve it from the bookmark button.
17. AirPlay to a real receiver.
18. Airplane mode: an error appears and **Try again** recovers.
19. **Theaters must not be visible anywhere** — not in the top bar, not in the
    first-run sheet, not in Modes.

**P6 — capture**

20. Take the submitted screenshots on device at both sizes.

---

## 8. Definition of done

Submission is ready when all of these are true:

- [ ] `landing-page/` deployed; `node scripts/verify-production.mjs` passes.
- [ ] `/privacy`, `/terms`, `/support` return 200 with current content.
- [ ] P0 through P6 above run on a physical iPhone and a physical iPad, results
      written into `store-listing/review-notes.md` with models, iOS versions and
      build number.
- [ ] B8 resolved: either eight-plus trailers advanced unattended, or the
      failure is characterised and a decision taken.
- [ ] Native screenshots captured and uploaded for both sizes.
- [ ] App Privacy re-answered against the final build; no location declared.
- [ ] Age rating re-answered.
- [ ] Review notes pasted with the device results filled in.
- [ ] Build 2.11.0 (60) is **not** the selected build.
- [ ] Manual release selected.

---

## 9. If Theater Mode is enabled later

One flag, and then these, none of which are optional:

1. `VITE_ENABLE_THEATER_MODE=true` in the release workflow's build env.
2. **Verified permission** from Alamo Drafthouse for programming data. Public
   API accessibility is not a grant, and `research/youtube-tos-embedding.md`
   records that their terms could not be read by tooling.
3. `landing-page/privacy.html` — the "Location and Theater Mode" section
   currently says the feature is not in the public build. Rewrite for a shipping
   feature: a one-time location request, coordinates used on device and not
   transmitted, market identifier sent to Alamo.
4. `landing-page/support.html` — "Where is Theater Mode?" becomes a how-to.
5. `store-listing/description.md` and `review-notes.md` — both state it is
   disabled.
6. `docs/PRIVACY-NUTRITION-LABEL.md` and the App Store Connect App Privacy
   answers — location re-enters the assessment.
7. `app/src/lib/__tests__/policyPages.test.js` and `release.test.jsx` both assert
   the flag is off. They will fail, which is the intended alarm: they are what
   stops the copy from drifting out of sync with the build.
