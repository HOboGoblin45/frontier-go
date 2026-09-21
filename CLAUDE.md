# CLAUDE.md — Trailer Roulette (hardwired project context)

This file is loaded automatically whenever an AI session works in this folder. It is the
single source of truth for what this project is, what is in flight, and the rules of the
road. Deep detail lives in `docs/PROJECT-PROMPT.md`; session-learned history lives in
`docs/ai-memory/`. Keep all three updated when the project moves.

## What this app is

**Trailer Roulette** — an iOS app (Capacitor 7 + React 18 + Vite 5) that shuffles movie
trailers like a TV channel. Two buttons: **Play** (spin a random trailer) and **AirPlay**
(throw it on the TV). Trailers auto-advance forever. No accounts, no algorithm — and
**optional filters** by decade and genre (v3.4.3; the "no filters" thesis was retired by
owner decision, so do not reinstate that line in product copy). Six optional "fun modes"
live behind the top-right **Modes** pill. **Saved movies** (v3.5.0) has its own screen
behind the bookmark button. **Theater Mode** (v3.2.0) tunes the roulette to one real
cinema's monthly programme via Alamo Drafthouse's public JSON API — it is **hidden in
public builds** behind `VITE_ENABLE_THEATER_MODE` as of v3.5.0, pending verified
permission for that data, and development builds set the flag to see it.

- Bundle ID `app.trailerroulette.ios` · Apple ID 6764209094 · repo `github.com/HOboGoblin45/trailer-roulette-ios`
- v1.0 (build 2.11.0) was submitted to App Review 2026-07-03 (manual release). Latest
  release: **v3.4.2** (2026-08-16) — the auto-advance root-cause fix. v3.4.1 fixed the
  unregistered native plugins (`CAPBridgedPlugin`); v3.4.2 fixes the proxy's missing
  player-event subscription and disables the v3.4.0 playlist handoff. See CHANGELOG.

## Current objective (as of 2026-09-21)

Ship **v3.5.0**, the first build meant for the public App Store, on branch
`release/public-3.5` (PR #1). Nothing before this was ever public. Full review
record, device test script and definition of done: `docs/RELEASE-REVIEW-2026-09.md`.

**A TestFlight build does not have to wait for any of this.** `ios-release.yml`
takes a `workflow_dispatch` with a build number, off any branch, no tag and no
merge; the production check is advisory on that path. 3.5.0 (61) went up that
way on 2026-09-21. It covers everything in the device test except unattended
auto-advance, which needs step 1 first.

**Release-blocking, in order. The first step is the one that fixes the live app.**

1. **Deploy `landing-page/` to Vercel.** One deploy ships three things at once: the
   embed proxy that every installed build depends on, and the `/privacy`, `/terms`
   and `/support` pages the shipped binary already links to. Production was still
   serving the **v1.9.0** proxy page at review time — no `announcePlaying`, no
   `subscribeToPlayerEvents`, no `youtubeEventsSeen` — so **no installed build can
   auto-advance until this lands** (bugs.md B4), and `/terms` and `/support` were
   404 while the consent sheet linked to them. Then run
   `node scripts/verify-production.mjs`, which diffs live `/embed` against this
   checkout and checks all three pages. `ios-release.yml` runs it before signing.
2. **Device test.** Nothing in 3.5.0 has been run on hardware. The script is in the
   release review doc; the two that can change code are the unattended
   eight-trailer auto-advance run (bugs.md B8) and iPad rotation.
3. **Native screenshots.** The captured sets are browser drafts at the right pixel
   sizes and are labelled as such. Two of them show YouTube's play button through
   the web preview's iframe, which the iOS build never shows.
4. **App Privacy and age rating**, re-answered against the final build rather than
   carried over. `docs/PRIVACY-NUTRITION-LABEL.md` has the open questions.
5. Merge, tag `v3.5.0`, push the tag. The tag triggers `ios-release.yml`.

**Build 2.11.0 (60), submitted 2026-07-03, must never be released.**

**Ordering rule for playback bugs:** the proxy is the only layer that reaches
already-installed builds. Any playback fix must be expressible in the message
vocabulary those builds already understand (`stateChange`, `error`), or it cannot
ship without App Review. New message kinds are an enhancement, never the fix itself.

## Hard rules (never violate)

- **NO EMOJIS anywhere** — not in app UI, not in chat, not in docs. Use text, SVG glyphs,
  or letter monograms. (Typographic glyphs like ▸ ✓ ∞ · are fine.)
- **Deliver finished work, not plans** ("Boil the Ocean"). Complete implementation, tests,
  docs, version bump, changelog.
- **The three playback mirrors change together**: `app/src/lib/endDetection.js` (web),
  `app/local-plugins/trailer-player/ios/Plugin/TrailerPlayer.swift` (native),
  `landing-page/api/embed.js` (Vercel proxy). A fix applied to one will look fixed and
  regress on another path.
- **Never fake theater data.** If a lineup feed fails, error out; never substitute a
  generic "now playing" list or mismatched TMDB titles.
- **Don't touch the proven playback architecture** (WKWebView → real HTTPS nav to
  `https://trailer-roulette.vercel.app/embed?v=ID`). Every alternative failed; the
  post-mortems are in `docs/ai-memory/trailer-roulette-project.md`.
