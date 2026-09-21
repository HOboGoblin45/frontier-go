# App Privacy and age rating — decided answers for 3.5.0

Reviewed 2026-09-21 against Apple's current guidance and against this
checkout. These are answers to paste, not questions to resolve. Each one says
what it rests on and what would change it — check those before submitting,
because a label that stops being true is worse than one that was never filed.

The two must agree with `app/ios/App/App/PrivacyInfo.xcprivacy`, which is
signed into the binary. Changing an answer below without changing the manifest
puts a contradiction in front of the reviewer.

---

## App Privacy: **Data Not Collected**

Apple defines collect as "transmitting data off the device in a way that allows
you and/or your third-party partners to access it for a period longer than what
is necessary to service the transmitted request in real time," and defines
third-party partners as "analytics tools, advertising networks, third-party
SDKs, or other external vendors whose code you've added to your app."

Nothing in this app meets that. The evidence, all checked in this tree:

| Claim | Evidence |
| --- | --- |
| No third-party SDK collects anything | `app/ios/App/Podfile` links Capacitor core, App, Dialog, Haptics and Preferences, plus the two local plugins in this repo. No analytics, ads, attribution or crash SDK. |
| The binary declares no collection and no tracking | `PrivacyInfo.xcprivacy`: `NSPrivacyTracking false`, `NSPrivacyTrackingDomains` empty, `NSPrivacyCollectedDataTypes` empty, one accessed API — UserDefaults, reason CA92.1. |
| No analytics on the web side | No `@vercel/analytics`, no Speed Insights, no tag manager anywhere in `landing-page/` or `app/src/`. |
| No accounts, no server-side store | There is no backend that holds user data. `landing-page/api/embed.js` is a stateless Edge Function that renders a page. |
| Preferences never leave the device | Saved list, filters, mute, consent and the local error log go through `app/src/lib/storage.js` to Capacitor Preferences (NSUserDefaults). Nothing uploads them. |
| The player runs in YouTube's privacy-enhanced origin | `embed.js` frames `https://www.youtube-nocookie.com/embed/...` with `referrerpolicy="strict-origin-when-cross-origin"`. That is a cross-origin iframe the app cannot read. |
| No adult content is requested | `include_adult: false` on every discover and search call in `app/src/lib/tmdb.js` (four call sites). |

TMDB and Google receive what is needed to service a request in real time — a
metadata lookup, a video stream. Neither is a partner whose code was added to
the app to collect data for the developer, and the developer cannot access what
either of them logs.

### What would change this answer

- **Turning on Vercel Analytics or Speed Insights.** That is Usage Data
  collected by the developer's own host, and it would have to be declared and
  added to the manifest. Do not enable it without revisiting this file.
- **Any advertising, attribution or crash SDK**, including one added by a
  Capacitor plugin update. Re-read the Podfile after any dependency bump.
- **Affiliate links** on where-to-watch providers. 3.5.0 has none.
- **Theater Mode shipping.** Location re-enters the assessment, though a
  one-time location used on device and never transmitted is still not
  "collected" — see `docs/RELEASE-REVIEW-2026-09.md` section 9.
- **A reviewer disagreeing.** Apple's rule is that "data collected via web
  traffic must be declared, unless you are enabling the user to navigate the
  open web," and this web view is the developer's own page rather than the open
  web. If that is challenged, the fallback needs no code change: declare
  **Data Not Linked to You → Identifiers (Device ID)** and **Usage Data
  (Product Interaction)**, purposes **Third-Party Advertising** and **App
  Functionality**, **not** used for tracking — and update the manifest to match.
  Non-personalised is defensible because the player is in nocookie mode.

### Other App Store Connect fields

- **Privacy Policy URL**: `https://trailer-roulette.vercel.app/privacy` — set it
  only after the deploy, or the reviewer gets the April page.
- **Tracking / ATT**: **No**, and no ATT prompt. Tracking means linking this
  app's data with other companies' data for targeted advertising or sharing
  with a data broker. Nothing here does that, and the player is in
  privacy-enhanced mode.
- **Do not declare Location.** The public build makes no location request. An
  iOS purpose string existing in Info.plist is not a reason to declare
  collection; if the string is present for the disabled Theater Mode, that is
  still not collection.

---

## Age rating: answer honestly, expect 16+ or 18+

The app plays a random feed of trailers from across cinema and does not filter
by certification. Under-rating is a removal cause, so every answer below is the
one the content actually supports rather than the one that widens the audience.

### Capabilities

| Question | Answer | Why |
| --- | --- | --- |
| Unrestricted Web Access | **No** | There is no in-app browser. The one web view loads a single fixed URL; every other link is an `<a target="_blank">` that hands off to Safari. |
| Advertising | **Yes** | YouTube serves its own ads inside the player and the app may not remove them. The privacy policy, terms, store description and review notes all say so. |
| User-Generated Content | **No** | |
| Social Media | **No** | |
| Messaging and Chat | **No** | The system share sheet is not messaging. |
| Parental Controls | **No** | The app has none of its own. |
| Age Assurance | **No** | |

### Violence

| Question | Answer | Why |
| --- | --- | --- |
| Realistic Violence | **Frequent or Intense** | Action and horror trailers are a large share of a random feed. |
| Cartoon or Fantasy Violence | **Frequent or Intense** | |
| Guns or Other Weapons | **Yes** | |
| Prolonged Graphic or Sadistic Realistic Violence | **None** | Trailers are short and are marketing material cleared for general distribution. |

### Mature themes

| Question | Answer |
| --- | --- |
| Profanity or Crude Humor | **Frequent or Intense** |
| Horror/Fear Themes | **Frequent or Intense** — Horror is a selectable genre |
| Alcohol, Tobacco, or Drug Use or References | **Frequent or Intense** |

### Sexuality or nudity

| Question | Answer | Why |
| --- | --- | --- |
| Mature or Suggestive Themes | **Frequent or Intense** | |
| Sexual Content or Nudity | **Infrequent or Mild** | Trailers are certificated marketing material, and `include_adult: false` is set on every TMDB call. |
| Graphic Sexual Content and Nudity | **None** | |

### Chance-based activities

All **No**: Gambling, Simulated Gambling, Contests, Loot Boxes.

**Say this in the review notes.** "Roulette Wheel" and "Trailer Roulette" invite
the question. The mode spins to pick a decade and then plays a trailer. There is
no wager, no stake, no chips, no odds, no virtual currency and no prize. It is
a randomiser, which is the whole premise of the app.

### Medical or wellness

All **None** / **No**.

### Expected outcome

Frequent or Intense realistic violence, horror themes and profanity will land
this at **16+ or 18+**. That is the honest rating for an unfiltered trailer
channel, and the privacy policy and support page already tell users that
trailers carry violence, strong language and mature themes.

**If a lower rating matters more than the unfiltered feed**, the only legitimate
route is a product change, not a different answer: constrain the TMDB discover
calls by certification (`certification_country` plus `certification.lte`), so
the channel draws only from titles at or below a chosen rating. That narrows the
catalogue considerably and is an owner decision, not a release fix — it is not
in 3.5.0.

---

## Before submitting

- [ ] Vercel Analytics and Speed Insights confirmed off on the project.
- [ ] Podfile re-read after any dependency change since this review.
- [ ] `PrivacyInfo.xcprivacy` still declares no collection and no tracking.
- [ ] Privacy Policy URL set, and `/privacy` confirmed live and current.
- [ ] Age rating answered as above; the gambling note added to review notes.
- [ ] Location **not** declared.
