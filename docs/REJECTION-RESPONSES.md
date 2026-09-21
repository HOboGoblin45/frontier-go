# Review response preparation - 3.5.0

Use the actual Resolution Center message and tested release build, not a generic appeal.

## 4.2 - functionality
Direct the reviewer to Filter, six modes, TMDB-derived movie facts, the bookmark/Saved movies screen and native AirPlay. Explain a concrete workflow: choose a decade, discover a movie, inspect its cast and facts, save it, retrieve it, then play Guess the Year. Do not claim Theater Mode is enabled. Do not claim every activity works without internet or YouTube.

## 5.2 - third-party content
Describe the official embedded YouTube player and the untouched stream. Supply actual permissions and applicable service terms if requested. Do not invent studio, Alamo or commercial TMDB approval. Theater Mode is disabled. Cite research/youtube-tos-embedding.md for the implementation, not as a legal approval.

## Privacy or metadata
Supply the live /privacy, /terms and /support links after deployment. Explain local Preferences and third-party network requests. Replace inaccurate screenshots with captures of the actual submitted build. Re-answer App Privacy and age rating based on the final implementation.

## Playback
Reproduce the exact device/build issue. Check the production proxy with scripts/verify-production.mjs. Capture the message sequence and a failing regression before changing end detection. A passing unit test is not evidence that a video advanced on a device.