- Charlie is Windows-only with PowerShell 5.1: no `??` operator, no `&&` chains in
  suggested PS commands; give plain multi-line blocks.

## Environment gotchas (sandbox sessions)

- **OneDrive mount staleness**: the Linux sandbox's view of this folder serves stale or
  truncated copies of files edited minutes ago (new files sync fast; edits lag). The
  Windows-side file (Read/Write/Edit tools) is always authoritative. To build/test:
  rsync to /tmp, then re-materialize freshly-edited files from context (heredoc) or from
  `git show HEAD:<file>` + patches; `npm install` works in /tmp (registry reachable).
- `node_modules/` here holds Windows binaries — never run vite/vitest against the mount.
- drafthouse.com blocks non-browser user agents (sandbox fetches return empty); use
  browser-based verification. The API itself is public and CORS-open from real origins.
- No Swift compiler preinstalled — but one can be fetched: `download.swift.org` is
  reachable, and the Linux 5.10 toolchain gives `swiftc -frontend -parse` (syntax-checks
  the whole plugin) plus real compile-and-run of any Foundation-only logic extracted from
  it. See the harness pattern used for v3.2.1: copy the pure functions out verbatim, diff
  the copy back against the source to prove fidelity, shim `Timer` via a typealias, run
  scenarios. CI (macOS runner) is still the only gate for UIKit/WebKit typechecking.
- youtube.com and trailer-roulette.vercel.app are NOT reachable from the sandbox
  (connection reset), so live playback cannot be observed here. Test the proxy by importing
  its Edge Function, lifting the `<script>` out of the rendered HTML and running it in a
  `node:vm` sandbox — see `app/src/lib/__tests__/embedProxy.test.js`.
- In Cowork sessions the device bridge (`device_stage_files` / `device_commit_files`) round-
  trips files byte-identically; verify with `md5sum` on both sides rather than assuming the
  OneDrive staleness above applies.
- **`device_bash` cannot unlink files.** A plain `git status` on the mount takes
  `.git/index.lock` for its opportunistic index refresh, fails to remove it, and leaves a
  stale lock that blocks Charlie's next `git add`/`git commit`. Always use
  `git --no-optional-locks status`. If a lock is already stranded, `mv` it aside — deleting
  it is not possible from that tool.

## Key file map

