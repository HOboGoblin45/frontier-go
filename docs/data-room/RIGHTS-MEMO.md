# Rights memo — why frontier go may show what it shows

Prepared for diligence, 2026-09-22. This is a factual summary of the sources and
of how the product enforces them. It is not legal advice; counsel for any buyer
or partner should review the primary sources linked at the end.

## Summary

Every clip in frontier go is footage published by NOAA Ocean Exploration or by
NASA. Works prepared by U.S. Government employees as part of their official
duties are not subject to copyright in the United States (17 U.S.C. §105). Both
agencies say so for their media, and both say how copyrighted exceptions are
marked. The product excludes anything marked, anything with a third-party
credit, and anything it cannot classify. It streams from the agencies' servers
and stores no video.

The app is free, carries no advertising and makes no purchases. The remaining
risks (insignia, identifiable people, music) are ordinary for any use of agency
media and are lower for a free, credited, non-endorsing use like this one.
They would need re-review before any commercial model.

## The sources and what they say

| Source | Statement | Checked |
| --- | --- | --- |
| 17 U.S.C. §105 | Copyright protection is not available for any work of the U.S. Government. | Statute |
| NOAA Ocean Exploration media kit | Video on the portal is in the public domain and should be credited to NOAA Ocean Exploration; copyrighted items are marked. | 2026-09 |
| NASA images and media guidelines | NASA content generally is not subject to copyright in the U.S.; third-party material is marked; the NASA insignia, logotype and identifiers are not in the public domain; use must not imply endorsement; identifiable people may have publicity rights. | 2026-09 |

## How the product enforces it

| Rule | Mechanism | Where |
| --- | --- | --- |
| Unknown rights are a rejection | No "probably public domain" path exists | `app/src/core/types/rights.ts` (`rightsAreClear`) |
| Copyright and third-party markers | NOAA caption, credit and description markers; NASA metadata and asset-filename markers (courtesy, licence, wire services, music) | `providers/noaa/rights.ts`, `providers/nasa/rights.ts` |
| Items about a person | Interviews, briefings, "meet the" pieces, ceremonies and similar formats are excluded | both adapters, `core/types/safety.ts` |
| Checked twice | The same gate runs in the ingest pipeline and again inside the app on every catalog it loads, including the weekly remote catalog | `core/catalog/catalog.ts` |
| Checked again in CI | The shipped catalog is re-verified on every push | `app/src/core/__tests__/shipped-catalog.test.ts` |
| Nothing cached | `cachingAllowed` is false; video streams from agency servers | both adapters |
| Credit shown | Every clip carries its credit line and source link | Watch info sheet, share pages |
| No endorsement | No agency mark in the icon, screenshots or UI; the app and the listing state it is independent | `Profile.tsx`, `store-listing/description.md` |

Evidence that the gate works is the rejection log, `docs/CATALOG-REJECTIONS.md`.
In the 2026-09-22 ingest, 2,470 items were fetched and 1,634 published: 98 were
rejected on rights (90 NOAA copyright markers, 8 NASA third-party markers),
157 on safety (156 identifiable-person formats), and the rest on quality or as
duplicates.

## Residual risks

Tracked in detail in `docs/RIGHTS-REVIEW.md`.

1. **On-screen insignia** inside NASA footage (a logo on a fairing) cannot be read
   from metadata. The app reproduces the footage as published and does not use the
   insignia as branding. Low risk for a free app.
2. **Identifiable people appearing incidentally** (crew on a deck, an astronaut
   in a suit). Items *about* people are excluded; incidental appearances are not.
   Frames with recognisable people are kept out of marketing.
3. **Unlabelled music** in older agency highlight reels. Labelled cases are
   excluded. A future audio-fingerprint step is possible.
4. **A change in agency practice.** Each agency's rule lives in one function, so
   a change is a one-place edit.

## For a buyer who wants to monetise

Advertising, a paid tier or licensing the footage onward would change the
analysis for items 1 and 2, and NASA's guidelines should be re-read with
counsel before any of those ship. The catalog *selection, metadata, geography
and pipeline* are the transferable work product. The underlying video belongs
to no one.

## Primary sources

- 17 U.S.C. §105 — https://www.law.cornell.edu/uscode/text/17/105
- NOAA Ocean Exploration media kit — https://oceanexplorer.noaa.gov/about/media-kit/
- NASA images and media guidelines — https://www.nasa.gov/nasa-brand-center/images-and-media/
