# App transfer checklist

Apple's criteria are from "App transfer criteria" and "Overview of app transfer"
in App Store Connect Help, read 2026-09-22. The status column was checked
against the live App Store Connect account through the API on the same day.

## Apple's criteria

| Criterion (Apple) | frontier go today | Action |
| --- | --- | --- |
| Both accounts not pending or changing, and both have accepted the latest Paid and Free agreements | Not checkable by API | Charlie: App Store Connect → Business, accept anything pending |
| At least one version released to the App Store | **Not met.** Nothing has ever been released | Ship 4.2.0, then press Release |
| Not available for pre-order anywhere | Not on pre-order | None |
| Status is not Processing for Distribution, Waiting for Review, In Review, Accepted, Pending Developer Release or Pending Apple Release | **Not met.** Trailer Roulette 1.0 is Pending Developer Release | Developer-reject it (web UI only), then release 4.2.0 |
| In-App Purchases approved, ready to submit, removed from sale or rejected | None exist (API: 0 IAPs, 0 subscription groups) | None |
| IAP product ids don't collide with the recipient's | None exist | None |
| Apple-hosted asset packs not waiting for or in review | None | None |
| Not a Mac sandbox app sharing an app group container | iOS only, no app groups | None |
| Not an Apple Arcade app | Not Arcade | None |

## Apple's "before you transfer" items

| Item (Apple) | frontier go | Action |
| --- | --- | --- |
| Turn off TestFlight for all beta versions | One internal group, "Charlie + Close Circle" | Expire builds and remove testers just before transfer |
| Remove Xcode Cloud data | Not used; builds run on GitHub Actions | None |
| APNs certificates or keys | No push notifications | None |
| Apple Pay merchant id | Not used | None |
| App groups, keychain sharing, iCloud, CloudKit | No entitlements file at all | None |
| Sign in with Apple service id | Not used | None |
| Game Center | Not used | None |

## What goes to the buyer outside Apple

| Asset | How it moves |
| --- | --- |
| Repository `HOboGoblin45/frontier-go` | GitHub repository transfer, or a clean export if the history should stay private |
| CI secrets (signing certificate, provisioning profile, API key) | **Do not transfer.** They are Charlie's team's. The buyer adds their own under the same secret names; `docs/CERT-RENEWAL.md` and `docs/IOS-CERT-SETUP-WINDOWS.md` describe how |
| Website | Moves with the repository (GitHub Pages). URLs change to the buyer's account unless a custom domain is attached first. **Attach a domain before a sale** so the privacy, support and share links survive it |
| Catalog refresh | `ingest-catalog.yml` runs weekly on the default branch; it needs no secrets |
| Store listing source | `store-listing/` plus `.github/scripts/asc-store.mjs`; works with the buyer's API key |

## After transfer (buyer side)

1. New bundle-signing certificate and provisioning profile in their team; same bundle id.
2. Their App Store Connect API key in the CI secrets.
3. A tag push to confirm `ios-release.yml` delivers a build to their account.
4. Update `core/platform/site.ts` only if the website URL changed.
