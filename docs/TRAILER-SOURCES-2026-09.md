# Can we get trailers from somewhere other than YouTube?

Asked 2026-09-21, because YouTube's pre-roll ads interrupt the channel and the
app is forbidden from doing anything about them. Researched and measured the
same day rather than reasoned about. **Short answer: no, and archive.org in
particular is a trap.** The detail is below so this is not re-litigated.

---

## What was measured

### TMDB carries YouTube and nothing else

56 films sampled across 1958, 1972, 1985, 1996, 2007, 2018 and 2024, every one
of which had at least one video attached:

| Site | Videos |
| --- | --- |
| YouTube | 671 |
| anything else | **0** |

So there is no alternative source hiding inside the metadata the app already
uses. `getTrailer`'s `v.site === 'YouTube'` filter is not throwing anything
away; there is nothing else to keep.

### archive.org has the volume, and no rights chain

| Query | Items |
| --- | --- |
| `collection:(movie_trailers)` | **62,699** |
| `mediatype:(movies)` AND title/description mentions a trailer | 87,186 |
| `mediatype:(movies) AND collection:(feature_films)` | 28,463 |
| `collection:(ClassicTrailers)` | 0 (dead collection) |

62,699 direct-playable MP4s with no ads is exactly what this app wants. Then
look at what they are. Sampling 60 of them, every identifier carried a
`turner_video_` prefix, which reads like a studio deposit. It is not:

```
turner_video_109237   title: Cesar Chavez   date: 2014
  uploader:    tvhug@pm.me
  licenseurl:  (absent)
  rights:      (absent)
  collection:  movie_trailers_unsorted, movie_trailers, moviesandfilms
  files:       109237.m4v (MPEG4, 17MB), 109237.mp4 (MPEG4, 29MB)
```

Across the 60-item sample: **0% carry any licence or rights field.** The
collection's own description is "A collection of film trailers contributed by
users," and its uploader is an archive.org staff account, not a studio. The
`turner_video_` prefix is one anonymous individual's naming scheme for material
scraped from somewhere.

That is the whole problem. Embedding YouTube works because the rights holder
uploaded the trailer and YouTube's own terms authorise embedding it — there is
a chain from the studio to the screen. These files have no chain at all.
Serving them from Trailer Roulette would be redistributing copyrighted trailers
without permission, at scale, from a US-hosted app under the developer's own
name. Not a grey area, and not worth the catalogue.

### Coverage would not justify it anyway

40 films drawn from the app's actual live feed, matched against archive.org by
title: **17 apparent matches (43%)** — and the matches do not survive
inspection. `Oklahoma!` matched a stock-footage reel about the state.
`The Tattoo` matched a different film called `Tattoo Connection`. One match was
literally `youtube-ljraNonAle8` — a YouTube rip re-uploaded to archive.org.
There is no TMDB id linkage, so every match is a fuzzy title guess. Real
coverage after de-duplication and false positives would be well under half of
that 43%, against a source that cannot be used regardless.

### The commercial APIs do not solve it either

- **KinoCheck** — 80k+ assets from 250+ publishers, commercial use permitted,
  free tier. **Returns YouTube video IDs.** It is a discovery API, not a host,
  so the ads come with it. Skews to new releases, which is the opposite of this
  app's direction.
- **TrailerAddict** — an XML API returning *their* embed codes, web-oriented,
  documentation looks unmaintained. Their player, their terms, not a native iOS
  path.

---

## What is actually left

1. **Licence directly.** Distributors and trailer aggregators do license
   catalogues to apps and CTV channels. This is the real route to an owned,
   ad-free pipeline, and it is a business-development project rather than a
   code change. Worth a conversation if the app ever justifies it.
2. **Public-domain only.** Prelinger and genuinely lapsed-copyright material is
   free and clean, and would make a legitimate ad-free *mode* — but it is tiny,
   old and unrepresentative, not a replacement feed.
3. **Accept the ads and fix the feel.** Which is what the app should do now.

## The decision

Stay on YouTube's official embedded player. It is the only source that is
free, comprehensive across the whole catalogue this app draws from, and
lawful. Ads are the price of that, the app already discloses them in the
privacy policy, the terms and the store listing, and the developer policies
forbid blocking, skipping, overlaying or muting them — see
`research/youtube-tos-embedding.md`.

What is in our control is the *wait*, and that is worth real work:

- The stall ceiling is already down from 75s to 12s (`docs/bugs.md` B13).
- **Not yet done:** show the incoming film's artwork and title during an ad or
  a buffer, instead of a spinner over a frozen frame. Requires plumbing a
  poster URL through `enqueueNext` to the native player. This turns dead time
  into anticipation and is the single biggest remaining win on this problem.
