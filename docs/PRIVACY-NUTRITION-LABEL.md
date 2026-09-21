# App Store privacy answers — frontier go

What to enter in App Store Connect → App Privacy. These answers must stay true
to `docs/PRIVACY-POLICY.md` and to the code.

## Data collection

**"Do you or your third-party partners collect data from this app?"**

> **No**

That answer is only correct because all of the following are true, and each one
should be re-checked before it is submitted:

| Claim | Where to verify |
| --- | --- |
| No analytics or attribution SDK | `app/package.json` dependencies |
| No crash reporter | same |
| No advertising identifier, no App Tracking Transparency prompt | no `AppTrackingTransparency` import anywhere in `app/ios/` |
| No account, no sign-in | there is no auth code in the repo |
| No location permission requested | `Info.plist` contains no `NSLocation*UsageDescription` key |
| Telemetry never leaves the device | `core/analytics/analytics.ts` — an in-memory ring buffer with no sink attached |
| History and saved items never leave the device | `core/platform/storage.ts` — Capacitor Preferences only |

**If any of those stops being true, this answer must change before release.**

## Permissions declared

| Permission | Requested | Why |
| --- | --- | --- |
| Location | No | The globe shows where the footage came from, not where you are. |
| Camera, microphone, photos, contacts, calendars, health | No | Nothing in the product uses them. |
| Background audio (`UIBackgroundModes: audio`) | Yes | Playback continues with the screen locked, and Picture in Picture requires it. Not a privacy permission and not prompted. |

## Age rating

**4+.** No user-generated content, no chat, no web browser, no purchases, no
gambling. The footage is scientific and expedition material published by U.S.
federal agencies, filtered against graphic and disturbing content at ingest
(`core/types/safety.ts`).

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false`. The app uses HTTPS and nothing else.
