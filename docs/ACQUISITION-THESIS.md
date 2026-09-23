# frontier go — acquisition thesis

Written 2026-09-22. Direction from Charlie, the same day: **aim for acquisition
by a larger company, not for charging users for content that is free anyway.
Make the product innovative, novel and appealing to larger companies.**

This replaces the "grow a small audience, sell on a marketplace" framing of
`GROWTH-AND-ACQUISITION-PLAN.md` §8. That plan's measurement, milestones and
"things not to do" still stand. Facts marked **[V]** were checked against a
primary source; **[R]** are from search results and not re-checked;
**[I]** is inference.

---

## 1. The thesis in one paragraph

frontier go is **the only product that turns the deep sea's largest public
exploration archive into something you can replay, search and understand**.
NOAA Ship Okeanos Explorer has sent its ROV to the deep sea 528 times since
2011. For every dive NOAA archives the camera recording, the vehicle's position
and depth every second, and a time-stamped log of every animal the scientists
named as it appeared. Nobody has lined the three up. frontier go does:
**every dive, every animal, to the second**. That is a data asset, an
engine that builds it, and a consumer experience, and each of the three is
something a larger company can use.

## 2. What exists today (built and measured this session)

| | |
| --- | --- |
| Dives indexed | **528** (2011-2025), each with a position, maximum depth and 30-second track **[V]** |
| Continuous main-camera video indexed | **2,428 hours**, segment by segment, each on the dive clock **[V]** |
| Scientist-logged sightings | **22,866**, each with the second it was logged, depth and (2021 onward) water temperature, grouped into 36 plain-language groups **[V]** |
| Sightings with a framegrab within 90 seconds | **21,381 of 22,866 (94%)** **[V]** |
| Named dive sites | 504 of 528, from NOAA's dive summaries **[V]** |
| Published clips tied to the dive they came from | 110 **[V]** |
| Deepest dive | 6,012 m **[V]** |
| Pipeline | Automated, re-runs weekly, 2.5 minutes for the whole archive, no API keys **[V]** |

All inputs are U.S. Government works published by NOAA (17 U.S.C. §105).
Nothing about a viewer is collected.

## 2b. The second asset: a map of public-domain footage (4.4.0)

Direction from Charlie, 2026-09-23: nature, landmarks and human history as well
as the deep sea and space, "National Geographic, Science Channel, History and
Discovery all in one", every clip placed on the globe, so footage can be found
by location.

| | |
| --- | --- |
| Clips in the catalog | **6,310**, 475 hours, from four public sources **[V]** |
| On the globe | **5,104** at 1,061 distinct points, each with a stated basis and accuracy **[V]** |
| National Park Service | 4,275 clips from 336 parks; 557 are the NPS's own B-roll (raw footage, no narration) **[V]** |
| Library of Congress | 401 films, 1896-1944, at 73 named places **[V]** |
| Subjects | 13, from mammals to native heritage, on every clip where the source's own words support one **[V]** |

What is new is the index, not the footage: public-domain video **by place and
by subject**, with the rights decided clip by clip and the location basis
stated. The agencies' own sites search by keyword, one agency at a time, with
no map and no rights decision. [I, checked against the NPS, LoC, NOAA and NASA
search pages]

Honest limits: most points (3,988) are reference points for a park or a named
place, not filming positions; about 1,000 NPS clips carry a point of their
own. [V]

## 3. Why this is novel [I, checked against what exists]

| What exists | What it lacks |
| --- | --- |
| NOAA's Ocean Exploration Video Portal | A download tool for scientists. It was returning 502s all day on 2026-09-22 **[V]**. |
| NOAA's highlight reels | Edited minutes, no instruments, no log. |
| FathomNet (MBARI and partners) | Still images with labels, for machine learning. No video timeline and no consumer product. Meta partnered with it on ocean segmentation data **[R]**. |
| NASA+, streaming nature channels | Produced shows. Not searchable by animal, depth or place, and not time-aligned to any instrument. |

frontier go is the first to put the raw record, the vehicle's instruments and
the science log on one clock, for anyone.

## 4. Who would buy it, and why

Ordered by fit. The pitch changes by buyer; the asset is the same.

