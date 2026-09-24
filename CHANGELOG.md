# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

Versions 1.0 through 3.4.3 are **Trailer Roulette**, the product this app was
before v4.0.0. Their entries are kept below for the history.

## [Unreleased]

## [4.4.2] — 2026-09-24

### Fixed

- **AirPlay showed no picture on the TV (reported on device, 4.4.1).** The
  audio session used the default route-sharing policy. Apple's AirPlay
  guidance asks media apps to declare a long-form policy, and this is a video
  app, so the session is now `.playback` / `.moviePlayback` /
  `.longFormVideo`. If iOS refuses that combination, it falls back to the
  4.4.1 session and says so in Diagnostics. The player also fits the picture
  to the TV (`externalPlaybackVideoGravity`).
- If the sound reaches the TV but the player has not switched to external
  playback 1.5 s after the route change, the player is asked once to
  re-evaluate (external playback off and on). Whether that was needed, and
  whether it worked, is recorded.

### Added

- Profile > Diagnostics > AirPlay, refreshed every 2 seconds, shows one of:
  - "video to TV": working;
  - "SOUND ONLY - picture stayed on the phone": the player did not switch;
  - "video to TV - stream error": the TV could not play the file;
  - "not casting".

  It also shows the audio route and any audio-session error, so the next
  report says which failure it is.

### Not verified

- Any of this on a device with an AirPlay receiver.


## [4.4.1] — 2026-09-24

### Fixed

- **AirPlay did nothing (reported on device).** The AirPlay button asked the
  native player to "tap" a hidden, zero-size AVRoutePickerView by poking its
  private button from code. A picker with no size and no place on screen has
  nowhere to present the route list from, and the JS side ignored the
  "not presented" answer, so the tap vanished.
  - Apple's own AVRoutePickerView now sits exactly over the interface's
    AirPlay button, above the web view, drawn clear. The person's tap lands on
    Apple's control and iOS opens the list itself.
  - The web layer reports the button's frame every 250 ms (only changes cross
    to native). It hides the picker whenever the button is not what a finger
    would hit: faded out in landscape, under a sheet, or on another tab.
  - The old programmatic path remains for VoiceOver and for a tap in the
    moment before the picker is placed. If it fails, a toast points to
    Control Center > Screen Mirroring.
  - Profile > Diagnostics > AirPlay control shows where the picker is and how
    many times iOS has opened the list this session.

### Verified

- 332 tests, typecheck and lint.
- Browser harness: the reported frame follows the button, and is hidden under
  the channel sheet, on the Explore tab and when the chrome idles out in
  landscape.

### Not verified

- AirPlay on a device. It needs an AirPlay receiver (Apple TV or an AirPlay
  television) on the same network.


## [4.4.0] — 2026-09-23

Direction from Charlie the same day: expand to nature (animals by group,
plants, landscapes), landmarks and human history, "National Geographic,
Science Channel, History and Discovery all in one" from public-domain
footage, with everything placed where it is on the globe, so footage can be
found by place.

### Added

- **National Park Service** (`providers/nps/`). About 10,600 videos across
  some 400 parks are read from the NPS API. After the rights, safety and
  quality gates, **4,275 clips and 356 hours from 336 parks** ship. They are
  direct MP4s on nps.gov, most with captions, and 557 are the NPS's own
  B-roll (raw footage, no narration). Rights come from the NPS disclaimer
  plus each video's credit line. The NPS, a park, an NPS staff credit or
  another federal bureau passes; a person alone, a production company, a
  partner or an ND/NC licence does not (2,021 rejected). Placement uses the
  video's own point when the NPS gives one (about 1 in 5, `approximate`),
  otherwise the park's reference point (`region`). A clip with neither is
  not published. Posters missing from the API are recovered from the
  video's nps.gov page (2,065 of 3,130).
- **Library of Congress, National Screening Room** (`providers/loc/`). Early
  film and U.S. Government films are streamed as adaptive HLS: **401 films,
  14.8 hours, 1896-1944, placed at 73 named places**. Each item is
  cleared by its own record, never by the collection statement: a U.S.
  Government production, or U.S. publication in 1930 or earlier. Fiction,
  performance and speeches are excluded. Catalog headings for caricature,
  blackface, lynching or executions, and slurs in titles, are flagged and
  kept out.
- **Place-name gazetteer** (`providers/places.ts`, `tools/places/build.ts`,
  `app/data/places/gazetteer.json`), built from public-domain Natural Earth
  data. A record that gives only names ("san francisco, california") gets
  the reference point of the most specific place the names agree on. It is
  labelled `region`, and its basis names the gazetteer feature and says it
  is not the filming position. Names that disagree get no point.
- **Subjects** (`core/types/subjects.ts`, `core/catalog/subjects.ts`): mammals,
  birds, reptiles and amphibians, fish, sea life, insects and spiders,
  plants and fungi, landscapes, landmarks, human history, native heritage,
  deep sea and space. They are derived from the provider's own words:
  ambiguous words ("bear", "falls", "history") count only in a title, and
  unambiguous species names count anywhere. The pipeline applies them to
  every provider, including NOAA and NASA. `tools/ingest/resubject.ts`
  re-derives them without a re-ingest.
- **Find footage by place.** The globe filters by Animals, Plants,
  Landscapes, Landmarks, History, Ocean and Space. Tap a place to list
  everything filmed there and within 120 km, nearest first, with a
  **Play all** button. Place search now matches states and park names as
  well as pin names (`core/catalog/nearby.ts`).
- **Collections:**
  - "Browse by kind": one per subject.
  - New topics: raw footage, bears, the first films, wildflowers, the Civil
    War, the Revolution, geysers, lighthouses, canyons, caves, birds of prey,
    turtles.
  - "Parks and historic sites": one per park with 8 or more clips.
- **Keep exploring a site**: a clip from a park narrows the shuffle to that
  park.
- **Kinds of place**: forest, desert, mountain, coast, freshwater, grassland,
  cave and historic site. These give the shuffle's contrast scoring something
  to work with beyond "wilderness".
- `--keep-others` on the ingest refreshes some providers and keeps the rest
  of the current catalog.

### Changed

- The Archives channel is now **History**, at full weight for historic-site
  footage. Silent film is still weighted down in Everything.
- The catalog has **6,310 clips (475 hours)**, up from 1,634, with 5,104 of
  them on the globe at 1,061 distinct points. It is 17.9 MB,
  or 2.2 MB gzipped, and parses in 75 ms in Node.
- Store description, landing page and the in-app independence statement
  name the new sources. Share pages play an HLS clip from its MP4 on the web,
  and the web build does the same (AVPlayer keeps the HLS).
- The ingest probe accepts HLS playlists, spaces HEADs to hosts that publish
  a rate limit (loc.gov: 60 a minute) and times a HEAD out after 20 seconds.
- The ingest workflow passes `NPS_API_KEY` (optional), defaults to 20,000
  items per provider and has 120 minutes to run.

### Verified

