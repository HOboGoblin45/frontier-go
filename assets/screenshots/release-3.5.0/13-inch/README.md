# 3.5.0 browser screenshot drafts

Captured from the actual web UI with live TMDB data, through a touch-emulating
context, without injected movies or hidden controls. 2064 x 2752 PNG.
Files 01 welcome, 02 filters, 03 modes, 04 movie details, 05 About.

## YouTube is stubbed during capture, on purpose

The web preview mounts a YouTube iframe on the stage; the iOS build plays in a
native modal and never shows it. Unstubbed, 03 and 04 came back with YouTube's
red play button blurred into the artwork - inaccurate, and third-party branding
inside a store screenshot besides. The capture context serves a transparent
document for youtube.com and youtube-nocookie.com so the TMDB backdrop shows
through, which is what the device puts there. Aborting those requests instead
was tried and is worse: a blocked iframe renders the browser's opaque error
document and the stage becomes a flat grey slab.

## What a browser capture cannot show at all

The native player, the glass chrome, the progress line and AirPlay - which is
most of what the app looks like in use.

## Touch emulation is load-bearing

Without hasTouch, Chromium reports a fine pointer, the desktop dev view in
styles/index.css applies at iPad width, and the 13-inch set comes back as a
520px column with black either side. That is how the previous 13-inch drafts
were made, and it is docs/bugs.md B7.

Capture the submitted set on a device during the device test in
docs/RELEASE-REVIEW-2026-09.md, and replace these wherever the appearance
differs. Do not use historic screenshot sets.