| Buyer type | Examples | What they would be buying | Evidence they buy this kind of thing |
| --- | --- | --- | --- |
| Stock and archival footage | Shutterstock/Getty | A species-, depth- and place-indexed deep-sea footage library, searchable to the second, and a rights-decided, place-indexed public-domain library (parks, early film) | Shutterstock bought Pond5 for $210M **[V]** |
| Factual media and streaming | Blue Ant/MagellanTV, National Geographic/Disney, Warner Bros. Discovery, CuriosityStream | A distinctive ambient/FAST channel and a science brand with a data moat | Blue Ant bought MagellanTV, $12M ($6M upfront) **[V]** |
| Platforms with maps, TV and immersive video | Apple (tvOS, Vision Pro, Maps), Google (Earth, Arts & Culture) | Geolocated, time-synced exploration video; a footage layer for a map. A privacy-clean app. | Apple acquires small technology teams routinely, e.g. Q.ai in 2026 **[R]** |
| AI and data | Model builders; data marketplaces | Expert-labelled, time-coded, geolocated underwater video: video, telemetry and taxonomy aligned | Cloudflare acquired Human Native, Jan 2026 **[R]**; FathomNet and Meta **[R]** |
| Ocean technology and science philanthropy | Schmidt Ocean Institute, OceanX, Ocean Infinity | A public telepresence product for their own dives, ready-made | [I] Partnership first; acquisition possible |

## 5. What makes it acquirable, in order of what a buyer checks

1. **The engine**: `tools/dives/crawl.ts` plus the parsers in
   `src/providers/noaaDives/`, tested against every file format NOAA used from
   2011 to 2025. It reproduces the whole index from public sources in minutes.
2. **The index**: `app/data/dives/`, versioned in the repository.
3. **The experience**: Dive Replay in the app, where the video, depth gauge,
   temperature, position and sightings all run on one clock. The Deep Atlas on
   the website does the same without the video.
4. **Proof that people care**: App Store Connect analytics (see
   `data-room/METRICS.md`), and search traffic to the Atlas's dive and species
   pages.
5. **Rights**: a public-domain source, credited, with no people's names or
   voices carried through. The science team's names are dropped at parse time,
   and replay video carries no audio.

## 6. Roadmap to an acquisition conversation

| Stage | What | Status |
| --- | --- | --- |
| Now | Dive index, Deep Atlas website, clips linked to dives | Built this session |
| Now | Dive Replay engine and screen in the app (4.3.0) | Built this session; played real dive footage in the browser harness. On-device playback needs the video mirror. |
| Next | **Video mirror.** NOAA's archive is zipped, so the main-camera segments must be served from storage frontier go controls. About 0.8 GB per hour of video. | Tool built; **needs a storage account (Charlie)** |
| Next | Apple TV app with Dive Replay as the default: the lean-back form of the product | Planned |
| Next | Search by animal across all dives ("every octopus below 3,000 m") in the app | The index supports it today |
| Then | Live dives: when Okeanos Explorer is diving, show it live with the same instruments | Planned. How NOAA's live streams are delivered is not yet checked [I]; YouTube-only delivery would rule it out |
| Then | More archives. Ocean Exploration Trust (Nautilus) and MBARI are the obvious next sources, but their footage is not U.S. Government work, so it is presumably copyrighted [I]: partnership or licence, not scraping | Needs a conversation |
| Then | Approach buyers with the one-pager, a live demo and three months of metrics | See §4 |

## 7. Honest risks

- **Video quality.** The archive's streamable copies are 640x360. That is fine
  on a phone and soft on a television. Broadcast-quality originals exist but
  must be ordered from NOAA. **[V: probed a real segment]**
- **Hosting cost.** The whole main-camera archive (2,428 h) is about 2 TB. A
  curated first set (the 100 best dives' bottom time) is about 0.3 TB.
  Storage with no egress fees costs a few dollars a month at that size **[R]**.
- **Upstream change.** The archive host (oer.hpc.msstate.edu, linked from
  NCEI's official landing pages) could move. The index is committed, so
  what is built survives a move.
- **Not exclusive.** Anyone could do this. Nobody has, and the lead is the
  engine, the product and the audience together.