- 329 tests, typecheck, lint, web build and site build (6,310 share pages).
- Browser harness at 402x874, against the real catalog:
  - The catalog was ready in 1.1 s.
  - The Animals filter showed 303 places.
  - Searching "Yellowstone" and choosing it listed 176 clips here and nearby.
  - Play all started a Yellowstone collection ("Exploring Yellowstone
    National Park").
  - Collections showed "Browse by kind" and "Parks and historic sites".
  - No console errors.
- A Library of Congress HLS segment was fetched and probed: H.264 and AAC in
  MPEG-TS.

### Not verified

- NPS and Library of Congress playback on a device.
- Headless Chromium has no H.264 decoder, so no clip from either source was
  played in the harness.

### Known gaps

- One page of the National Screening Room listing (records 1,101-1,200)
  returned 404 at every page size on 2026-09-23. Those records are missing
  until a later ingest reads them. The adapter now skips such a page and
  carries on.
- The NPS API gives videos no date, so NPS clips have no "captured" date.


## [4.3.2] — 2026-09-23

### Fixed

- **The picture was still under the title and description on device (4.3.1,
  TestFlight).** Root cause, found in the code rather than guessed: the
  native method that moves the picture, `setVideoInsets`, was listed in the
  Swift plugin's `pluginMethods` but not in the Objective-C `CAP_PLUGIN`
  macro in `FrontierPlayer.m`. The macro defines `pluginMethods` in a
  category, which replaces the Swift getter at runtime (confirmed in
  Capacitor's `CAPBridgedPlugin.h`), so every call was rejected as not
  implemented, and the JS wrapper discarded the rejection. The picture never
  moved on any device from 4.0.3, when the method was added, to 4.3.1. The
  4.3.1 fixed frame made it worse: the picture stayed centred in the whole
  window while the text panel below it became opaque.
- Registered the method. A rejected layout hint is now logged and shown in
  Profile -> Diagnostics -> Picture inset (`NOT APPLIED` in the accent
  colour), alongside the inset the native player reports it has applied.
- New test `src/player/__tests__/plugin-registration.test.ts` fails CI if the
  Objective-C list, the Swift list, the Swift implementations and the JS
  interface ever disagree. It fails against the 4.3.1 file.

## [4.3.1] — 2026-09-22

### Fixed

- **Text over the picture (reported on device, TestFlight).** Upright, the
  picture was centred in the whole window whenever the controls idled, and
  when they came back the title and description were drawn over it before the
  picture moved clear, if it moved at all. The picture now has a fixed frame
  of its own under the top bar and the text sits below it on a solid panel, so
  the two never share space and the picture never moves. Titles clamp at three
  lines. Sideways, the picture still takes the whole window with the controls
  floating over it and fading when idle. The picture's position is also re-sent
  to the native player every second, so a report that arrives before the
  player is ready corrects itself.

## [4.3.0] — 2026-09-22

Direction from Charlie the same day: aim for acquisition by a larger company,
with a product that is novel and valuable to one. The thesis is in
`docs/ACQUISITION-THESIS.md`. This release is its first build.

### Added

- **The dive index.** Every ROV dive NOAA Ship Okeanos Explorer has archived
  since 2011 (528 dives): its position, its 1 Hz depth and position track, the
  site named in its dive summary, every living thing the science team logged
  (22,866 sightings, each with its second, depth and, from 2021, water
  temperature), the main camera's recording segment by segment (2,428 hours),
  and the framegrabs the team saved. Built by `tools/dives/crawl.ts` from
  NOAA's public archive over HTTP range requests (it reads a 20 GB zip's table
  of contents in two small requests), with parsers tested against every file
  format NOAA used from 2011 to 2025. The science team's names are dropped at
  parse time.
- **Dive Replay.** Explore now has a Dives view. Open a dive and its camera
  (once published), the vehicle's depth, the water temperature, its position
  and the animal just logged all run on one clock; a depth profile with every
  sighting marked is how you move through the dive, and "Next" jumps to the
  next animal. Dives without published footage open in the same screen with
  the instruments and log following the profile.
- **Clips tied to their dives.** 110 NOAA clips that name their expedition and
  dive now carry that dive's site as their place (a new accuracy level, "Dive
  site") and open the whole dive from the information sheet.
- **The Deep Atlas on the website**: a page per dive (depth profile, photo
  strip, every sighting as logged, a map of the expedition), a page per group
  of animals across all dives ("Octopus: 94 sightings on 36 dives"), a map of
  every dive, a sitemap and structured data. 566 pages and 1,816 of the ROV's
  own framegrabs, cut from NOAA's archive and cached between deploys.
- **Dive footage mirror.** `tools/dives/mirror.ts` and `mirror-dives.yml`
  publish the main camera's segments to S3-compatible storage (remuxed for
  streaming, no re-encode, no audio) and mark them for the app. SigV4 signing
  is checked against the AWS test suite. Waiting on a storage account.
- **Weekly dive index** (`dive-index.yml`), which adds new dives and re-links
  clips; the site redeploys after it.

### Changed

- The channel hands the player to Dive Replay and takes it back afterwards
  (`suspend` / `resume` in `useFrontier`), so dive segments are never mistaken
  for channel items.

### Added

- **The App Store listing is applied from the repository.**
  `.github/scripts/asc-store.mjs` makes App Store Connect match
  `store-listing/`: name, subtitle, description, keywords, promotional text,
  URLs, categories, the 4+ age rating, both screenshot sets, review notes and
  the build. `plan` is read-only; `apply` writes; `submit` also submits for
  review. Release stays manual. `store-listing.yml` runs it from GitHub with the
  existing API key secrets. Screenshots it replaces are downloaded first and
  kept as a workflow artifact.
- **The listing is tested.** CI parses `store-listing/` and fails if a field
  exceeds Apple's limit, the keywords go over 100 bytes, an agency name appears
  in the name, subtitle or keywords, or a screenshot is the wrong size.
- **Apple's analytics, kept.** An ongoing App Store Connect Analytics Reports
  request is active from 2026-09-22. `.github/scripts/asc-analytics.mjs pull`
  downloads each month's reports, verifies their checksums and writes a
  summary. It runs on the owner's machine because this repository is public.
- **Data room** (`docs/data-room/`): one-pager, rights memo, metrics log,
  technology and operations, app-transfer checklist checked against the live
  account, buyers and partners.

## [4.2.0] — 2026-09-22

The first version meant for the public App Store. Direction set the same day:
**free for users, built to grow an audience and be acquired rather than to
charge.** Trailer Roulette is retired and frontier go ships in its place. The
reasoning, the numbers and the roadmap are in `docs/GROWTH-AND-ACQUISITION-PLAN.md`.

### Added

- **Collections.** Explore now has a second view beside the globe: 36
  collections derived from what the agencies publish — 22 subjects (octopus
  and squid, Mars, vents and seeps, spacewalks, jellies, Apollo, liftoff,
  storms from above, engines on the stand...) and 14 whole NOAA expeditions,
  each with its clip count and running time. A collection plays exactly like
  the channel, shuffled and continuous, and supersedes the channel because it
  was chosen. "New this week" appears at the top once the weekly ingest adds
  footage.
- **Channels one tap from the player.** Tapping the title at the top of the
  player opens the channel sheet, which also shows any narrowing in force with
  its one way out. Channels used to be at the top of Profile, the one place
  nobody looks while something is playing.
- **Sleep timer.** The moon button: 15, 30, 60 or 90 minutes, or the end of
  this clip. Playback pauses where it is. The remaining time shows beside the
  button.
- **New footage without an app update.** The app now fetches the newest
  catalog from the frontier go website after launch and adopts it only if it
  is newer and not a collapse (under 60% of what is already playable is treated
  as a fault upstream). It re-runs its own rights and eligibility gates on
  whatever arrives. The bundled catalog still plays first and offline.
- **Share links that bring people to the app.** A shared clip now opens a page
  on the frontier go website that plays it in any browser, with its credit
  line, a per-clip link preview and an App Store button. Links used to point at
  the agency's own page, or at `frontier.go`, which is not a domain.
- **A website**, on GitHub Pages at `hobogoblin45.github.io/frontier-go`:
  landing, privacy, support, the catalog, and one pre-rendered share page per
  clip, rebuilt and verified by `deploy-site.yml` whenever the site or catalog
  changes.
- **Profile → About**: share the app, support, privacy policy, terms of use,
  rate on the App Store, and a plain statement that frontier go is not
  affiliated with or endorsed by NASA or NOAA.
- `addedAt` on catalog items, carried forward by the ingest from the catalog it
  replaces, so "new" means new and the launch set is never all "new".

### Fixed

- **Titles written for filing systems.** 106 titles were file names
  (`Apollo_11_Intro_720p`, `iss060m262481254_Hurricane_Dorian_Live_Views_...`),
  shouted in capitals, wrapped whole in quotation marks, or — in one case — the
  entire description glued onto the title. 241 NOAA descriptions ended in a
  literal `&#8230;`. All cleaned at ingest by `core/catalog/text.ts`, with each
  rule traced to the titles it was written for; an ordinary title is left
  exactly as it was.
- **The NOAA emblem was being used as artwork.** About one NOAA poster in five
  is the agency's title card — the emblem on black — not a frame of the dive.
  It was appearing as collection covers, lock-screen art, the letterbox
  backdrop and link previews, and the emblem is a registered mark that may not
  be used as a branding device. The ingest now looks at every NOAA poster and
  flags the 75 title cards; nothing that shows artwork uses them.
- **Talking heads that slipped through.** "Meet NASA Astronaut...", in-flight
  media events, "...Answers Student Questions", and captions that say someone
  "sat down to explain" are now caught.
