# Revenue plan - September 21, 2026

Recommendation: launch a reliable free channel first; test a paid collection/game expansion next. Treat ticket referral revenue as a small optional addition, not the business model. Charlie approved monetization after launch. No purchases, affiliate IDs or ad SDKs were enabled in 3.5.0.

## What to sell

| Avenue | Concrete offer to test | Priority and dependency |
|---|---|---|
| One-time upgrade | $4.99 or $7.99 hypothesis: named movie-night collections, reusable filter presets, richer locally scored party games and export of your own saved list | First consumer experiment. These would be new app functions; do not paywall YouTube playback or charge to remove YouTube ads. Requires TMDB commercial terms, StoreKit purchase/restore and a later tested release. |
| Theater partnerships | A cinema-approved programming channel and editorial placement on a separate discovery screen, with clearly disclosed sponsorship | Stronger differentiation and distribution potential; written feed/brand permission and commercial data rights first. Do not sell unlicensed public-exhibition rights or imply YouTube supports commercial lobby playback. |
| Ticket referrals | Disclosed outbound links under an approved partner agreement | Easy only after acceptance, attribution/deep-link testing and TMDB approval. No current commission or enrollment verified. The old Fandango affiliate URL redirects to its home page. |
| Subscription | Ongoing original game/editorial content, only if users return and request it | Defer. A basic randomizer does not establish recurring value. New content production creates continuing cost. |
| Display ads | Potentially on an independent non-player discovery surface | Last choice: weak fit with the product and privacy posture. YouTube restricts monetization around its content; never overlay, replace, skip or claim removal of its ads. |

## Economics - assumptions, not forecasts

At 10,000 new installs, a $4.99 one-time upgrade yields about $424 / $1,272 / $2,121 after a modeled 15% store fee at 1% / 3% / 5% conversion. Taxes, refunds, licensing, support and hosting are excluded. At a 30% fee the same cases are $349 / $1,048 / $1,747. These are cohort receipts, not monthly recurring revenue. A $7.99 offer at 3% conversion and 15% fee yields about $2,037 per 10,000 installs.

Illustrative ticket referrals: 5,000 active users x 4% purchasing x $0.50 hypothetical net commission = $100/month. None of those inputs is measured or an actual partner quote. This is why referrals are supplementary. Break-even upgrades = monthly fixed costs / (price x (1 - actual fee)); use written TMDB pricing before making the decision. Apple Small Business enrollment is not automatic and account eligibility is unverified.

## A practical first 30 days after release

1. Recruit 20 willing movie-night testers. Ask them to complete one 15-minute session and report interruptions, repeated titles, device/receiver and whether they would return. No messages have been sent on Charlie's behalf.
2. Use voluntary support feedback and Apple's available aggregate App Store Connect reports; no tracking SDK. Target zero repeatable channel-stopping defects in the test group before promotion. Retention from Apple reports depends on available consented data; label sample size.
3. Interview ten repeat users about saved collections, filter presets and game scoring. Show a concrete $4.99/$7.99 feature description and record willingness to pay, without charging or pretending it exists.
4. Request commercial TMDB terms and one independent cinema pilot with permission to use its schedule and branding. Partner with the cinema for distribution only after acceptance.
5. Build one small paid bundle if the interviews show demand and the licensing quote supports its margin. Keep existing free features free. Use StoreKit non-consumables with restore, purchase cancellation, offline entitlement and Family Sharing decisions explicitly tested.

Avoid paid acquisition until organic repeat use and upgrade economics are measured. Without user tracking, prefer labeled campaign links and aggregate store reporting rather than personal attribution.

## Evidence and permission limits

[TMDB FAQ](https://developer.themoviedb.org/docs/faq) defines a revenue-focused project as commercial and directs developers to its sales team. A free launch is not automatically non-commercial when its purpose is revenue: disclose this roadmap to TMDB and obtain the appropriate terms before monetizing (or launch if TMDB says required). Pricing and approval are unverified.

[YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies) govern charging and advertisements around YouTube services. Inference: charge only for independently valuable app functionality, subject to review of the specific design; never sell access to the trailers themselves.

[Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/) provides a reduced commission for qualifying enrolled developers; the numbers above are scenarios, not this account's verified rate. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) govern digital feature purchases.

[Fandango's old affiliate address](https://www.fandango.com/affiliateprogram) redirected to its homepage on this review. Historical PDFs and aggregator commission rates are not evidence of current admission or payout terms. Ask the partner for current written terms; do not build a forecast from them.
