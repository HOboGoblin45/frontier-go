# frontier go — landing page

A static marketing and privacy site. Three files and no build step.

There is **no API and no server function**. The previous product shipped a
Vercel Edge Function at `/embed` that proxied YouTube for the app's player;
frontier go plays agency-published files natively and needs nothing from this
deployment. `/embed` now redirects to the home page so any old link resolves
somewhere sensible instead of 404ing.

## Deploy

```
cd landing-page
npx vercel --prod
```

Interactive browser login the first time. Nothing here is on the app's critical
path, so a stale deployment cannot break playback — which was not true before.