- The onboarding footer read "Nature · Science · People". It now says what the
  app is: free, no account, no ads.
- The web player shows the agency's frame while a clip loads instead of black.

### Changed

- The Vercel landing-page workflow is replaced by `deploy-site.yml` (GitHub
  Pages). The Trailer Roulette site on Vercel is left untouched.
- Catalog: 1,634 items, 104 hours.


## [4.1.0] — 2026-09-22

### Added

- **Nearly three times the catalog: 1,647 items, 107 hours.** Was 581 items and
  30 hours, of which 76% was deep ocean, so the third shuffle already felt like
  the second. Deep ocean is now 22% of the catalog and no environment holds more
  than a quarter: 364 deep ocean, 342 in orbit, 184 further out, 159 under test,
  108 lunar, 89 wild earth, 86 polar, 70 on the pad, 44 volcanic, 43 martian,
  39 on station.

- `launch_site` as an environment, shown as "On the pad". Stacking, rollout,
  countdown and liftoff are a different place from a clean room and were
  previously either mislabelled or unlabelled.

### Fixed

- **The NASA query set was matching almost nothing.** NASA's search ANDs every
  term, so the descriptive phrases this list was written in collapsed on
  contact: "Hubble Webb telescope imagery" matches 0 videos, "Hubble" matches
  165; "Falcon Atlas Delta launch" matches 0, "Atlas launch" matches 272. 31 of
  70 queries returned nothing at all. Rewritten as 96 one- and two-word queries,
  every one measured against the live endpoint before it was added. NASA went
  from 139 items to 1,196.

- **The harvest only ever read the first page.** Each query contributed at most
  one page of candidates regardless of how many matched. It now walks pages
  until the query is drained, and resolves each item's two asset requests with
  bounded concurrency rather than serially.

- **A NASA centre is where an asset is FILED, not where it was shot.**
  `AVAIL:Location` names the holding centre, and reading it as a position put
  296 items on a pin in Greenbelt, Maryland — Hubble servicing spacewalks, Webb,
  lunar orbiter data, Greenland ice flights, a desert field test — making
  Goddard Space Flight Center the largest place on the globe by a factor of two.
  The address now stands only where the footage is plausibly at the facility: a
  clean room, a test stand, a pad. Off Earth it becomes a mission location; on
  Earth it keeps no coordinates at all. Goddard is down to 8 items and the globe
  reads Atlantic Ocean, Pacific Ocean, Gulf of Mexico, Papahanaumokuakea,
  Mariana Region, Puerto Rico Trench.

  The title is also read before the metadata now, because the title describes
  the footage and the metadata describes the filing cabinet.

- **Two out of five items were "Somewhere else".** The environment classifier
  had no rule for most of what the wider harvest brought in, so 39% of the
  catalog landed on `unknown`. The material was not mysterious — it was
  spacecraft being stacked, encapsulated and rolled out, servicing EVAs, and
  experiments on the station. Rules written against the titles that actually
  landed there bring it to 7%.

- **The talking-head filter was eating the subject.** Cues were read from
  descriptions as well as titles, so "Dr X talks about the armored searobin"
  was classified as a person on camera and the fish was discarded, along with
  "Meet the CTD", "Nereus", "Discovery of a Ferromanganese Nodule Field" and a
  run of other discovery clips. Format cues are now read from the title, which
  names what a piece is; only unambiguous ones (press conference, briefing) are
  read from anywhere. A bare `panel` cue was also taking "Orion Crew Module Cone
  Panel" — real hardware footage — and is now `panel discussion`. Safety
  rejections fell from 358 to 143 with no loss of actual talking heads.

- The health pass probed streams one at a time, which does not survive a
  catalog this size in CI. Probes now run eight at a time; the fold stays
  sequential so ordering, counters and the rejection log are unchanged.

### Changed

- The shipped-catalog guard now asserts a real floor — 1,200 items, 80 hours,
  no environment above half, `unknown` below 15% — rather than "more than 50".
  It caught a truncated dry run during this work, which is the point of it.
- Scheduled ingest raised from 900 items per provider to 4,000.


## [4.0.3] — 2026-09-22

### Fixed

- **The interface was sitting on the picture.** The player fits the frame
  inside whatever rect it is given, and it was given the whole screen. A 16:9
  clip centred in an upright phone therefore lands exactly where the title, the
  place and the transport are drawn — so the reading matter sat on the footage,
  and on NOAA material directly on top of the expedition card burned into the
  opening seconds of the clip. Two titles in two typefaces, overlapping.

  `Watch` now measures its own chrome and reports it to the player, which
  insets the picture to match: picture above, reading matter below, never both
  in one place. When the chrome idles out the insets go to zero and the picture
  takes the whole screen, which is the point of idling.

  Measured, not assumed — the block's height depends on how long the title
  wraps, whether there is an accuracy note, the safe area and the orientation.
  The measurement runs from the block's **top edge to the bottom of the
  viewport**, not the block's own height, because the tab bar sits below it over
  the same plane; subtracting the block alone would leave the frame overlapping
  the bar by exactly the bar's height.

  Verified in Chromium at 430x932: chrome visible → picture `0–448`, chrome
  block starts at `448`, zero overlap; chrome idle → picture `0–932`.

- **The web video ignored its bottom inset.** A `<video>` is a replaced
  element: with `height: auto` the used height is the *intrinsic* height and the
  `bottom` offset is discarded as over-constrained, so the element stayed at its
  default 300x150 while every number involved looked correct. It now carries an
  explicit `calc()` height. Caught by measuring the live element rather than
  trusting the stylesheet.

### Added

- `setVideoInsets` on the player contract, implemented natively against the
  layer's constraints and on the web against the stage's custom properties.
- `chromeInset`, extracted so the arithmetic is testable, with seven cases
  covering the tab-bar near-miss, idle, rotation and the degenerate inputs.


## [4.0.2] — 2026-09-22

### Fixed

- **4.0.1 was never released.** The release workflow reported success for a
  build that does not exist. `xcrun altool --upload-app` hit

      RETRIEVE UPLOAD OPERATIONS (ASSET_UPLOAD): received status code 502;
      bad gateway. (HAMJOEHVQUGHNZETHTV6CKXEVA)

  printed Apple's HTML error page, and **exited 0**. The job went green, the
  tag looked shipped, and App Store Connect's newest build stayed 4.0.0 (74).
  The fix was tested against the build it was meant to fix and appeared not to
  work, because the tester was running the old one.

  The upload step now captures altool's output, treats Apple's transport
  errors as failures whatever the exit status claims, and retries three times.
  A new step then asks App Store Connect whether the build with this
  `CFBundleVersion` actually exists, polling for up to ten minutes, and fails
  the release if it never appears. A green release run now means a delivered
  build.

- **The video surface was living inside the web view.**
  `CAPBridgeViewController.loadView()` ends with `view = webView`, and the
  method is `final`. The bridge's "view controller view" is therefore the
  `WKWebView` itself, so attaching the player surface to it put the
  `AVPlayerLayer` inside WebKit's own view hierarchy — under a view whose
  ordering, clipping and compositing WebKit owns and can redo at any time,
  with nothing in our code able to notice.

  The surface is now mounted one level up, as a sibling of the web view in the
  window and ordered below it: the same pixels, with nothing of ours inside
  WebKit. It falls back to the old position only while the window does not
  exist yet, and is re-mounted from the same points that re-assert
  transparency.

- **The player could end up holding no web view at all.** `attach()` read
  `bridge.webView` once and kept whatever it got. Capacitor does not guarantee
  that is non-nil at that moment, and when it was nil the engine held a nil
  reference for the life of the process: every later attempt to make the web
  view transparent returned at its guard, so the interface stayed an opaque
  sheet over the video with no path back and nothing recorded. A web view that
  turns up late is now adopted.

### Added

- `webViewBound` and `surfaceDetached` in the player diagnostics, with
  matching rows on the Profile screen. "Bound but opaque", "never bound" and
  "mounted inside WebKit" are one symptom on a phone and three different
  fixes; the screen now names which one.

- `.github/scripts/verify-build-uploaded.mjs` — signs an ES256 App Store
  Connect assertion with Node's own crypto, no dependencies, and fails the
  release unless the build is really there.

