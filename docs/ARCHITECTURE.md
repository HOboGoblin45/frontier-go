# frontier go — architecture

```
                        PROVIDERS
         NOAA Ocean Exploration        NASA Image and Video Library
                    |                            |
                    +-------------+--------------+
                                  |
                          INGESTION WORKER          app/tools/ingest/run.ts
                                  |                 GitHub Actions, weekly
                          NORMALISATION             providers/*/adapter.ts
                                  |
                          RIGHTS VALIDATION         core/types/rights.ts
                                  |                 fails closed
                          SAFETY FILTER             core/types/safety.ts
                                  |
                          QUALITY FILTER            core/catalog/quality.ts
                                  |
                          DEDUPLICATION             core/catalog/dedupe.ts
                                  |
                          HEALTH PROBE              HEAD every stream
                                  |
                    app/public/catalog/frontier-catalog.json
                          (committed, ships in the bundle)
                                  |
                    +-------------+--------------+
                    |             |              |
                 SHUFFLE      LOCATION        HISTORY
                 ENGINE        ENGINE         PASSPORT
              core/shuffle  core/util/geo   core/history
                    |             |              |
                    +-------------+--------------+
                                  |
                           FRONTIER CORE              app/src/core/**
                     (no React, no Capacitor, no DOM)
                                  |
                    +-------------+--------------+
                    |                            |
             NATIVE PLAYER                  REACT UI
        local-plugins/frontier-player      app/src/ui/**
        AVQueuePlayer, AirPlay, PiP,       Watch, Globe, Saved, Profile
        Now Playing, audio session
```

## The rule that shapes everything

**A routine Shuffle must not touch the network.** The next item is handed to the
native queue the moment the current one starts playing, so a tap is an advance
onto an asset that is already open and buffering. Measured perceived latency in
the browser harness: 85-112 ms across four consecutive shuffles.

## Layer boundaries

**`core/`** is platform-agnostic TypeScript. No React, no Capacitor, no DOM.
This is the part that would move to tvOS unchanged: the catalog, the eligibility
gates, the shuffle engine, the passport, the analytics buffer, the playback
state model.

**`providers/`** is ingestion-side. Each adapter implements `fetchItems`,
`normalize` and `validateRights` and nothing downstream knows which provider an
item came from. Adding National Park Service, USGS or a qualified live feed
means adding an adapter to the registry and changing nothing else.

**`player/`** wraps the Capacitor plugin with a web implementation that mirrors
the native contract, so the browser build is a real target rather than a stub.

**`ui/`** owns layout, the design system, the globe and the screens. It never
talks to the player or the engine directly; `state/useFrontier.ts` is the only
thing that knows how the pieces fit together.

**`local-plugins/frontier-player/`** is Swift. It owns AVQueuePlayer, the queue,
buffering, errors, AirPlay, Picture in Picture, the audio session, Now Playing
and the remote command centre. React owns policy and pixels; Swift owns
transport.

## The video plane

On iOS, an `AVPlayerLayer` is hosted in a `UIView` inserted **behind** the
Capacitor `WKWebView`, which is made transparent. The React interface floats
over the footage, which is what makes "90% picture, 10% interface" literal.
`AVPictureInPictureController` works directly against an `AVPlayerLayer`, so
nothing is given up by owning the layer rather than using
`AVPlayerViewController`.

In the browser, `#frontier-stage` holds the same plane as `<video>` elements —
one visible, one hidden and preloading — so the two platforms behave the same
way and disagree loudly when they do not.

Both letterbox with `resizeAspect` / `object-fit: contain` and fill the bars
with the item's own artwork, blurred and dimmed.

## Error philosophy

A failed item is marked, reported, and skipped; the channel keeps playing. There
is no modal error anywhere in the product. The only full-screen message is the
React error boundary, which is the one failure the channel cannot skip past.

## Where state lives

| State | Home | Survives |
| --- | --- | --- |
| Catalog | `public/catalog/frontier-catalog.json`, in the bundle | app updates only |
| Onboarded, channel, mute, ambient | Capacitor Preferences | reinstall: no; update: yes |
| Discovery history and visited places | Capacitor Preferences | same |
| Saved discoveries | Capacitor Preferences | same |
| Per-item behavioural health | Capacitor Preferences | same |
| Analytics | in memory, capped ring buffer | the session |

Nothing syncs. Nothing is keyed to a person. There is no account and no server.
