# Rights review — standing items for a human

The ingestion pipeline enforces everything that can be read from provider
metadata. This document is the honest list of what it *cannot* read, so the
gaps are a decision someone has made rather than an assumption the code is
making quietly.

`docs/CATALOG-REJECTIONS.md` is regenerated on every ingest and lists what was
excluded and why. This file lists what was *admitted* and still deserves eyes.

---

## What the pipeline enforces automatically

| Check | Rule | Where |
| --- | --- | --- |
| Rights classification | `unknown` is a rejection. No "probably public domain" path exists. | `core/types/rights.ts` |
| Commercial use | Must be explicitly true. | `rightsAreClear()` |
| Attribution | An item requiring attribution with no credit line is rejected. | `rightsAreClear()` |
| NOAA copyright marker | NOAA marks copyrighted media with the word "copyright" in the caption. Any marker in the caption, credit or description demotes the item to `unknown`. | `providers/noaa/rights.ts` |
| NASA third-party marker | Copyright, courtesy, licence, agency-wire and music markers in the metadata, **and in the asset filename**, demote to `unknown`. | `providers/nasa/rights.ts` |
| Identifiable persons | Interview, briefing, downlink, ceremony and similar formats are flagged and excluded from the default feed. | both adapters |
| Media caching | `cachingAllowed` is false for every item. Source video is streamed, never stored. | both adapters |
| Re-verification | Every gate runs again on the committed catalog in CI. | `shipped-catalog.test.ts` |

## What needs a human

### 1. NASA insignia and logotype

NASA's guidelines state plainly that the NASA Insignia, logotype and
identifiers are **not** in the public domain. Whether a given clip contains an
on-screen insignia cannot be read from metadata. Filename markers catch the
obvious cases (`..._Artemis logo_...`); an insignia on a rocket fairing or a
flight suit does not announce itself.

**Assessment:** low risk for the current catalog. Frontier Go reproduces NASA
footage as published, in a context that credits NASA, and does not use the
insignia as branding for itself. **To review:** if the app ever adds a paid tier
or advertising, revisit with counsel before shipping NASA material.

### 2. Identifiable people appearing incidentally

The safety filter removes items that are *about* a person. It does not remove a
crew member visible in the corner of a deck shot or an astronaut inside a suit.
NASA's guidance is that commercial use of media showing identifiable people may
infringe their privacy or publicity rights.

**Assessment:** acceptable for a free app that presents the footage as the
agency published it. **To review:** before any commercial use, and before any
use of a frame as marketing artwork.

### 3. Music in agency-produced pieces

Both agencies publish edited pieces with music beds. The filename and metadata
markers catch the labelled cases. An unlabelled licensed track in an older NOAA
highlight reel would not be caught.

**To review:** spot-check a sample of NOAA highlight-reel items with audio.
A future ingest step could fingerprint audio; it is deliberately not a launch
blocker.

### 4. NOAA items whose caption says nothing about rights

NOAA states that *most* Ocean Exploration content is public domain and that
copyrighted items are marked. An item with an empty credit field is treated as
unmarked, and therefore as a government work.

**Assessment:** this is exactly what the agency's published rule says to do.
**To review:** if NOAA changes its marking convention, this inference changes
with it. The rule lives in one function, `noaaRights()`.

### 5. Region reference points are not positions

Every coordinate in the catalog that came from the gazetteer is a published
reference point for a *named region*, carries `accuracy: 'region'` and a stated
`coordinateSource`, and is presented with a qualifier in the app. No item claims
`accuracy: 'exact'` unless a provider published a survey position, and none
currently does.

**To review:** if dive-level coordinates are added (NOAA's dive summaries carry
them), they should raise accuracy to `exact` only where the provider states the
position for *that footage*.

### 6. Attribution placement

Credit lines are shown in the information sheet, one tap from the picture, and
the provider is named on the Watch overlay. NOAA asks that the caption credit be
included; NASA asks to be acknowledged as the source.

**Assessment:** compliant. **To review:** if a share card is ever rendered as an
image, the credit must be burned into it.

## Sources

- NOAA Ocean Exploration image and video usage — https://oceanexplorer.noaa.gov/about/media-kit/
- NASA media usage guidelines — https://www.nasa.gov/nasa-brand-center/images-and-media/
- Natural Earth (globe coastlines, public domain) — https://www.naturalearthdata.com/about/terms-of-use/
