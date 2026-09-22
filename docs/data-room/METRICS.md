# Metrics log

The only numbers a buyer believes are Apple's. frontier go has no analytics SDK
and no server, by design ("Data Not Collected"), so App Store Connect is the
source for all of them. It counts users who agree to share with developers,
which undercounts; that is the conservative direction and should be said out
loud rather than adjusted for.

## How the numbers are kept

An ongoing Analytics Reports request is active for the app (created
2026-09-22, id `634292c7-abae-4776-b053-2801ea3bb197`). Apple generates daily,
weekly and monthly files from it. Apple stops a request that nobody reads for a
long time, so the pull below has to run at least once a month.

`.github/scripts/asc-analytics.mjs pull <folder>` downloads every monthly file
not already on disk, checks each one against Apple's checksum, and writes
`SUMMARY.md` beside the raw files. It runs on Charlie's machine and writes to a
private folder, because this repository and its Actions artifacts are public.

```powershell
cd "C:\Users\ccres\OneDrive\Documents\Claude\Projects\Trailer Roulette"
$c = Join-Path $env:USERPROFILE 'trailer-roulette-certs'
$s = Get-Content (Join-Path $c '.secrets-cache.json') -Raw | ConvertFrom-Json
$env:APP_STORE_CONNECT_API_KEY_ID = $s.APP_STORE_CONNECT_API_KEY_ID
$env:APP_STORE_CONNECT_API_KEY_ISSUER_ID = $s.APP_STORE_CONNECT_API_KEY_ISSUER_ID
$env:APP_STORE_CONNECT_API_KEY_PATH = Join-Path $c ('AuthKey_' + $s.APP_STORE_CONNECT_API_KEY_ID + '.p8')
node _deploy\asc-analytics.mjs pull metrics
```

## Monthly row

Copy the month's figures from `metrics/SUMMARY.md` and App Store Connect →
Analytics into this table. Never edit a past row; add a note instead.

| Month | Impressions | Product page views | Conversion | First-time downloads | Active devices (30 d) | Sessions / active device | D1 / D7 / D28 retention | Top source | Rating (count) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10 | | | | | | | | | | First public month |

## What the milestones mean in these columns

From `docs/GROWTH-AND-ACQUISITION-PLAN.md` §5:

- **10k lifetime installs**: running sum of first-time downloads.
- **D30 retention above 10%**: App Store Connect's retention view by install
  cohort. The average iOS app is around 5% **[R]**.
- **~50k MAU**: active devices over 30 days.
- **3+ months of clean analytics**: three consecutive rows here, no gaps.

## What not to do

- Do not add an SDK to get finer numbers before a buyer asks for them. It would
  change the privacy label and spend the "Data Not Collected" position.
- Do not quote on-device telemetry (`core/analytics/`) as usage figures. It never
  leaves the phone and was never meant to be evidence.