## [4.0.1] — 2026-09-22

### Fixed

- **The interface was covering the video.** On device, 4.0.0 (74) played sound
  with a white screen; the picture only appeared in Picture in Picture, which
  is its own render path. The player layer was working the whole time — the web
  view above it was opaque.

  `isOpaque = false` and a clear `backgroundColor` are not sufficient on iOS 15
  and later. `WKWebView.underPageBackgroundColor` is a third surface: WebKit
  paints it *behind* the document, derives it from the page, and defaults it to
  white. A page with a transparent `html` background still gets an opaque
  under-page colour, so the web view stayed a white sheet over the video
  regardless of the CSS.

  All three are now set, and re-set: at attach, at five points across the
  launch window, on every app activation, and on every `load`. Capacitor
  configures the web view during its own view lifecycle, which can run after
  the plugin's does, and WebKit re-derives the colour when the first document
  paints — one application at attach time was what made this look fixed in a
  compile and broken on a phone.

### Added

- **Profile → Diagnostics → Video surface.** Reads `transparent · video
  visible` or `OPAQUE · the interface is covering the video`. This failure is
  invisible to every gate that does not involve a screen — it compiles, it
  passes every test, it plays audio — so it now has a line of its own next to
  the native-player check.

## [4.0.0] — 2026-09-21

### frontier go

Trailer Roulette is now **frontier go**: a continuously playing window into
extraordinary places on Earth and beyond. Deep-ocean ROV dives, hydrothermal
vents, rocket engine tests, Earth from orbit, spacewalks, Apollo and Mars —
from NOAA Ocean Exploration and NASA.

The product idea that worked is unchanged: open it, something is playing, tap
Shuffle, you are somewhere else, no decisions required. What changed is the
foundation underneath it. The full audit, the migration classification and the
decisions taken are in `docs/FRONTIER-GO-MIGRATION.md`.

### Added

- **Native AVFoundation playback** (`local-plugins/frontier-player`). An
  `AVQueuePlayer` on an `AVPlayerLayer` hosted behind a transparent
  `WKWebView`, so the React interface floats over the footage. Owns the queue,
  buffering, errors, AirPlay, Picture in Picture, the audio session, Now Playing
  and the remote command centre. Next = Shuffle on the lock screen.
- **Instant Shuffle.** The next item is handed to the native queue the moment
  the current one starts, so a tap is an advance onto an already-buffering
  asset. Measured 85-112 ms perceived latency in the browser harness.
- **Rights as first-class data.** Every item carries a classification, a
  commercial-use flag, a credit line, the publisher's terms URL and the basis
  for the decision. The gate fails closed: `unknown` is a rejection. It runs in
  the pipeline and again on the client.
- **Safety model.** Structured flags for graphic, disturbing, explicit,
  military and identifiable-person content, plus uncertain rights. Any flag
  excludes the item from the default feed.
- **Honest geography.** Locations carry an accuracy (`exact`, `approximate`,
  `region`, `mission`, `unknown`) and a stated `coordinateSource`. Region
  reference points are labelled as such in the UI and never presented as
  positions. Depth is parsed only where the provider wrote it down.
- **The Frontier Globe.** A Three.js Earth drawn from Natural Earth 110m
  coastlines (public domain, 55 KB, rasterised at runtime — no basemap to
  license or download), with atmosphere, stars, inertial rotation, pinch zoom,
  content markers, visited places, clustering by size, and a camera that flies
  to a selection. Rendering pauses whenever the globe is off screen.
- **Weighted shuffle engine.** Quality, freshness, novelty, session diversity,
  geographic contrast and environment contrast, drawn without replacement, with
  each pick becoming the reference point for the next — so a deck is a route
  rather than a bag. No session repeats until the universe is exhausted.
- **Keep Exploring Here / Go Anywhere.** A temporary narrowing to an
  expedition, mission, region, radius, environment or tag. Two buttons, no
  filter interface.
- **Discovery Passport.** Places visited, saved discoveries, visit counts and
  dates. No points, streaks or badges.
- **Ambient mode.** Everything but the picture disappears and it keeps playing.
  Built for a television.
- **Catalog pipeline** (`npm run ingest`, weekly in GitHub Actions). Fetch,
  normalise, rights-validate, safety-filter, quality-filter, deduplicate, HEAD
  every stream, commit. Publishes `docs/CATALOG-REJECTIONS.md` on every run.
  581 items at this release, from two providers.
- **Shipped-catalog guard** (`shipped-catalog.test.ts`). Re-runs every gate
  against the committed catalog in CI and in the ingest workflow before it
  commits, so a regenerated file cannot smuggle anything through.
- **TypeScript**, a `typecheck` gate in CI and in the release workflow, and
  TypeScript-aware ESLint.
- **Design system** from the approved board: seven colours as semantic tokens,
  Playfair Display and Inter, and a motion vocabulary built around travel.
- **New icon set and launch screen**, rendered from
  `assets/icon-master-1024.svg`.
- Deep links (`frontiergo://discovery/<id>`) and share payloads that carry
  identity and provenance, never a copy of the media.

### Removed

- **YouTube, entirely.** The `trailer-player` plugin (2,013 lines of Swift
  around a modal `WKWebView`), the `/embed` Vercel Edge Function, the
  `endDetection` mirror, the ad watchdog and the heartbeat. `AVPlayerItemDid
  PlayToEndTime` replaces all of it. With it go the pre-roll between every
  shuffle, the unreliable AirPlay and the App Review wrapper risk.
- TMDB, the movie metadata layer and `VITE_TMDB_API_KEY` — including the
  secret check in `ios-release.yml`, which would otherwise have failed every
  release for a key nothing reads.
- Theater Mode and the Alamo Drafthouse adapter.
- The six fun modes, the watchlist, the movie sheet and the filter sheet.
- The `airplay-plugin` — AirPlay is part of the player now, not a bolt-on.

### Preserved

- The GitHub Actions release pipeline, unchanged in shape: tag push, macOS
  runner, signed archive, TestFlight. Still no Mac required.
- The bundle identifier `app.trailerroulette.ios`, deliberately. Changing it
  would mean a new App Store record, new signing assets and a first review from
  zero. See `docs/FRONTIER-GO-MIGRATION.md` §7.
- The Capacitor shell, the committed Xcode project, the storage, haptics and
  error-log abstractions, the safe-area CSS and the icon render pipeline.

### Fixed during the build

- **Globe canvas resize feedback loop.** Without an explicit CSS size the
  canvas's backing store drove its layout box, which fired the ResizeObserver,
  which resized the backing store. It reached 4,915,200 x 2,457,600 px in
  headless testing.
- **`crossOrigin="anonymous"` on the web `<video>`** turned a plain media fetch
  into a CORS request; neither provider CDN sends `Access-Control-Allow-Origin`,
  so every clip failed in the browser while working on device.
- **Screens at `height: 100%`** pushed the tab bar past the bottom of the
  viewport, where it was present and unreachable.
- **Word-boundary matching in the gazetteer.** A Stennis engine test was filed
  as "Low Earth Orbit" because `iss` is inside `mission`.
- **Gazetteer ranking** now picks the entry whose *matching* token is longest,
  not the entry whose longest declared token is longest — which had put
  anything mentioning Mars into Earth orbit.
- **NOAA pagination** stopped early on a short page; that endpoint returns 91
  rows for `per_page=100`, and the early exit cost most of the catalog.
- **NASA asset URLs** arrived as `http://` with raw spaces, which AVPlayer
  rejects outright.
- **Rights markers in NASA filenames.** `..._Music_Artemis logo_...` says the
  piece carries licensed music and branding and appears in no metadata field.

## [3.4.3] — unreleased (held until P1 playback verification passes)

**Decade + genre filters.** The Everything feed can be narrowed to chosen
decades and genres (v3.4.3). NOT for release until the v3.4.2 auto-advance
fix has passed its on-device P1 test (three trailers chaining with zero
taps) — see docs/HANDOFF.md §7 and docs/bugs.md B4. Filters live in
`src/components/FiltersSheet.jsx`, persist via `storage.KEYS.FILTERS`, and
shape the queue through `filtersQuery`/`discoverMovies` in `src/lib/tmdb.js`.

