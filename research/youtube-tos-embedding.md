# YouTube integration review - 2026-09-21

The iOS implementation loads a real HTTPS proxy page in WKWebView. That page embeds YouTube's official player with its IFrame API enabled. Video goes directly to YouTube; it is not rehosted or extracted. The proxy is an origin/event bridge, not a video proxy. Event subscriptions and ad-aware detection remain unchanged in 3.5.0.

The native player now has its own rectangle between header and progress track. Header artwork and spinner are outside it; root gestures reject starts in its frame. Full-screen presentation delegates rotation to the player; iPad allows all orientations. Device layout and AirPlay must still pass the release checklist. Browser preview layouts are not a public web-player launch and require a separate overlay review if distributed.

[Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) prohibits covering the embedded player, requires a minimum 200 x 200 viewport and limits autoplay to visible players. The retained HTTPS origin supplies the browser referrer. Check the actual landscape and split-screen viewport on device; do not replace this architecture with previously failed direct YouTube loads.

[Developer Policies](https://developers.google.com/youtube/terms/developer-policies) require policy/terms access and restrict interference with ads and monetization of YouTube content. The app now provides first-launch agreement and persistent About links to its policies and YouTube terms. Its privacy page links Google's policy. No blanket compliance certification is made by these source checks.

Alamo: attempts to read https://drafthouse.com/terms-of-use and /terms through the web tool were unsuccessful. The operative grant of permission remains unverified, not inferred from public API accessibility. Charlie approved disabling Theater Mode until permission exists.

TMDB: [FAQ](https://developer.themoviedb.org/docs/faq) requires both the approved logo and attribution notice. The SVG in app/public/tmdb-logo.svg is downloaded unchanged from TMDB's official logos-attribution page. It is smaller than the app identity in About. Commercial rights must be obtained for a revenue-focused project; see docs/MONETIZATION-2026-09.md.
