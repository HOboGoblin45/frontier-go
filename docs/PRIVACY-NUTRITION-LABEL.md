# App Privacy review for 3.5.0

Status: final App Store Connect answers require Charlie's verification. Do not automatically retain the old Data Not Collected answer.

The app has no accounts, analytics SDK or IDFA use. Preferences (saved list, filters, mute, consent, local diagnostics) are local. Theater Mode is disabled by default; no location request occurs in the public build. Development-only Near me calculates distance locally without transmitting coordinates.

TMDB and YouTube requests carry normal network information. Vercel serves the player page and has standard request logs. Support email contains data voluntarily supplied to the developer. The app-level privacy manifest declares UserDefaults CA92.1 and no app tracking/data collection; this does not replace the App Store questionnaire or certify third-party collection.

Review [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), particularly third-party partners and web views. Embedded browsing is not a blanket exemption: assess the actual YouTube integration and retention/use of data before selecting answers. Review third-party policies and Vercel logging configuration. If the outcome differs from the manifest's current empty collected-data list, update both before submission. Record the decision and evidence here.

Charlie: in App Store Connect > Trailer Roulette > App Privacy, verify data types, purposes, linkage and tracking. Set Privacy Policy URL to https://trailer-roulette.vercel.app/privacy after it is live. Do not declare local-only coordinates as collected solely because an iOS purpose string exists. Revisit the review if adding affiliates, purchases, tracking or theater feeds.
