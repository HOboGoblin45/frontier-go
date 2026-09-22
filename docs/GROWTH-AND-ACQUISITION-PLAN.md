# frontier go — growth and acquisition plan

Written 2026-09-22. Direction set by Charlie the same day: **free for users,
oriented to be acquired rather than to charge.** Revised the same day: aim for
acquisition by a **larger company**, with a novel product. The product thesis
is now `ACQUISITION-THESIS.md`; this plan keeps the measurement, milestones and
rules. Trailer Roulette is retired;
frontier go ships as the first public release on the existing App Store record.

Facts marked **[V]** were checked against a primary source by hand. Figures from
the research passes that were not re-checked are marked **[R]**.

---

## 1. Where it stands

| | |
| --- | --- |
| Public users | **0.** Nothing has ever been released on this App Store record. |
| App Store record | Trailer Roulette 1.0, approved, `PENDING_DEVELOPER_RELEASE` **[V]**. Blocks both a new version and a transfer until withdrawn |
| Latest build | frontier go 4.2.0 (80), `VALID` in App Store Connect **[V]** |
| Catalog | 1,634 clips, 104 hours, 12 environments, rights fail closed |
| Public website | `hobogoblin45.github.io/frontier-go`: landing, privacy, support, share pages, live catalog **[V]** |
| Weekly catalog refresh | Runs: `frontier-go` is now the default branch **[V]** |
| Share links | Land on a web page that plays the clip, with an App Store button **[V]** |
| Store listing | Kept in `store-listing/` and applied by `store-listing.yml`; a read-only run against the live account passed **[V]** |
| Analytics | App Store Connect Analytics Reports request active since 2026-09-22 **[V]**; pulled monthly to a private folder (`docs/data-room/METRICS.md`) |

## 2. The hard truth about selling it

- **It cannot be sold today, at any price, with its listing.** Apple:
  "The app must have at least one version that was released to the App Store." A
  version in *Pending Developer Release* also blocks transfer **[V]**. Shipping
  publicly is step one of any exit.
- **Free apps are bought for their audience, not their code.** Acquire.com lists
  only revenue-generating startups; Empire Flippers needs $2,000/month profit
  **[R]**. Tiny apps with near-zero revenue trade for roughly $1,000–$15,000 on
  Microns-type marketplaces **[R]**.
- **The content is not exclusive.** NASA+ is free, ad-free and on Netflix and
  Prime Video; Nautilus and Schmidt stream ROV dives free on YouTube **[R]**.
  What is defensible is the product: zero-decision playback, the curation, the
  fail-closed rights pipeline, the privacy stance, and the TV experience.
- **Strategic buyers exist and pay real money for factual libraries.** Blue Ant
  Media bought MagellanTV (nature, science, space) for $12M — $6M upfront, $6M
  over two years **[V]**. Simulation Curriculum bought SkySafari **[R]**. These
  buy audiences and libraries far larger than frontier go has; they are the
  destination, not the next step.

**So the plan is a growth plan with an exit at the end.** Every decision below
is judged on one question: does it grow a provable, engaged audience a buyer
would pay for?

## 3. What a buyer would be buying

1. **An engaged audience of exploration enthusiasts** — to be built and proven.
2. **The rights-cleared catalog pipeline** — automated ingest from two agencies,
   fail-closed rights and safety gates run twice, a rejection log that doubles
   as due diligence. Licensable on its own.
3. **The listening-room experience** — native AVPlayer, AirPlay, Picture in
   Picture, ambient TV mode, the globe.
4. **A privacy brand** — "Data Not Collected". Adding tracking would spend it.
5. **The App Store listing** — ratings and history transfer with the app, but
   only once a version has been released.

## 4. Measurement buyers will accept

App Store Connect App Analytics — installs, sessions, active devices, retention
cohorts, source of install, product-page conversion — is the proof buyers ask to
see by screen-share. It covers users who opt in to share with developers, so it
undercounts, which is the conservative direction. It keeps the "Data Not
Collected" label intact.

Decision: **no third-party analytics SDK now.** Revisit only if a serious buyer
asks for feature-level data, knowing it would change the privacy label to "Data
Not Linked to You".

## 5. Milestones that make it acquirable

| When | Target | Why |
| --- | --- | --- |
| Now | Released on the App Store | Transfer is impossible until then |
| Months 0–6 | 10k+ lifetime installs, 4.5★+, D30 retention above 10% (average iOS app: 5.3% **[R]**) | Proves the loop holds people |
| Months 6–12 | ~50k MAU, 3+ months of clean analytics, organic trend flat or rising | Where per-user valuation arguments start being believed **[R]** |
| Then | Data room, direct approach to strategic buyers or partners | See §8 |

