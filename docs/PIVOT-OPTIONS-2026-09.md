# If trailers do not work: what else could the channel be

Brainstorm run 2026-09-21, after `docs/TRAILER-SOURCES-2026-09.md` concluded there is no
lawful non-YouTube trailer catalogue. Every headline figure below was fetched live the same
day. Figures I confirmed with my own request are marked **[V]**. Figures that came out of the
research pass but that I did not re-check myself are marked **[R]**. Anything I could not
confirm at all is marked **unverified**.

**Conclusion first: do not pivot. Add a second channel.**

The pivot question and the ad question turn out to have the same answer, and it is not a
content question. It is a player question: **get playback into AVPlayer.**

Every source in this survey that is lawful to use hands you a direct `.mp4` or `.m3u8` URL.
That is not a coincidence. A rightsholder who gives you a raw URL has given up control of the
playback surface, and that is exactly what an ad-supported platform never does. So "no ads,"
"AirPlay carries the video," "prefetch the next item," "Picture in Picture," "background
audio" and "works on a bad connection" are not six features. They are one purchase, and the
price is a library willing to be played by a player it does not own.

There is one such library big enough to matter: **roughly 28,000 rights-clean archive films**
across the Library of Congress, Prelinger, US government films and NASA. Direct MP4, some with
real adaptive HLS, no ads, permanently, no contract to sign. That is the second channel. It
reuses the whole app shell, it forces the AVPlayer work that independently fixes AirPlay and
buffering for the trailer channel as well, and it earns the app an honest ad-free mode without
touching a single YouTube term.

---

## The rubric

Every idea below is scored on six things. Five of them are the obvious ones. The sixth is the
one that kills most candidates.

1. **Rights.** Is there a real chain of permission: public domain, an explicit open licence, a
   government work, or documented terms that permit commercial redistribution in a third-party
   app? An open endpoint is a CDN fact, not a grant. "Hobby apps do this" describes the
   enforcement gap, not the rights.
2. **Seamless.** Direct MP4 or HLS into AVPlayer, or a third-party web player? A web player is
   a downgrade, not a fix: it is the thing we are trying to escape.
3. **Volume.** Enough that a shuffle never repeats in a session, and enough churn to stay
   fresh for months.
4. **Shuffle appeal.** Does a random 30-second dip reward you? Much good content is only good
   once you have chosen it.
5. **App Store survivable.** Age rating, UGC obligations, graphic content, rights disputes.
6. **Solo buildable.** One developer, Windows, no Mac, GitHub Actions to TestFlight. No content
   ops, no moderators, no licensing budget.

### The sixth constraint bites everything, including what is shipping today

App Store Review Guideline **5.2.2**, verbatim:

> Apps may allow people to view user-generated content and third-party content, but substantial
> portions of your app should not simply be an interface to someone else's copyrighted content
> without permission and proper licensing.

And **4.2.2**:

> Other than catalogs, apps shouldn't primarily be marketing materials, advertisements, web
> clippings, content aggregators, or a collection of links.

Trailer Roulette already lives under both. The YouTube embed is the permission that answers
5.2.2 today. Any pivot that swaps YouTube for a scraped endpoint trades a defensible position
for an indefensible one, however much better the video looks. Public-domain content answers
the copyright half of 5.2.2 cleanly, but 4.2.2 still applies to anything that is only a shuffle
over someone else's library, so the app has to be a *product* around the content, not a pipe.

---

## The reframe: what the iframe actually costs

| | YouTube iframe in WKWebView (today) | AVPlayer with a direct URL |
| --- | --- | --- |
| Pre-roll ads | Forced, unblockable by contract | None, ever |
| AirPlay | Audio only, video stuck on the phone (B10) | Video routes natively, free |
| Picture in Picture | No | Yes, free |
| Background audio | No | Yes, free |
| Prefetch next item | No | Yes, trivially |
| Buffer control | Guess from postMessage heartbeats (B13) | Real `AVPlayerItem` status |
| Offline cache | Forbidden | Allowed where the licence allows |
| Lock screen / CarPlay | No | Yes |
| Catalogue size | Effectively infinite | Bounded by what is rights-clean |

The last row is the whole trade. Everything above it is won by moving; the catalogue is what
you pay.

---

## The long list

Eighteen candidates, scored. Detail on the ones that survive follows the table.