### Added
- **Filter sheet** (Filter pill in the top bar): multi-select decade chips
  (1970s through the current decade, played as one contiguous range) and
  multi-select genre chips (OR semantics via TMDB `with_genres`). A live
  summary line shows what the roulette will draw from. Clear and Apply
  actions; Apply rebuilds the queue from scratch.
- **Filtered queue build**: with a filter active, the Everything feed draws
  three parallel random deep pages from the filtered TMDB discover catalog
  (vote floor relaxed to 50 for sparse niches) instead of the era-diverse
  mix. An empty result falls back to the unfiltered mix rather than
  stranding the channel — the Filter pill stays lit so the user can widen.
- Filters persist across launches and apply to the Everything channel only
  (a tuned theater keeps its own finite lineup; the fun modes bring their
  own selectors).
- Tests: `filtersQuery` (decade range collapse, genre OR, sanitisation),
  `discoverMovies` filter params, `catalogDecades` (13 new, 184 total).

### Notes
- Product copy updated: the app is now "optional filters, no accounts, no
  algorithm" — the "no filters" thesis is retired by owner decision.

## [3.4.2] — 2026-08-16

**The missing event.** Trailers have played to their end and stopped on
YouTube's replay screen since v1.x, through five releases. Root cause, proven
live against real YouTube: the Vercel proxy page only ever sent the IFrame
API's `{ event:'listening' }` message. That arms the player but never asks
YouTube to *report* its state — `onStateChange`/`onError` are only delivered
after an explicit `addEventListener` command. Without it, the widget's state
channel is silent for the whole clip (while `infoDelivery` keeps streaming, so
every liveness and end-detection timer believed the page was healthy), and the
`ENDED` event every end-detection mirror waits on never arrives. Five releases
relocated the failure (ad-aware end detection, heartbeats, pins, playlist
handoff) by retuning consumers of an event that never reached the page.

### Fixed
- **The proxy now subscribes to player events** (`landing-page/api/embed.js`):
  sends `addEventListener('onStateChange')` + `addEventListener('onError')`
  when the player announces itself ready — the moment proven live to accept
  the subscription — with one retry at +2s if no state event has arrived (a
  landed subscription delivers its first state event within ~1.5s; the same
  2s of silence also means the send failed). The subscription is player-level
  and survives `loadVideoById` (`trLoad`), so swaps never double-subscribe.
  This makes the real `ENDED` reach every existing end-detection path in the
  proxy — and because the proxy is the only layer that reaches
  already-installed builds, **deploying it fixes the v3.4.1 build already in
  TestFlight without a new app build**. Initial v3.4.2 anchored the send at
  iframe-load, which the widget may drop before it finishes booting; the send
  is anchored to `onReady` instead (see docs/bugs.md B4).
- **Native playlist handoff disabled** (`TrailerPlayer.swift`). v3.4.0 handed
  the queue to YouTube via `loadPlaylist`. Live observation showed the widget
  accepts it and advances between items on its own, but fires **no `ENDED`
  between playlist items** (boundary sequence is `-1 → 3 → 1`), so
  `playlistDidAdvance()` could never run and the queue/chrome would desync;
  batch-exhaustion behaviour is unverified. The proven path (end detection →
  `advanceInPlace` via `trLoad`, or `finish` → JS reopens) now has its input
  event and works without the playlist. Code kept as documented post-mortem;
  re-enabling requires solving item-boundary sync (docs/bugs.md B4).
- Proxy behaviour tests now cover the subscription contract (4 new tests,
  171 total).

### Notes
- **Charlie must redeploy the proxy** for any of this to reach a phone:
  `cd landing-page`, `vercel login`, `vercel --prod`. This is the fix that
  actually changes playback on installed builds.
- v3.4.2 then goes to TestFlight via the usual tag push; P0 (plugin bridge
  confirmed) is still to be eyeballed on device once 3.4.2 appears there.

## [3.4.1] — 2026-08-14

**The native plugins were never registered.** Everything below explains why the
whole day's work had no visible effect on device.

