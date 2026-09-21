# Evidence behind the reorientation

These four documents were written on `release/public-3.5` on 2026-09-21, the
day before frontier go, and they are the reasoning the reorientation rests on.
They are kept here rather than in the archive because they are not history —
they are the argument.

| Document | What it establishes |
| --- | --- |
| `TRAILER-SOURCES-2026-09.md` | There is no lawful non-YouTube trailer catalogue. The content problem has no content solution. |
| `PIVOT-OPTIONS-2026-09.md` | The pivot question and the advertising question have the same answer, and it is a *player* question: get playback into AVPlayer. Every lawful source hands you a direct `.mp4` or `.m3u8`, because a rightsholder who gives you a raw URL has given up control of the playback surface — which is exactly what an ad-supported platform never does. |
| `MONETIZATION-2026-09.md` | What can and cannot be charged for, and why an honest ad-free mode needs a library willing to be played by a player it does not own. |
| `RELEASE-REVIEW-2026-09.md` | The state of the 3.5.0 release, which frontier go supersedes. |

Its recommendation was "do not pivot, add a second channel", on the reasoning
that the AVPlayer work pays for itself either way. frontier go takes the same
technical conclusion further: the second channel became the product. What that
changes is scope, not the analysis — and the analysis named the corpus this app
should keep growing into, roughly 28,000 rights-clean items across the Library
of Congress, Prelinger, US government films and NASA.

Two of those are already live (`providers/nasa`, and NOAA which the survey did
not cover). Library of Congress and Prelinger are the next adapters, and
`providers/index.ts` is the only file that has to know they exist.
