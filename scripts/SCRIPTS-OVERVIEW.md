# Scripts — overview

PowerShell helpers for the one-time setup Charlie has to do himself on Windows,
plus the release helper. Everything else happens in GitHub Actions.

**frontier go needs no build-time API keys.** The previous product required a
TMDB key and a Vercel deployment on the playback path; neither exists now. The
setup scripts that mention them are about the *landing page* and the *iOS
signing material*, not about making the app work.

| # | Script | What it does | Needs |
| --- | --- | --- | --- |
| 1 | `01-setup-local.ps1` | `npm install` plus a lint/test/build smoke run | node 20+ |
| 2 | `02-gen-csr.ps1` | Generate a certificate signing request | openssl |
| 3 | `03-build-p12.ps1` | Turn the Apple-issued `.cer` into a `.p12` | the CSR from step 2 |
| 4 | `04-encode-secrets.ps1` | Base64-encode the signing material for GitHub secrets | step 3 |
| 5 | `05-create-github-repo.ps1` | Create the repo and push (already done for this project) | `gh` login |
| 6 | `06-deploy-vercel.ps1` | Deploy `landing-page/` — marketing and privacy only | `vercel login` |
| 7 | `07-release.ps1` | Bump the version, tag, push, and watch the iOS workflow | `gh` login |
| — | `preflight.ps1` | Check the tree is releasable before tagging | — |

## The one-time list

- [ ] Apple Developer Program membership
- [ ] An App Store distribution certificate and an App Store provisioning
      profile for `app.trailerroulette.ios`
- [ ] An App Store Connect API key (Issuer ID, Key ID, `.p8`)
- [ ] These GitHub secrets: `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`,
      `KEYCHAIN_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `APPLE_TEAM_ID`,
      `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_KEY_ISSUER_ID`,
      `APP_STORE_CONNECT_API_KEY_BASE64`
- [ ] A Vercel account, for the landing page only

`docs/IOS-CERT-SETUP-WINDOWS.md` walks through the certificate steps.

## Releasing

```
cd app
npm run typecheck
npm run lint
npm run test
npm run build
```

Then, from the repository root, on separate lines (PowerShell 5.1 has no `&&`):

```
git add -A
git commit -m "release: v4.0.0 - frontier go"
git tag v4.0.0
git push origin main
git push origin v4.0.0
```

The tag triggers `.github/workflows/ios-release.yml`.

## Security note

`.secrets-cache.json`, if you use script 4, holds the P12 password in plaintext.
It lives in your home directory rather than the repository, and should be
treated as sensitive.