| # | Concept | Rights | Stream | Volume | Shuffle | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | LoC National Screening Room | Clean | **HLS + MP4** | 1,294 **[V]** | Strong | **Build** |
| 2 | Prelinger / ephemeral film | Clean if filtered | MP4 | 1,876 **[V]** | Strong | **Build** |
| 3 | US government films (CC0) | Clean if filtered | MP4 | 6,940 **[V]** | Good | **Build** |
| 4 | NASA video library | Clean, conditions | MP4 | 8,743 **[V]** | Good | **Build** |
| 5 | Public-domain features | Mostly grey | MP4 | ~4,057 **[R]** | Weak (long) | Partial |
| 6 | State DOT traffic cams | Clean (Iowa) | **HLS, live** | 694 Iowa **[R]** | Weak | Hedge |
| 7 | Internet radio roulette | Index, not licence | MP3/AAC/HLS | 52,784 live **[V]** | **Strongest** | Standalone |
| 8 | LibriVox shuffle | Cleanest grant found | MP3 | ~22,000 **[R]** | Medium | Standalone |
| 9 | Podcast roulette | Index, not licence | MP3 | 167M eps **[R]** | Medium | Standalone |
| 10 | Old-time radio | Needs per-item filter | MP3 | ~886k usable **[R]** | Good | Standalone |
| 11 | Parliament / civic video | Clean (DK, BR) | HLS | Low | Weak | No |
| 12 | Live webcams (Windy) | **Closed** | Embed only | n/a | Medium | No |
| 13 | Wildlife / zoo cams | **Closed** (YouTube) | Embed only | n/a | Medium | No |
| 14 | Scanner audio | **Closed** | n/a | n/a | Strong | No |
| 15 | Air traffic control | **Closed** | n/a | n/a | Strong | No |
| 16 | Sports highlights (MLB) | **Closed** | MP4 + HLS | ~24k/season **[R]** | Strong | No |
| 17 | Niche live sport | **Closed** | Embed only | n/a | Medium | No |
| 18 | War / conflict news | **Closed + 1.1.7** | Mixed | High | Strong | No |

---

## The ones that work

### 1. Library of Congress, National Screening Room

The single best source found, on every axis except volume.

Rights, quoted from the item record for *Duck and Cover* (`loc.gov/item/2022604365/?fo=json`) **[V]**:

> The Library of Congress is not aware of any U.S. copyright or other restrictions in the vast
> majority of motion pictures in these collections. Absent any such restrictions, these
> materials are free to use and reuse.

It is the only source in the entire survey that publishes **adaptive HLS**, which is what you
want on a phone. Both URLs come straight out of the item JSON **[V]**:

```
video        https://tile.loc.gov/storage-services/service/mbrs/ntscrm/01836081/01836081.mp4
video_stream https://tile.loc.gov/streaming-services/iiif/service:mbrs:ntscrm:01836081:01836081/full/full/0/full/default.m3u8
```

The master playlist carries 1080p / 720p / 540p variants **[R]**. No API key. Rate limits are
documented: 20 requests/minute on the JSON API, 60/minute streaming, 150/minute media **[R]** -
though `loc.gov/legal` separately advises 10/minute, so use the stricter number and cache the
index locally.

Count: **1,294 items [V]**. That is the catch. It is a good evening, not a channel.

Caveat the Library states itself: rights assessment is your responsibility, and privacy,
publicity and trademark claims can survive the absence of copyright.

### 2, 3, 4. Prelinger, US government films, NASA

These supply the volume the Library of Congress lacks, at the cost of having to filter.

**The critical mechanic:** archive.org is a host, not a rightsholder, and says so - its help
pages state it "does not make guarantees as to the copyright status of items." The operative
permission is each item's `licenseurl` field, and only about 18% of Prelinger items carry one.
Prelinger's own rights page is blunt about the rest:

> Many people believe that all Prelinger Archives films are in the public domain. Some are.
> Many are not.

So the architecture is: **query on `licenseurl`, re-assert it client-side from
`archive.org/metadata/<id>` immediately before playback, and exclude every `-nc` and `-nd`
variant.** The research pass found the server-side licence filter on the scrape endpoint
returning results that contradicted the query **[R]**; `advancedsearch.php` filtered correctly
in both that pass and mine. Never trust a cached licence.

Verified counts **[V]**, my own queries:

```
collection:usgovfilms                                                     24,872
collection:usgovfilms AND licenseurl:".../publicdomain/zero/1.0/"          6,940
collection:prelinger AND licenseurl:*publicdomain*                         1,876
images-api.nasa.gov  media_type=video                                      8,743
```

