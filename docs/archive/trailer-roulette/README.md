# Archive — Trailer Roulette

Everything in this folder describes **Trailer Roulette**, the product this
repository held before the frontier go reorientation. It is kept because the
history is genuinely useful — the App Store strategy notes, the three waves of
the trailers-cut-short bug, the CAPBridgedPlugin post-mortem and the theater
feed work all cost real time to learn — and deleting it would mean relearning
some of it.

**None of it describes the current product.** Nothing here should be followed
as instructions. In particular:

- there is no TMDB dependency and no `VITE_TMDB_API_KEY`
- there is no YouTube playback, no embed proxy and no Vercel Edge Function
- `endDetection`, the watchdog and the heartbeat are gone; AVFoundation reports
  the end of an item in one notification
- Theater Mode, the six fun modes and the watchlist no longer exist

For what the code does now: `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`.
For what changed and why: `docs/FRONTIER-GO-MIGRATION.md`.
