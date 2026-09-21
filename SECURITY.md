# Security policy — frontier go

## Reporting

Email **crescicharles@gmail.com** with "frontier go security" in the subject.
Please do not open a public issue for a vulnerability. Expect an
acknowledgement within a few days; this is a one-person project.

## What the app's attack surface actually is

Deliberately small, and worth stating plainly because it shapes what is worth
reporting:

- **No server.** No API, no backend, no database, no user accounts, no sessions,
  no authentication. The catalog ships inside the app.
- **No user-generated content.** Nothing is uploaded, submitted or shared
  between users.
- **No personal data.** No sign-in, no location permission, no analytics SDK,
  no advertising identifier. What the app remembers stays in Capacitor
  Preferences on the device.
- **Outbound network is two hosts.** `oceanexplorer.noaa.gov` and
  `images-assets.nasa.gov`, over HTTPS, for video only. Every stream URL in the
  catalog is validated as `https://` by the eligibility gate, in the pipeline
  and again on the client.
- **No remote code.** Nothing is `eval`d, no remote scripts, no web view
  navigation to a third-party origin.

## Secrets

The repository contains no secrets and needs none at build time. iOS signing
material lives in GitHub Actions secrets and is never written to the repository.
If you believe a secret has been committed, report it privately rather than
opening an issue.

## Supported versions

The most recent App Store release.