### Fixed
- **`TrailerPlayer` and `AirplayPlugin` did not conform to `CAPBridgedPlugin`.**
  Both were written in the Capacitor 5 shape — `@objc(Name)` plus a `CAPPlugin`
  subclass with `@objc` methods, and in AirPlay's case a comment claiming the
  `CAP_PLUGIN` macro handled registration. Capacitor 6 removed automatic plugin
  registration. Its bridge binds only `CAPPlugin & CAPBridgedPlugin`
  (`CapacitorBridge.swift`, which logs "Plugin must conform to
  CAPBridgedPlugin"). This project runs Capacitor 7, and every official plugin
  in `node_modules` conforms. Neither local plugin did.
  Consequences, all silent:
  - `registerPlugin('TrailerPlayer')` resolved to its **web fallback**, which
    does `window.open('youtube.com/watch?v=...')`. So the native modal, the
    glass chrome, end detection, chaining, the poster stage, the progress bar
    and the playlist handoff never ran — on device the app opened YouTube's own
    watch page. That page is what every "it just shows a replay button"
    screenshot was actually showing.
  - The Vercel proxy was never loaded either, which is why redeploying it would
    not have helped.
  - `AirplayPlugin` resolved to a fallback returning `{ presented: false }`, so
    the AirPlay button did nothing. Both buttons of a two-button app were dead.
  Both classes now conform and declare `identifier`, `jsName` and
  `pluginMethods`.
- **The iOS web fallback now throws instead of degrading silently.** Falling
  back is what `registerPlugin` is designed to do, and it is right on the web —
  but on iOS it meant a total failure of the app's core looked like a trailer
  playing. It cost a full release cycle to spot. A visible error with a retry is
  worth more than a silent degradation.

### Note
Every native change from 3.2.1, 3.2.2, 3.3.1 and 3.4.0 is reaching a device for
the first time in this build. They compile and their logic is unit-tested, but
none of it has ever executed on hardware, so treat this build as the first real
test of all of it rather than a small patch on top of tested work.

## [3.4.0] — 2026-08-14

Stops reimplementing something YouTube already does.

### Changed
- **YouTube's player now sequences the queue itself.** Every version up to 3.3.2
  detected the end of each trailer and loaded the next one by hand. That meant
  rebuilding, on top of signals YouTube deliberately keeps ambiguous, the one
  thing its player does natively — and it is why six releases of end-detection
  work kept relocating the failure instead of removing it. The screenshot that
  finally settled it showed YouTube's own end screen and replay button, with
  the app waiting for an event to tell it what had plainly already happened.
  The queue is now handed to the IFrame player via `loadPlaylist`, and YouTube
  moves between trailers on its own: no end screen, no replay button, no
  closing and reopening the modal, no cold page load between videos.
  It is injected straight into the existing iframe, which already carries
  `enablejsapi=1`, so it needs no change to the deployed proxy.
  Ends are still detected, but only to keep the app's chrome and queue in step
  with what YouTube is showing, and as the fallback when a batch runs out. If
  the handoff does not take, a 4s timer restores the old advance path, so this
  can be late but cannot dead-end.
- Prefetch reaches 8 trailers ahead rather than 3. Every key ready when the
  player opens is one more trailer that plays with no gap.

### Removed
- **The auto-hiding player chrome.** A 3.2.2 idea that read well and was wrong
  on a device: by the end of a trailer the app's Done, Skip and mute had all
  faded out, so the only thing on screen was YouTube's end screen. The app was
  handing the display to YouTube at exactly the moment it needed to be in
  charge. Controls stay up.

## [3.3.2] — 2026-08-14

Does the one thing that was actually asked for: press Play once, and it keeps
going by itself.

### Removed
- **Launch autoplay.** 3.3.0 read "auto play the video when it loads" as "open
  the app straight into a full-screen player". That was the wrong reading. What
  was wanted was for playback to CONTINUE without a tap, not to START without
  one — and the automatic launch just put a loading screen between the user and
  the app. The app opens on the stage again; Play starts it.
- The first-run hint no longer gates anything. It is a plain first-launch
  overlay now, so it cannot block playback if anything about it goes wrong.

### Fixed
- **Continuous playback no longer depends on catching an edge.** The reopen
  after a trailer finished was edge-triggered on the current trailer's key
  changing. Every way that edge can be missed looks identical to the user: the
  player is closed, the session is still live, nothing reopens it, and they
  press Play again for the next trailer. That one symptom outlived every other
  fix in this app, and reasoning about the individual races kept failing to
  remove it.
  It is now level-triggered instead: a 1.2s poll reopens whenever a session is
  active, no modal is open, and a real key exists. It cannot fight the user —
  deliberately closing the player clears the session — and it cannot double-open,
  because the open path bails while one is already in flight. Worst case a
  reopen lands up to 1.2s late, against a previous worst case of stopping dead
  until tapped.

## [3.3.1] — 2026-08-14

Fixes the bug 3.2.1 introduced: trailers stopped advancing at all.

### Fixed
- **Every trailer stalled on YouTube's replay screen at its end.** 3.2.1 made
  the native player require a pinned content duration before it would confirm a
  trailer or fast-path its end. That pin only arrives from the 3.2.1+ proxy —
  and the deployed proxy is still 3.1.0, so on real devices the answer was
  permanently "not confirmed". Every trailer therefore took the full 5s
  pre-content window at its end, and YouTube fills those five seconds with its
  own replay button, which is what users were tapping. The app looked like it
  needed a manual press for every single video.
  This is the same mistake 3.2.1 was written to fix, made in the other
  direction: shipping logic that depends on a deploy that has not happened.
  Refusing to decide is not the safe option when the cost of not deciding is
  the app visibly stalling on every trailer.
  There is now an unpinned fallback in all three mirrors, with a much higher
  bar than the one 3.2.1 removed: 65 seconds rather than 32. A clip whose own
  duration runs past a minute is not pre-roll — YouTube's inventory is 6s
  bumpers through 30s spots, and the long skippable ones get skipped at 5s. The
  45s ad that 3.2.1 was protecting against still fails this test and still gets
  the conservative window. Both halves are asserted by tests, and the native
  half was compiled and run.
- **The first-run hint could permanently block autoplay.** Dismissing it was
  the only path that armed autoplay on a first launch, so a hint that failed to
  render its close control would leave the app sitting there forever. It now
  gives up after 15 seconds. A hint that goes wrong should degrade to "no
  hint", never to "no playback".

### Note on the proxy
With this release the Vercel proxy redeploy is an enhancement rather than a
requirement — the app is correct against the 3.1.0 proxy that is live today.
Deploying still improves the liveness watchdog and lets the pin do its more
precise job.

## [3.3.0] — 2026-08-14

The app now starts playing on its own, and a trailer you like is no longer a
dead end. Deliberately a zero-Swift release: everything here is JavaScript, so
nothing shipped that could not be verified before it left the machine.

### Added
- **Autoplay on launch.** The app opens straight into the full-screen player
  once the first trailer has a real YouTube key. No tap between launching and
  watching.
  Three properties this had to hold, and does: it waits for an actual key (the
  queue loads before keys are prefetched, so `current` exists for a while
  carrying nothing); it fires exactly once per launch, via a ref that latches
  synchronously before any state update, so a re-render or React StrictMode's
  double-invoke cannot repeat it; and it can never reopen a player the user
  deliberately closed, because the latch is set before a player can exist and
  `cancelAutoplay()` covers the remaining window where someone taps Play before
  the first key lands. It routes through the existing `playSignal` rather than
  adding a second way in, so it cannot collide with the continuous-playback
  reopen path.
  Returning from the background is deliberately NOT symmetric: the app stays
  paused, because the native session is over and auto-resuming would make the
  Play button lie and skip a trailer that was never seen.
- **The mute setting is remembered** across launches, so autoplay never
  surprises you the same way twice. Defaults to unmuted; a silent trailer is
  not a trailer.
- **About this movie** — a new sheet off the now-playing card, built around
  facts drawn strictly from real TMDB fields: director and writers, top-billed
  cast, adaptation source, collection, runtime, rating with a vote floor so a
  10.0 from three votes cannot show up, original language and title, box office
  against budget, credits-scene stingers, tagline and themes.
  Nothing here is generated. Every fact traces to a field; when a field is
  absent the app says nothing rather than guessing. There is a test asserting
  the output can never contain reunion claims, "filmed in" language, or a
  computed profit figure, because none of those are supported by the data.
- **Save and Share.** The watchlist storage key had existed unused since v2.x
  and `@capacitor/share` had been a dependency that nothing imported. Both are
  now real.
- **Where to watch** — streaming, rent and buy availability, with the JustWatch
  attribution TMDB requires for that data.
- **Get tickets** on Theater Mode, where a real showing is known to exist. The
  affiliate id is a single exported constant, so switching from a plain search
  link to an earning one is a one-line change once the programme is signed up
  for.
- **First-run hint.** Autoplay means a new user never sees the home screen, so
  the first launch shows a short overlay naming the two buttons and pointing at
  the Theaters and Modes pills; dismissing it starts playback. Every launch
  after that goes straight to the trailer.

### Changed
- The now-playing card is a real control rather than inert text: button role,
  44pt target, accessible name, and a visible disclosure affordance.
- `getMovieDetails` fetches credits and keywords in the same request instead of
  three round trips. Signature and cache behaviour unchanged.

### Testing
164 vitest (69 new, covering the facts builder and the watchlist against empty
payloads, zero budgets, low vote counts, missing crew, corrupt stored JSON,
dedupe and the size cap), eslint clean, `vite build` green. Test fixtures use an
invented film so no assertion can accidentally state something false about a
real one. `TrailerPlayer.swift` is byte-identical to v3.2.2.

## [3.2.2] — 2026-08-14

A UI audit of the whole app, and a pass on making the native player feel like a
real Apple video player rather than a web view in a modal.

### Changed — the native player
- **The player no longer opens onto a black screen.** It presented onto pure
  black with a bare spinner for the 2-3s the proxy page takes to load, throwing
  away the artwork the user was already looking at. The movie's backdrop now
  sits over the player while it loads and dissolves away the instant anything
  starts playing. It retires on the FIRST playback of any kind, including a
  pre-roll ad — holding it over a running ad would be blocking an ad, which
  YouTube's Developer Policies §III.I.5 forbids. A 6s backstop covers the case
  where an old proxy reports no playback signal at all.
- **Swipe down to dismiss**, with rubber-banding, corner-radius growth and a
  velocity threshold — the single most universal signal that a full-screen
  video player is native. Presentation is now `.overFullScreen` with a
  cross-dissolve, so the drag reveals the roulette stage underneath instead of
  a void, and the player dissolves into the artwork it came from.
- **The chrome auto-hides** after 3s and returns on tap. It can never be both
  hidden and the only way out: the swipe gesture works regardless, and the
  chrome stays pinned while loading or showing an error.
- **A real progress bar**, fed by the `t`/`d` values the proxy heartbeat was
  already sending, animated between samples so it glides. It stays hidden until
  content is confirmed, so an ad's clock never drives it.
- Title cross-fades instead of snapping when chaining trailers; soft haptic on
  advance, light on Skip. Skip is now an SF Symbol matching the mute glyph.

### Fixed — clunky UI across the app
- **Every sheet and panel vanished with no exit animation** — they animated in
  over 340ms and then unmounted on the same frame as the tap, which contradicts
  the stylesheet's own stated rule that "nothing fades without moving". A
  shared `useDismissAnimation` hook now plays a real exit for the fun-mode
  sheet, all six modes, the theater picker and the About screen.
- **Cinema Mode could strand you.** Its error state was dead code — nothing
  ever set it — so a sustained TMDB failure left an infinite "Tuning the
  channel…" spinner, and the close button faded out after 4s idle, leaving no
  visible way out. The error state is now real with a working retry, and the
  close button is permanently exempt from the chrome fade.
- **The crash screen could loop forever.** `ErrorBoundary` auto-reset every
  2.5s with no counter, so a persistent fault cycled crash → black flash →
  crash indefinitely. Recovery is now budgeted (3 attempts / 60s) before
  offering a real dead end with a prefilled report. It is also styled in the
  app's own design language instead of looking like a different, broken app.
- **Reduce Motion was silently defeated app-wide.** A universal `!important`
  rule out-ranked every per-component override, so five of the six modes' tuned
  spinners were clobbered into a flicker. The rule now respects component
  intent via a `motion-safe-exempt` escape hatch and actually stops infinite
  animations.
- **Tapping Play gave no feedback** in an app whose entire UI is two buttons:
  the "Opening…" label was hidden by `display: none`. The stage now shows a
  spinner and caption on the tap frame.
- Removed the duplicate Play control on the main stage (the bottom pill is the
  app's identity). It is kept inside the fun modes, which have no pill and
  would otherwise have no way back into a dismissed player.
- Raw internal errors are no longer shown to users — `NSError` text and TMDB
  failure strings were rendered verbatim. Fixed copy, with a retry action.
- Theater picker: a clear button in search, keyboard dismissal, skeleton rows
  so the sheet stops ballooning mid-interaction, truncation on the subtitle
  line, honest "Near me" state, real swipe-to-dismiss on the grabber, and
  separate no-results and no-data states.
- Tap targets: `.feat-close` (the only exit from all six modes) and the Guess
  the Year slider thumb were both under the 44pt minimum the app itself
  defines. Fixed without changing their visual size.
- Six mode stylesheets converged on the shared radius and spacing tokens (they
  used none), and on the 0.25-0.35s spring motion budget (Cinema Mode ran every
  chrome transition at 480ms `ease`). Dead rules removed.
- Accessibility: focus-visible rings app-wide, `aria-modal` and focus trapping
  on all seven overlays, Escape to close, a valid ARIA structure for the bingo
  grid, and consistent poster alt text.

### Testing
95 vitest, eslint clean, `vite build` green. The native end-detection logic was
re-extracted verbatim and re-run under Linux Swift after the UI changes — all
checks still pass, including a new one asserting the poster backdrop cannot
outlive the first ad frame. `TrailerPlayer.swift` is syntax-checked only; CI is
the compile gate.

## [3.2.1] — 2026-08-14

Trailers were still being cut short. 3.2.0 identified the cause correctly but
its cure had three holes, all the same mistake: relying on `onStateChange` in a
bug whose defining symptom is that `onStateChange` does not fire. 3.2.0 was
never tagged or released, so 3.2.1 is the first release carrying either.

### Fixed
- **The 3.2.0 fix could not reach a single installed app.** The liveness signal
  it added is the `{kind:'hb'}` heartbeat, which only a 3.2.0+ native build
  understands. Every phone in the wild runs 2.11.0 (App Store) or 3.1.0
  (TestFlight), and those cancel their 12s "no PLAYING = unplayable" watchdog on
  exactly one message: a `stateChange:1`. During a silent pre-roll ad the proxy
  sent them nothing they understood, so redeploying it changed nothing — the
  fix needed a new build through App Review to have any effect.
  `landing-page/api/embed.js` now announces live playback as a `stateChange:1`
  (tagged `syn:true`) the moment playback demonstrably advances. That is the
  vocabulary every shipped build already speaks, so **`npx vercel --prod` now
  fixes phones that are already out there**. Having silenced that watchdog the
  proxy takes on its job: if nothing ever plays it emits `{kind:'error'}` at
  75s, so no build can hang on a black screen.
- **A silently-starting ad or trailer produced a false advance.** The
  resume-confirm timer could only be cancelled by a `stateChange` 1/3. When the
  next ad in a pod — or the trailer itself — started without one, nothing
  cancelled it, the page forwarded a false ENDED, and native skipped the trailer
  a few seconds in. Forward playback progress now cancels a pending end in all
  three mirrors. A genuinely ended video cannot: its `currentTime` stops
  advancing, which the new 0.25s progress epsilon tests for.
- **An ad's duration could be pinned as the content's.** The pin accepted any
  duration seen before a PLAYING state — which, for exactly the ad variants at
  issue, is the ad's own duration. A wrong pin is worse than no pin: it makes
  the ad look like the trailer and lets the ad's end fast-path a false advance.
  The proxy now pins only from `initialDelivery` and only before anything has
  played; `Player.web.jsx` additionally requires an untouched playhead and stops
  trying 2.5s after `onReady`.
- **"Long enough to be content" was not a safe test for content.** Confirmation
  and the end fast-path treated an unpinned clip past 32s as the trailer, which
  a 45s unskippable ad satisfies just as well — shortening the confirm window
  below a typical ad-pod gap and unlocking the fast-path at the ad's own end.
  Both now require a pin. Unpinned, a real end is reported via the 5s window
  instead of instantly: later rather than wrong.
- **The native 75s hard cap could dismiss a playing trailer.** It fired on
  elapsed time alone, so an ad variant that never reports PLAYING would have a
  visibly-playing trailer torn down mid-flight. It now also requires playback to
  have been frozen for 20s.

### Testing
- `app/src/lib/__tests__/embedProxy.test.js` (new, 17 tests) renders the real
  Edge Function, lifts its `<script>` out verbatim and runs it against a fake
  DOM, fake YouTube iframe and virtual clock — so the deployed artefact's
  behaviour is asserted, not a re-implementation of it. All 7 of the defects
  above reproduce as failures against the 3.2.0 page.
- 3 new detector tests (22 total); 95 vitest total, eslint clean, `vite build`
  green.
- The native end-detection logic was extracted verbatim and compiled and run on
  a Linux Swift 5.10 toolchain: 6 checks fail on the 3.2.0 logic and all pass on
  3.2.1. The full `TrailerPlayer.swift` is syntax-checked only — UIKit/WebKit
  cannot be typechecked off a Mac, so CI remains the compile gate.

## [3.2.0] — 2026-07-13

Theater Mode, plus the fix for trailers being cut off at ~13 seconds.

### Fixed
- **Trailers stopped and skipped to the next one after about 13 seconds.**
  Root cause: the native player's watchdog treated "no PLAYING event within
  12 seconds" as a dead video. Several YouTube pre-roll ad variants keep the
  *content* player in UNSTARTED while the ad runs — no PLAYING fires until the
  ad finishes — so every trailer whose ad outlasted ~12s was skipped at
  ~13s (12s watchdog + ~1s load). The v3.1.0 ad-end fix was working; the
  watchdog was the remaining ad-blind path.
  - `TrailerPlayer.swift`: the watchdog is now **liveness-based** — it skips
    on a dead page (no proxy messages within 12s), a silent player (page
    alive but YouTube never spoke within 20s), or a 75s hard cap; a live
    page serving a long ad is never mistaken for a dead video. Dead video
    IDs still skip instantly via the error event.
  - `landing-page/api/embed.js`: the proxy now emits a **1s heartbeat**
    (`{kind:'hb', state, t, d, yt, cc}`) so native can tell "alive, ad still
    rolling" from "actually dead", and pins the content's duration from
    `initialDelivery` metadata (`{kind:'meta', pin}`) before any ad plays.
  - **Hardened end detection in all three mirrors** (`endDetection.js`,
    proxy, Swift): the resume-confirm window is 5s until content playback is
    *confirmed* (≥ 3s of observed forward progress on a clip matching the
    pinned duration) then 1.2s, so slow ad-pod gaps can't fake an end; and
    the "reached the end" fast-path now also requires content confirmation +
    pin match, so a ≥ 32s unskippable ad ending at its own duration can't
    either. 9 new unit tests (19 total on the detector).
  - **Web:** the trailer-duration report to the backstop cycle timer could be
    poisoned by an *ad's* duration (first PLAYING sample), hard-advancing at
    ~13s on web too. `Player.web.jsx` now pins the content duration from
    pre-playback metadata, feeds a 1s progress poll into the detector, and
    only reports confirmed content durations; the backstop adds 45s of ad
    headroom (`TrailerRoulette.jsx`) since its countdown ticks through ads.

### Added
- **Theater Mode — tune the roulette to a real independent theater.** A new
  Theaters pill (top-left) opens a picker of Alamo Drafthouse's 23 metro
  markets, searchable and sortable by distance ("Near me", one-shot location,
  never stored). Pick one and the roulette spins ONLY that theater's live
  "Now Showing" for the current month — new releases, repertory classics,
  festival picks — with a "Now Showing · {market} · {month}" badge on every
  card. "Everything" restores the classic all-of-cinema channel. The
  two-button design is untouched.
  - `src/lib/theaters.js` — theater directory (live market feed + static
    fallback with coordinates), monthly lineup fetcher (sessions filtered to
    the calendar month, deduped, sorted by programming weight), programming-
    title cleanup ("Terror Tuesday: X", "(35mm)", "50th Anniversary" → the
    actual film), conservative TMDB matching (exact-title + year-hint first;
    unmatched films are *dropped, never faked*), 6h lineup cache. 17 tests.
  - `src/components/TheaterSheet.jsx` — liquid-glass picker sheet.
  - Queue integration: theater lineups are finite, so the reel reshuffles and
    loops when exhausted (a lobby reel, not an endless feed); the selection
    persists across launches (`SOURCE` storage key).
  - `NSLocationWhenInUseUsageDescription` added for the optional "Near me"
    sort (WKWebView geolocation; no plugin, no data retention).
  - Adding more theaters (Eventive/Agile/Veezi venues) = one directory entry
    + one lineup adapter. See `docs/THEATER-MODE.md`.

### Deploy notes
- **Redeploy the Vercel `landing-page`** (`scripts/06-deploy-vercel.ps1`) so
  the proxy carries the heartbeat + pin. The new native build degrades
  gracefully against a stale proxy (liveness falls back to ready/state
  traffic and the 75s cap), but the heartbeat makes ad handling precise —
  and the redeploy also improves ad handling for already-shipped builds.
- Alamo's schedule API is public and CORS-permissive (verified 2026-07-13);
  the app calls it directly from the device with a native-HTTP fallback. No
  server of ours in the data path, nothing to keep warm.

## [3.1.0] — 2026-07-07

Playback fix: trailers were cut off after ~15 seconds.

### Fixed
- **Trailers only played for ~15 seconds, then auto-advanced.** YouTube serves
  a pre-roll ad on many trailers, and the IFrame Player fires `onStateChange`
  → `ENDED` (0) when the *ad* finishes — before the real trailer plays. Every
  playback path treated that as "trailer over" and skipped to the next one.
  Now all three paths confirm a real end before advancing: they accept an
  `ENDED` immediately only when playback reached the video's true end
  (`currentTime ≈ duration` on a clip ≥ 32s), otherwise they wait ~1.2s — a
  pre-roll ad boundary resumes playback (state PLAYING/BUFFERING) and cancels
  the pending end, while a genuine end resumes nothing.
  - New `src/lib/endDetection.js` — a pure, unit-tested `createEndDetector`
    (progress fast-path + resume-confirm), with 10 tests covering pre-roll
    ads, ad pods, short teasers, and the no-progress fallback.
  - `Player.web.jsx` routes every state through the detector and now also
    reports each trailer's real duration (so the web backstop timer matches
    the clip instead of the old fixed 90s, which would clip long trailers).
  - `TrailerPlayer.swift` confirms the end natively (works even against an
    un-redeployed proxy), reading optional `t`/`d` progress from the proxy.
  - `landing-page/api/embed.js` tracks `infoDelivery` progress and only
    forwards a real end; backward compatible, so builds already in review get
    the fix once the proxy is redeployed.

### Deploy notes
- Redeploy the Vercel `landing-page` so the embed proxy carries the fix
  (`scripts/06-deploy-vercel.ps1`). The iOS fix does **not** depend on it — the
  native confirm covers a stale proxy — but redeploying makes real ends instant
  and fixes already-shipped TestFlight builds too.

## [3.0.0] — 2026-07-03

### Added
- **Liquid Glass player chrome (iOS 26).** The trailer player header is now
  Apple's Liquid Glass material (`UIGlassEffect`) with specular highlights and
  device-motion response on iOS 26+, and a dark frosted-blur fallback
  (`.systemChromeMaterialDark`) on iOS 15–25. Video plays full-bleed behind
  the translucent header, with a 32pt gradient fade smoothing the edge.

### Changed
- The native player now requests `controls=0`, `iv_load_policy=3`, `fs=0` on the
  embed so the glass chrome owns all controls (no double YouTube UI). The Vercel
  embed proxy forwards these params, with backward-compatible defaults so the
  in-review 2.11.0 build is unaffected.
- **Minimum iOS raised to 15.0** (was 14.0) — required by the Liquid Glass
  chrome and its blur fallback.

### Build
- Requires **Xcode 26 / iOS 26 SDK** to compile `UIGlassEffect` (runtime-guarded
  by `if #available(iOS 26.0, *)`).


## [2.11.0] — 2026-07-02

Liquid Glass redesign + a full-codebase bug-fix pass.

### Added
- **Native mute support** in the trailer player: `openTrailer({ muted })` now
  actually mutes (proxy `?mute=1`), a speaker toggle in the player chrome, and
  a `setMuted` plugin method + `muteChanged` event. Cinema Mode's ambient
  muted channel now works on iOS.
- `onClosed(reason)` player callback — modes react to "modal dismissed"
  without hijacking web pause events.
- Native `advanced` events carry a `cause` (`ended`/`unplayable`/`user`);
  auto-skipped dead video ids are blocklisted for the session.
- Roulette Wheel: "Done watching" control for the inline (web) player.

### Changed
- **UI rebuilt on the Apple 2026 Liquid Glass design language**: one
  translucent glass material (blur + saturation + inner highlight + hairline)
  across all chrome; concentric radii; capsule controls; tinted-glass Play
  hero; glass About sheet with grouped-inset sections; glass fun-modes sheet.
- `styles/index.css` rewritten from scratch — eight generations of layered
  overrides (v1.6→v3.1) and ~600 lines of dead rules removed.
- Fun-modes entry is now a labeled "Modes" capsule (the bare star read as a
  bookmark, not a menu).

### Fixed
- `closeTrailer` left the pending `openTrailer` promise (and a keepAlive'd
  plugin call) hanging forever; external dismissals now resolve via a
  `viewDidDisappear` safety net too.
- Pausing a trailer on web no longer instantly spoils Blind Date's reveal,
  ends a Guess-the-Year round, or kicks the Roulette Wheel to its result.
- Returning from the background no longer mislabels Play as "Spin" and no
  longer skips an unseen trailer on the next press.
- Stale `2.9.0` version fallback in About.

### Planned (v1.1)
- Couple's Mode (turn-taking on a single device)
- Stats screen visualizing taste profile
- See `docs/V1.1-SPEC.md`

## [1.0.0] — TBD (target 2026-05-30 to 2026-06-20)

Initial public release.

### Added
- **Trailer shuffle** with 90-second cycle timer (a "TV channel" experience)
- **Watchlist** — save trailers locally; persists via `@capacitor/preferences`
- **Seen it / Skip it** swipe gestures during/after playback
- **On-device taste profile** (genre + decade + runtime affinity buckets)
- **Weighted shuffle** that biases the queue toward the user's taste profile after 10+ reactions
- **Filter** chips for genre and decade
- **AirPlay** via custom Capacitor plugin wrapping `AVRoutePickerView`
- **Haptic feedback** on shuffle, skip, swipe
- **Native dialog** wrappers (replacing `alert()` and `confirm()`)
- **Safe-area aware** UI for iPhone notch / Dynamic Island
- **About screen** with TMDB attribution + privacy posture
- Trailer playback via YouTube's official embed inside `SFSafariViewController` (App Store-safe; ToS-compliant)
- Privacy nutrition label: **Data Not Collected**

### Pre-staged but not user-visible
- ESLint flat config + Vitest suite for `shuffleWeighting`, `tasteProfile`, `youtube`
- GitHub Actions CI for lint/test/build (Ubuntu)
- GitHub Actions iOS bootstrap (one-time `cap add ios` runner)
- GitHub Actions iOS release pipeline (build + sign + upload to TestFlight)
- 13-size pre-rendered app icon set with iOS Asset Catalog manifest
- Self-contained landing page deployable to Vercel

### Known limitations
- Auto-advance is timer-based (90s), not detected from YouTube's player. We can't programmatically read player state from `SFSafariViewController` — by design, for compliance.
- AirPlay only works on real devices, not the simulator.
- iPad is supported but landscape-first layout; may receive iPad-specific polish in v1.2.

### Compliance
- Apple App Store Review Guideline 4.2 (Minimum Functionality): addressed via Watchlist + Seen-it/Skip-it + weighted shuffle as native, persistent, gesture-driven features that distinguish the app from a web wrapper. Full memo: `research/why-this-app-is-original.md`.
- Apple App Store Review Guideline 5.2 (Intellectual Property): TMDB metadata used under public API ToS with required attribution; YouTube playback through official embeddable player only; no content extraction.
- YouTube Terms of Service: official player only; no separation/isolation/modification of player components.