NASA's terms are the most permissive content licence in the survey - its material "generally
[is] not subject to copyright in the United States" - with three real conditions: the material
must not imply NASA endorsement of a commercial product, the NASA insignia and logotype are
**not** public domain and cannot be used as app branding, and identifiable people in footage
carry publicity-rights risk in a commercial app. Attribution is requested, not required.

Two engineering notes: archive.org and NASA serve **progressive MP4 only**, no adaptive
bitrate, so expect worse behaviour than LoC on a weak connection. And the NASA asset API
returns `http://` hrefs containing literal spaces - upgrade the scheme and percent-encode
before handing anything to AVPlayer **[R]**.

**Combined rights-clean video pool:** about **18,900 items verified directly [V]**, and roughly
**28,000** once the research pass's figures for US government PD (non-CC0), public-domain
features and classic cartoons are included **[R]**. Call it twenty to thirty hours of genuinely
strange, funny, beautiful film that nobody has to pay for: civil defence scare films, driver's
ed, 1950s industrial promos, Apollo footage, newsreels, animation. This is the material that
fuels half of YouTube's "found footage" culture, and it has never had a good shuffle app.

### 6. State DOT traffic cameras - the only clean *live* video

Iowa DOT is the cleanest licence found anywhere in the survey. Its GIS terms of use (effective
2026-06-19) default to CC0 and say, verbatim **[R]**:

> These licenses allow you to copy, share, adapt, transform, and build upon the Data for any
> purpose, including commercial use, provided that you give appropriate credit.

1,253 cameras, **694 carrying a direct `.m3u8` VideoURL**, no API key **[R]**. Nevada adds 640
more with verified-playable no-auth HLS, though on an undocumented internal endpoint with no
published licence **[R]**. Florida has 4,958 but tokened. 511NY's developer agreement expressly
permits redistribution and enhancement **[R]**, but its help page also carries a contradictory
"official use only" banner, so confirm before relying on it.

Honest assessment: this is legally the cleanest live video on Earth and it is 360x240 footage
of an interstate. "Live" has real pull and the ambient-cam audience is real, but this is a
hedge or a mode, not a product.

### 7. Internet radio - the best standalone product, and the worst use of what you have built

52,784 working stations across 241 countries and 668 languages **[V]**, my own call to
`de1.api.radio-browser.info/json/stats` (59,428 total, 6,644 broken). No API key. Direct
MP3, AAC and HLS URLs, pre-resolved through playlist redirects. The project's own terms:

> This API ... is completely free and open source. Your freedoms are: You may use it in free
> and non free software.

Why it is the best *product*: audio has no buffering problem worth the name, starts in under a
second, costs almost nothing in bandwidth, and gets AirPlay, CarPlay, background playback and
lock-screen controls for free. The shuffle mechanic is *proven* here - Radio Garden and Drive &
Listen both demonstrated that "drop me somewhere random in the world" is compelling.

Why it is the wrong pivot for *this* app: it throws away the video player, the whole native
plugin, the TMDB layer and the visual identity. And radio-browser is an **index, not a
licence** - it grants you nothing in the audio; each broadcaster's own terms govern the stream.
That is the same footing every radio aggregator stands on and it is broadly accepted, but it is
not the clean grant LibriVox gives.

If radio is the direction, it is a new app, not this one.

### 8, 9, 10. Spoken word

**LibriVox** has the only unconditional commercial grant in the survey:

> LibriVox recordings are in the public domain, which means people can do anything they like
> with them ... they can: sell them, broadcast them, put them in commercials, play them at
> political rallies, chop them up, remix them.

About 22,000 works, hundreds of thousands of chapter-level tracks, hosted on archive.org so you
are not burdening LibriVox's bandwidth, no attribution required **[R]**.

**Podcast Index** is 4.7M feeds and 167M episodes **[R]**, free for any use - but it licenses
the *index*, not the audio. A shuffle that strips a publisher's branding sits further from the
implied-licence norm than a normal podcast client does. Show the artwork, show the show name,
link back to the feed, and you stay inside the norm.

**archive.org audio** filtered on `licenseurl` yields roughly 886,000 commercially usable items
out of 14 million **[R]**, including old-time radio drama. Same filtering discipline as video.

---

## The ones that are closed, so you do not re-litigate them

