# frontier go website

Static pages for **https://hobogoblin45.github.io/frontier-go**.

| File | Served at |
| --- | --- |
| `index.html` | `/` |
| `privacy.html` | `/privacy` (App Store privacy policy URL) |
| `support.html` | `/support` (App Store support URL) |
| `favicon.svg`, `og-cover.png` | assets |

Built by `app/tools/site/build.ts`, which also writes:

- `catalog/frontier-catalog.json` — the newest catalog. The app fetches it at
  launch and re-runs its own rights gate on it, so new footage arrives without an
  app update.
- `d/<slug>/index.html` — one page per clip. Shared links from the app open
  these: the clip plays in any browser with its credit line, a rich link
  preview, and an App Store button. The slug comes from `shareSlug()` in
  `app/src/core/history/saved.ts`, which the app uses to build the link, so the
  two cannot drift.
- `404.html` — for links to clips that have since left the catalog.

Pages here use root-relative links (`/privacy`); the build rewrites them to the
`/frontier-go/` project path.

## Deploy

Automatic: `.github/workflows/deploy-site.yml` runs on any push to
`frontier-go` that touches the site or the catalog, and after every weekly
catalog ingest. It checks the deployed site serves the catalog with CORS and the
privacy and support pages before it goes green.

Locally: `cd app`, `npx tsx tools/site/build.ts`, then serve `app/site-dist`.

## History

This folder used to be a Vercel project serving Trailer Roulette, including an
Edge Function at `/embed` that proxied YouTube for the old player. frontier go
needs none of that; the Vercel deployment at `trailer-roulette.vercel.app` is
left as it was.
