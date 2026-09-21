# Review notes - 3.5.0

Paste only after the release checklist and physical-device tests pass.

No login, purchases or account setup are required. On first launch, review the linked privacy/terms notice and choose Agree and continue, then press Play. Trailers are intended to advance at their end. Done returns to the main screen. Use the bookmark button to retrieve Saved movies; tap the movie title for facts, cast, providers, Save and Share. Filter offers decades and genres. Modes opens six activities: Roulette Wheel, Blind Date, Guess the Year, Time Machine, Trope Bingo and Cinema Mode. AirPlay requires a compatible receiver.

The app combines TMDB-derived movie facts and filters, locally saved selections, game state/scoring and native playback/route controls. These are custom app functions, beyond a collection of web links. Trailer video itself remains in YouTube's official embedded player through an HTTPS page inside WKWebView. Native header, artwork, spinner and progress occupy space outside the player's rectangle. No videos are extracted, downloaded or rehosted. YouTube ads are not suppressed.

Theater Mode is disabled in this public build pending data permission. It is not a public feature, and no location prompt is used. There are no app advertising or analytics SDKs. Preferences and local error history use device storage. Playback and metadata requests go to YouTube/Google, TMDB and Vercel; the privacy policy describes those services. App Privacy answers must reflect the final third-party data review, rather than assuming that a web embed is exempt.

Support and Privacy links are available in About. Troubleshooting details is an optional button in About; on an iPhone/iPad both native plugins should show active. Support: crescicharles@gmail.com.

Release operator: add tested device models, iOS versions and the exact build number to these notes before submission. Do not claim device tests have passed until recorded.