| Area | Files |
| --- | --- |
| Main screen (two buttons + queue engine) | `app/src/components/TrailerRoulette.jsx` |
| Player router / web / iOS | `app/src/components/Player.jsx`, `Player.web.jsx`, `Player.ios.jsx` |
| Native player plugin (modal WKWebView, watchdog, ad logic) | `app/local-plugins/trailer-player/ios/Plugin/TrailerPlayer.swift` |
| Embed proxy (load-bearing for playback) | `landing-page/api/embed.js` → deployed at trailer-roulette.vercel.app |
| Ad-aware end detection (shared brain + tests) | `app/src/lib/endDetection.js`, `__tests__/endDetection.test.js` |
| Proxy behaviour tests (runs the real Edge Function's script) | `app/src/lib/__tests__/embedProxy.test.js` |
| Theater Mode service + tests | `app/src/lib/theaters.js`, `__tests__/theaters.test.js`, `docs/THEATER-MODE.md` |
| Theater picker UI | `app/src/components/TheaterSheet.jsx` + `theater-sheet.css` |
| TMDB wrapper | `app/src/lib/tmdb.js` (discoverRandomMix, searchMovie, getTrailer) |
| Fun modes | `app/src/features/` (registry in `index.js`) |
| Storage keys | `app/src/lib/storage.js` (`KEYS.SOURCE` = active channel, `KEYS.POLICY_ACCEPTED` = consent) |
| Release gates (flags, policy links, consent) | `app/src/lib/release.js` — `THEATER_MODE_ENABLED`, `POLICY_VERSION`, `LINKS`, `consentGate` |
| Saved movies screen | `app/src/components/SavedMovies.jsx` |
| Public policy pages | `landing-page/privacy.html`, `terms.html`, `support.html` + `vercel.json` |
| Deploy gate / screenshots | `scripts/verify-production.mjs`, `scripts/capture-release-screenshots.mjs` |
| Bug history | `docs/bugs.md` (B1 ~15s ad ENDED, B2 ~13s watchdog, B3 the actual cure) |
| AI session memory (hardwired) | `docs/ai-memory/` |

## Verification status of the current tree (2026-09-21)

**230 vitest across 12 files**, `eslint . --max-warnings 0` clean, `vite build` green,
CI's unsigned **iOS simulator compile green on `release/public-3.5`**, and
`ios-screenshots.yml` green — the only gate here that RUNS the app rather than
compiling it, which is what confirmed it renders on iOS and that the iPad fix holds
on iPadOS rather than only in Chromium. Plus
`scripts/release-smoke.mjs` — **48 browser assertions across four viewport sizes**,
against a dev server with TMDB stubbed and YouTube and Alamo aborted: the consent
sheet cannot be escaped and its three links resolve, no theater request is made even
with a theater source in localStorage, About hides diagnostics until asked, a late
filter response cannot replace a newer selection, an empty filter result falls back
with a banner, and an offline reload recovers on Try again with no page errors. Run it
before every release; it is step 0 in `docs/RELEASE-REVIEW-2026-09.md`. Two gates
added in 3.5.0 are worth knowing about: `policyPages.test.js` asserts that every link
`lib/release.js` ships inside the binary resolves to a file that exists and that the
pages carry the required YouTube and third-party disclosures — the gate whose absence
let `/terms` and `/support` 404 through every green build; and `desktopDevView.test.js`
keeps the browser-only layout rule out of shipped builds.

`embedProxy.test.js` renders the real Edge Function, lifts its `<script>` out verbatim
and drives it through a fake DOM and a virtual clock, so the deployed artefact is what
gets asserted. The native end-detection logic was extracted verbatim (a script diffs the
copy back against `TrailerPlayer.swift`) and compiled and run under Linux Swift 5.10;
the full plugin is typechecked only by the CI macOS runner.

**NOT verified on a device, and not verified against live YouTube.** No physical-device
test has been run against 3.5.0 at all. Every layout value, the player chrome, iPad
rotation, AirPlay, the swipe-down gesture (bugs.md B6) and the `.fullScreen` trade
(bugs.md B8) are reasoned, not seen. Ad behaviour is inferred from this repo's recorded
observations, not re-measured. The iPad layout fix (bugs.md B7) is measured in Chromium
at iPad width, which is evidence about the CSS, not about iPadOS.

Earlier, still current: live-verified Alamo markets feed (23), Austin July lineup (63
films), TMDB matching 17/17 real programme titles including remake disambiguation
(Moana 2026 vs 2016).

## Open threads / next steps

1. **Deploy the proxy, then device-test.** See the current objective above. Until
   `landing-page/` is deployed, B4 cannot be closed and no installed build advances.
2. **B8** — does `.fullScreen` let iOS throttle the main web view's JavaScript and
   stall queue feeding? Measure before changing the presentation style back;
   `.overFullScreen` avoids the exposure but loses iPad rotation.
3. **Alamo permission.** Theater Mode stays hidden until the grant is verified rather
   than inferred from a public API. `research/youtube-tos-embedding.md` records that
   drafthouse.com's terms could not be read by tooling. Re-enabling is one flag plus
   the copy diffs listed in the release review doc.
4. **Charlie's own local indie theaters**: his city is Bloomington-Normal, Illinois.
   Adapters (Eventive / Agile / Veezi) are in `docs/THEATER-MODE.md`. Blocked behind
   the same permission question.
5. **App icon**: 6 concepts presented 2026-07-07; still not picked.
6. **Monetization** deferred until after launch by owner decision; options and the
   TMDB commercial-rights question are in `docs/MONETIZATION-2026-09.md`.
7. Watch the first TestFlight build for `UIGlassEffect` (needs Xcode 26 on CI).