- **Windy webcams.** Embed only - there is no stream field anywhere in the OpenAPI schema, only
  an iframe player URL. Redistribution is forbidden by article 10.2, "continuous scanning of a
  significant number of available Webcams" is defined as misuse in 7.2.1, and staff have
  already told a developer building something similar that it is "not possible." The
  unrestricted tier is **EUR 9,990/year [R]**.
- **explore.org and every zoo, aquarium and wildlife cam found.** All YouTube-hosted. Back to
  the iframe.
- **EarthCam.** No public content API; explicit ban on commercial exploitation.
- **NRK slow TV.** The widely-repeated belief that it is Creative Commons is **false**. NRK's
  copyright page reserves all rights and permits private non-commercial use only. Geoblocked
  besides.
- **iptv-org.** The Unlicense covers the *playlist files*, not the streams. The maintainers
  disclaim rights clearance and push disputes to the actual hosts. Apple routinely rejects apps
  streaming unlicensed broadcast channels.
- **Broadcastify.** Closed deliberately and recently - the terms were rewritten 2026-07-22, and
  the API page rules out this exact app by name: "We are not licensing any new 'police scanner'
  style applications, free or paid, hobby or commercial." Catalog access is **$2,500/month [R]**
  and would not be sold for a listener-facing app anyway.
- **LiveATC.** Section 3.4 forbids making the service available "via any other dedicated
  desktop or mobile commercial application, for profit or not."
- **Free Music Archive.** API shut down; hotlinking - i.e. exactly what AVPlayer does -
  expressly prohibited.
- **Jamendo.** The free tier defines commercial use to include "any revenue arising from
  affiliation programs or advertising," so a free app with ads is already outside it.
- **Wikimedia Commons.** Licences are mostly fine; the format is not. Commons accepts only
  WebM and Ogg Theora, and the transcode CDN emits VP9/WebM with no MP4 fallback **[R]**.
  AVPlayer cannot play either natively. Using Commons means running your own transcoding
  pipeline, which makes you the redistributor and pulls BY-SA copyleft onto you.
- **MLB.** The cruellest case in the survey: a genuinely open, unauthenticated, DRM-free
  endpoint serving both MP4 and HLS, roughly 10 clips per game and 24,000 per season, clips 14
  seconds to 3 minutes long - perfect shape. And the terms permit "personal, non-commercial
  home use" only and prohibit automated collection outright. The endpoint being open is a CDN
  fact, not a grant.
- **NHL, NFHS, Pluto TV, Al Jazeera, the IOC, college conference networks.** All personal
  non-commercial, all anti-scraping, none with a usable API.
- **Niche live sport.** Collapses for an architectural reason as much as a legal one: the free
  tier of federation sport is on YouTube and Twitch, neither of which lawfully yields an
  AVPlayer URL. Five federation watch pages were scanned for exposed manifests; zero found **[R]**.

## War and conflict news: rejected before rights even matter

Guideline **1.1.7**, verbatim:

> Harmful concepts which capitalize or seek to profit on recent or current events, such as
> violent conflicts, terrorist attacks, and epidemics.

That is a named rejection ground aimed precisely at a monetised app that shuffles live conflict,
and it applies regardless of age rating. **1.1.2** adds realistic portrayals of people being
killed or maimed. A war-footage shuffle realistically lands at 17+ and still gives a reviewer
explicit grounds to reject it. Separately, Al Jazeera's terms prohibit their stream being
"viewed or presented within any third party website, app, or service," and the free tiers of
Reuters and AP are on YouTube. There is no version of this that ships.

---

## Top five, ranked

1. **Public-domain archive film channel** - LoC + Prelinger + usgovfilms + NASA, about 28,000
   items, direct MP4/HLS, zero ads, no contract. Reuses the entire app.
2. **Internet radio roulette** - best standalone product, proven mechanic, but a different app.
3. **LibriVox / spoken-word shuffle** - cleanest licence in the survey, strong sleep and commute
   use case, low competition.
4. **Traffic and weather cam roulette** - the only clean live video; a mode or a hedge, not a
   product.
5. **Old-time radio** - large, cheap, cult audience, needs the same per-item licence filtering.

## Recommendation: do not pivot, add a channel

Build the public-domain archive channel **inside Trailer Roulette**, as a second channel
alongside trailers.

1. **It is the ad-free answer.** Direct MP4 and HLS into AVPlayer means no pre-roll, ever, and
   nothing in YouTube's terms is touched because YouTube is not involved.
