# Native iOS captures

Produced by `.github/workflows/ios-screenshots.yml` on a macOS runner, because
there is no Mac on this project. `xcrun simctl io screenshot` captures at the
device's native resolution, so these are exactly the sizes App Store Connect
asks for: **1320 x 2868** (6.9-inch iPhone) and **2064 x 2752** (13-inch iPad).
The workflow asserts both, so a renamed or resized simulator in a future Xcode
fails in CI rather than at upload.

These are the real iOS renderer, not a browser at phone dimensions. The set
committed here is from the run that first proved two things:

- the app launches and renders on iOS at all — until then, only that it
  compiled;
- the iPad layout fix (`docs/bugs.md` B7) holds on iPadOS. It had only been
  measured in Chromium at iPad width, which is evidence about the CSS. The
  13-inch captures fill the screen: no phone-width column, no hairline borders.

## What each file is

- **`01-first-launch`** — fresh container, so the consent sheet is up.
  Submittable.
- **`02-after-consent-NNs`** — acceptance preseeded into the app's container
  plist, so autoplay is armed. A burst at 4, 8, 14 and 22 seconds rather than
  one guess: the stage is visible only briefly before the native player takes
  the window, and how long depends on how fast TMDB answers on the runner.
  Keep whichever lands well. **Any frame showing the player contains YouTube's
  video** — evidence that the player opens, not a store asset.

## What it still cannot do

Nothing here taps a button, so there are no native captures of Filter, Modes,
About this movie or Saved movies. Those need the device test in
`docs/RELEASE-REVIEW-2026-09.md`, or a follow-on that drives the UI (XCUITest
or idb). The browser drafts one directory up cover those screens' layout and
copy, at the right pixel sizes, and say plainly what they are.

## Re-running

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
gh workflow run "iOS simulator screenshots"
gh run list --workflow "iOS simulator screenshots" --limit 3
gh run download <run-id> --dir screenshots-native
```

It also runs automatically on any push to a `release/**` branch.