## 6. Phase 1 — ship (this session)

1. **Retire Trailer Roulette** — developer-reject the pending 1.0, submit frontier
   go in its place. Approved by Charlie 2026-09-22.
2. **Make `frontier-go` the default branch** so the weekly ingest actually runs.
3. **Remote catalog refresh** — the app fetches the latest catalog in the
   background and re-runs the rights gate on it. New footage reaches every user
   weekly without an app update. That is the "new this week" reason to reopen.
4. **Share links that land somewhere** — `/d/<id>` on the frontier go website
   plays the shared clip in the browser, with a rich link preview and an App
   Store button. Every share becomes an ad for the app.
5. **Engagement features, all free** — channels one tap from the player,
   curated Expeditions (NOAA cruises and NASA mission collections), a sleep
   timer for the "fall asleep to the deep sea" use, cleaner titles.
6. **Store listing built for search** — keywords aimed at terms the research
   found winnable ("ambient tv", "slow tv", "screensaver", "ocean videos",
   "earth from space", "relaxing videos") rather than "nasa" and "space", which
   NASA and games own. No agency names in the name or keywords.
7. **Its own website** — GitHub Pages at `hobogoblin45.github.io/frontier-go`,
   built and verified by `deploy-site.yml` whenever the site or the catalog
   changes. No hosting account, no cost, and it moves with the repository in a
   sale. The retired Trailer Roulette site on Vercel is left untouched.

## 7. Phase 2 — grow (months 1–6)

1. **Apple TV app.** The ambient-TV category lives on tvOS; AirPlay alone loses
   to NASA+ on a television. Same catalog, SwiftUI + AVPlayer, generated with
   XcodeGen in CI so no Mac is needed. Biggest single lever on audience and on
   strategic value.
2. **Featuring nomination** in App Store Connect, 2 weeks to 3 months ahead of a
   notable update. App of the Day averages a 1,747% one-day download lift **[R]**.
3. **Home-screen widget** — "somewhere new today", a reason to open daily.
4. **More footage** — Library of Congress and Prelinger adapters (~3,000
   rights-clean films between them **[V]**), each with its own traced rights rule.
5. **NOAA dive-level coordinates** — sharper globe, better "where was this".
6. **Launch posts** in the communities that care — r/space, r/oceanexploration,
   r/deepsea, Product Hunt — as one-off moments, not a posting schedule.

## 8. Phase 3 — package and approach (months 6–12)

- **Data room**: started in `docs/data-room/` — analytics screenshots, a rights memo (17 U.S.C. §105, NASA and
  NOAA terms, the insignia and identifiable-person policies, the rejection
  log), architecture and pipeline runbook, transfer checklist.
- **Transfer hygiene**: TestFlight builds and testers removed, no Sign in with
  Apple grouping, no IAP product-ID collisions (there are none), both accounts on
  current agreements **[V]**.
- **Who to approach**, in order of fit: factual media groups (Blue Ant /
  MagellanTV, CuriosityStream), planetarium and science-education software
  (Simulation Curriculum), ambient-TV and FAST channel operators, then museums
  and aquariums as licensing partners. A partnership that becomes an acquisition
  is the likelier shape than a cold sale.
- **Fallback exit**: a curated marketplace sale in the low five figures.

## 9. Things not to do

- Do not add accounts, ads or tracking. The privacy stance is part of the asset.
- Do not use NASA or NOAA marks, or recognisable astronauts, in the icon,
  screenshots or marketing.
- Do not chase "nasa" or "space" as keywords; they are owned.
- Do not reintroduce YouTube, for any reason.

## 10. What needs Charlie

- **Withdraw Trailer Roulette 1.0**: App Store Connect → the 1.0 version →
  "Reject this version". Apple has no API for it. Then run
  `store-listing.yml` with `submit`, or ask a session to.
- **App Privacy**: confirm "Data Not Collected" in App Store Connect → App
  Privacy (not in the API). The answers are in `docs/PRIVACY-NUTRITION-LABEL.md`.
- **Press Release** once 4.2.0 is approved and has been tried on a phone.
- **The repository is public** (GitHub Pages on a free plan needs that). That
  is fine for the website and the docs, but it gives the code away to anyone
  who looks. Before approaching buyers, either move the site to a host that
  serves from a private repository or pay for GitHub Pro (private Pages), then
  make the repository private.

- **Paid/Free agreements** must be current in App Store Connect → Business for
  submission and, later, transfer.
- **A custom domain** (optional, ~$15/year) would make share links and the
  support URL brandable, and would allow Universal Links (a project page on
  github.io cannot serve `/.well-known/` at its domain root). The github.io
  address keeps working after a domain is attached.