2. **It pays for itself twice.** The AVPlayer work is the same work that fixes AirPlay video,
   Picture in Picture, background audio, real buffer state and prefetch. Those are B10 and B13
   solved properly rather than worked around, and the trailer channel benefits from the shared
   chrome even though it keeps the iframe.
3. **It reuses everything.** Shuffle, the two-button loop, the fun modes, the glass chrome, the
   queue, the end detection contract. The only genuinely new pieces are a metadata adapter per
   source and a native `AVPlayerViewController` path beside the existing web view.
4. **It answers 5.2.2 better than trailers do.** Public-domain content with a machine-readable
   licence is a stronger rights story than an embed permission, and it gives you something to
   say if a reviewer ever pushes on 4.2.2.
5. **It is a real test.** If people shuffle archive film happily, the audience wants the
   *mechanic* and the app has a future beyond trailers. If they only ever want trailers, that
   is worth knowing before rebuilding anything.

Positioned in the product as something like an ad-free "Archive" channel, or a mode alongside
the existing six.

## Now the case against it

Stated as hard as I can make it, because the recommendation is mine and should be attacked.

- **28,000 items is not infinite.** Trailers are effectively unlimited; the archive pool is
  maybe twenty to thirty hours of novelty before repeats start feeling like repeats. A shuffle
  app whose whole promise is "always something new" has a real ceiling here.
- **The audience may be much smaller than it looks.** Prelinger film is beloved by a specific
  internet subculture, not by a general audience, and that subculture is already served by
  archive.org itself and by YouTube compilations. Enthusiasm for "Duck and Cover" is not
  evidence of a market.
- **Two channels dilute the pitch.** "A TV channel for movie trailers" is a sentence. "Trailers
  and also public-domain archive film" is a compromise, and App Store listings punish
  compromises.
- **The filtering is a permanent liability, not a one-off task.** Licence metadata is
  uploader-supplied, the licence filter was observed returning wrong results, and one
  mis-served film is a 5.2.3 rights claim. That is ongoing diligence for a solo developer.
- **4.2.2 still applies.** Clean rights fix the copyright half of the problem and do nothing
  about being a content aggregator.
- **It is not free work.** An AVPlayer path, a metadata adapter per source, licence
  re-assertion, offline cache decisions and new tests, on top of a release that is not out yet.
  The opportunity cost is shipping v3.5.0.

The strongest counter-argument is the first one, and the honest answer to it is that 28,000
items is plenty to find out whether anyone wants this, and cheap to abandon if they do not.

## Does Trailer Roulette itself survive?

Yes, and abandoning it now would be a mistake made out of frustration rather than evidence.

- The ad is usually 5 to 15 seconds, not a minute. The 75-second stall that made it feel
  unbounded was a bug, and it is fixed: the ceiling is 12 seconds now, measured against
  playback progress so it cannot cut an ad short (B13).
- The remaining damage is not the ad, it is the **dead grey frame** during it. Fill that with
  the incoming film's poster and title and the wait becomes anticipation instead of a fault.
  That is the poster-through-`enqueueNext` work already on the table, and it is still the
  single highest-leverage change available on this problem.
- An ad-free Archive channel turns the constraint into a feature rather than an apology:
  trailers when you want the new stuff, archive when you want no interruptions.

Nothing found in this survey is a better trailer source. Everything found is a better *player*
argument.

---

## Verification status

Confirmed by my own requests, 2026-09-21: LoC National Screening Room count (1,294), the LoC
item MP4 and HLS URLs and rights text, `usgovfilms` totals (24,872 / 6,940 CC0), Prelinger
public-domain count (1,876), radio-browser stats (59,428 stations / 6,644 broken / 241 countries
/ 668 languages), NASA video total (8,743).

From the research pass and not independently re-checked: all `[R]` figures, including Iowa and
Nevada camera counts, MLB clip volumes, Broadcastify and Windy pricing, Podcast Index and
LibriVox volumes, archive.org audio licence facets, the LoC HLS variant ladder, and the
Wikimedia transcode behaviour.

Unverified: DW and France 24 terms of use (streams verified open, terms pages unreachable),
Al Jazeera stream reachability, IOC guideline text, Samsung TV Plus, Plex, Bloomberg, and the
exact rate limits for Wikimedia and archive.org.

Related: `docs/TRAILER-SOURCES-2026-09.md` (why archive.org is not a trailer source),
`research/youtube-tos-embedding.md` (what the YouTube terms forbid), `docs/bugs.md` B10 and B13.
