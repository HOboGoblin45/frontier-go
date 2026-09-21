# TestFlight — What to Test (v4.0.0, build 74)

Paste into App Store Connect → TestFlight → the build → "What to Test".

```
frontier go 4.0.0.

This is the same app you have been testing, reoriented. Trailer Roulette is
gone: no movie trailers, no YouTube, no advertisements between clips. It now
plays a continuous channel of real exploration footage - deep-ocean ROV dives
from NOAA Ocean Exploration, and orbital views, launches, engine tests, Apollo
and Mars footage from NASA. 581 items, all public-domain or openly licensed.

Playback is now fully native, so this build is mostly about whether the things
that never worked before now do.

PLEASE CHECK, IN THIS ORDER

1. Profile tab, at the bottom, under Diagnostics. The line marked "Player" must
   read "Native AVFoundation - active". If it says "Web fallback", stop and
   tell me: nothing else in this list will be meaningful.

2. Open the app cold. Footage should be playing within a couple of seconds,
   with no white flash and no Capacitor logo at launch.

3. Tap Shuffle five or six times. It should be instant - no spinner, no wait.
   If you see a spinner on a routine shuffle, that is a bug.

4. AirPlay to a television, from the icon at the top right of the Watch screen.
   The PICTURE should move to the TV, not just the sound. Then shuffle a few
   times while it is playing on the TV.

5. Picture in Picture, from the small icon under the Shuffle row. Leave the
   app, come back, check the interface has not lost track of what is playing.

6. Lock the screen while something is playing. Sound should continue. The lock
   screen should show the title, the place and artwork, and the Next button
   should shuffle.

7. Explore tab. Turn the globe, pinch to zoom, tap a bronze point, tap "Go
   here". It should take you there.

8. Tap the place name on the Watch screen - "Pacific Ocean, 2,806 m below sea
   level" and so on. Try "Keep Exploring Here", shuffle a few times, then
   "Go Anywhere".

9. Leave it running for twenty minutes without touching it. It should keep
   playing by itself, moving somewhere new each time.

10. Rotate the phone. Try it on iPad if you have one.

KNOWN AND EXPECTED

- Roughly three quarters of the catalog is deep-sea, so the ocean will come up
  often. More sources are coming.
- Most locations are region-level, and the app says so underneath the place
  name. That is deliberate: NOAA does not publish per-dive coordinates, and a
  guessed position would be worse than an honest approximation.
- Some NASA clips have no depth or altitude shown. Same reason.

WHAT I MOST NEED TO KNOW

Anything that stops, stalls, or shows a spinner. The channel is meant to keep
playing no matter what - a clip that fails should be skipped silently, not
stop the app.
```
