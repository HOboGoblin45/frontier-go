# frontier go

**Go somewhere extraordinary.**

A continuously playing window into extraordinary places on Earth and beyond.
Open it and you are already somewhere — three kilometres down a Pacific
seamount, on a rocket test stand in Mississippi, looking at a hurricane from
orbit. Tap Shuffle and the globe carries you somewhere else.

No account. No search. No decisions.

- **iOS**, Capacitor 7 + React 18 + TypeScript + Vite 5, native AVFoundation playback
- Bundle id `app.trailerroulette.ios` (see [why](docs/FRONTIER-GO-MIGRATION.md#7-the-bundle-identifier)) - repo `github.com/HOboGoblin45/trailer-roulette-ios`
- Built from Trailer Roulette. The audit and migration are in [`docs/FRONTIER-GO-MIGRATION.md`](docs/FRONTIER-GO-MIGRATION.md).

---

## What it is

Six interactions, and that is the whole product:

**Watch** - the footage fills the screen. A title, a place, a depth or an
altitude, and a Shuffle button. Controls fade after a few seconds.

**Shuffle** - the picture veils over, the destination is named, and the next
place is already playing. It does not touch the network: the next asset was
handed to the native queue the moment this one started.

**Travel** - every jump is somewhere genuinely different. The shuffle engine
scores geographic and environmental contrast explicitly, so the channel does not
serve five jellyfish in a row.

**Keep Exploring Here** - narrow the universe to this expedition, this mission
or this region. **Go Anywhere** widens it again. Two buttons, no filter screen.

**The Globe** - a Three.js Earth showing where there is something to watch,
where you have been, and where you are now. It replaces the browse page.

**The Discovery Passport** - a passive record of the places you have been. No
points, no streaks, no badges.

## Where the footage comes from

| Provider | Content | Rights |
| --- | --- | --- |
| NOAA Ocean Exploration | ROV dives, vents, seamounts, shipwrecks, deep-ocean animals | U.S. Government work; [usage terms](https://oceanexplorer.noaa.gov/about/media-kit/) |
| NASA | ISS Earth views, EVA, launches, engine tests, Mars and Apollo | U.S. Government work; [usage terms](https://www.nasa.gov/nasa-brand-center/images-and-media/) |

Every item carries explicit rights metadata and the gate **fails closed**:
unknown classification, no commercial-use permission, or a missing credit line
all mean exclusion. There is no "probably public domain" path in this codebase.
`docs/CATALOG-REJECTIONS.md` records what was excluded and why;
`docs/RIGHTS-REVIEW.md` records what still needs human eyes.

Nothing is fetched from a provider at runtime. A GitHub Actions workflow builds
the catalog and commits it; the app ships with it and works on a plane.

## Repository layout

```
app/
  src/
    core/          platform-agnostic: types, catalog, shuffle, history, analytics
    providers/     NOAA and NASA adapters, gazetteer, rights rules
    player/        Capacitor plugin wrapper + a real web implementation
    state/         useFrontier: the one place the pieces meet
    ui/            design system, screens, the globe
  tools/ingest/    the catalog pipeline
  public/catalog/  the generated catalog, committed
  local-plugins/frontier-player/    Swift: AVQueuePlayer, AirPlay, PiP, Now Playing
  ios/App/         the committed Xcode project
assets/            icon master + rendered set, launch screen
docs/              architecture, migration, rights review, rejections
landing-page/      the marketing site (static; no server, no API)
```

## Working on it

```bash
cd app
npm install
npm run dev          # browser, real catalog, real streams
npm run typecheck
npm run lint
npm run test
npm run build
npm run ingest -- --limit 200        # rebuild the catalog from the providers
npm run ingest -- --providers noaa   # one provider
```

Native Swift cannot be typechecked off a Mac. What can be done locally:

```bash
# syntax-check the whole plugin
swiftc -frontend -parse app/local-plugins/frontier-player/ios/Plugin/FrontierPlayer.swift

# compile and RUN the Foundation-only logic, verified against the source
app/local-plugins/frontier-player/ios/Tests/extract-and-run.sh
```

## Shipping

```
git add -A
git commit -m "release: v4.0.0 - frontier go"
git tag v4.0.0
git push origin main
git push origin v4.0.0
```

The tag triggers `.github/workflows/ios-release.yml`, which builds, signs and
uploads to TestFlight on a macOS runner. No Mac required.

On device, the first thing to check is **Profile → Diagnostics → Player**. It
must read `Native AVFoundation · active`. If it says `Web fallback · native NOT
bound`, the Swift class has lost its `CAPBridgedPlugin` conformance and every
native capability is silently absent.

## Licence

Application code: see [LICENSE](LICENSE). Footage belongs to the organisations
credited on it and is used under the terms linked above.
