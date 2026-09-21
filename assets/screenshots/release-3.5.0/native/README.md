# Native iOS captures

Produced by `.github/workflows/ios-screenshots.yml` on a macOS runner, because
there is no Mac on this project. `xcrun simctl io screenshot` captures at the
device's native resolution, so these are exactly the sizes App Store Connect
asks for: **1320 x 2868** (6.9-inch iPhone) and **2064 x 2752** (13-inch iPad).
The workflow asserts both and fails on a mismatch, so a renamed or resized
simulator in a future Xcode is caught in CI rather than at upload.

These are the real iOS renderer, not a browser at phone dimensions. The first
run proved two things nothing else in this repo could:

- the app launches and renders on iOS at all — until then, only that it
  compiled;
- the iPad layout fix (`docs/bugs.md` B7) holds on iPadOS. It had only been
  measured in Chromium at iPad width, which is evidence about the CSS. The
  13-inch capture fills the screen: no phone-width column, no hairline borders.

## One file per size

**`01-first-launch`** — a fresh container, so the consent sheet is up over the
stage. Submittable.

That is all this can produce, and the limit is real rather than an oversight.

## Why there is nothing past the first screen

Nothing here taps a button, and preseeding the consent acceptance so the app
would boot past it **does not work from a runner**. Two attempts, both of which
ran green and both of which silently produced another first-launch frame:

1. `xcrun simctl spawn <udid> defaults write <bundle-id> <key> <value>` — writes
   the simulator's own defaults domain, not the app sandbox.
2. `defaults write` against the data container's preferences plist, resolved
   with `simctl get_app_container`, with the value read back and printed. The
   read-back is not proof: the simulator runs its own `cfprefsd`, and a plist
   written from the host is not necessarily what the app sees on next launch.

Do not try a third variation of the same idea. Getting past the first screen
needs something that actually drives the UI — an XCUITest target, or `idb` —
which is a separate piece of work.

Until then: the browser drafts one directory up cover Filter, Modes, About this
movie and the stage at the right pixel sizes and say plainly what they are, and
the device test in `docs/RELEASE-REVIEW-2026-09.md` is what produces the rest of
the submitted set.

## Re-running

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
gh workflow run "iOS simulator screenshots"
gh run list --workflow "iOS simulator screenshots" --limit 3
gh run download <run-id> --dir screenshots-native
```

It also runs automatically on any push to a `release/**` branch.
