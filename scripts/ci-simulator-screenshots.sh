#!/usr/bin/env bash
#
# Native iOS captures from a CI macOS runner, because there is no Mac on this
# project and every other screenshot it has is a browser draft.
#
# It is a gate before it is a capture. The compile check proves the app builds;
# this is the only thing in the repo that RUNS it. The first run of it proved
# two things nothing else could: the app launches and renders on iOS, and the
# iPad layout fix (docs/bugs.md B7) holds on iPadOS rather than only in
# Chromium at iPad width.
#
# Captures, per device size:
#   01-first-launch        fresh container, so the consent sheet is up.
#                          Submittable.
#   02-after-consent-NNs   acceptance preseeded, so the app arms autoplay. A
#                          burst rather than one guess: the stage is visible
#                          for a moment before the native player takes the
#                          window, and how long depends on how fast TMDB
#                          answers on the runner. Keep whichever lands well.
#                          Anything showing the player has YouTube's frame in
#                          it, so treat those as evidence, not store assets.
#
# Usage: ci-simulator-screenshots.sh "<device candidates>" <out-dir> <App.app> <policy-version> <WxH>
#        Candidates are comma-separated and tried in order.
set -euo pipefail

CANDIDATES="$1"
OUT_DIR="$2"
APP_PATH="$3"
POLICY_VERSION="$4"
EXPECT_SIZE="$5"
BUNDLE_ID="app.trailerroulette.ios"

mkdir -p "$OUT_DIR"

udid=""
device=""
IFS=',' read -ra names <<< "$CANDIDATES"
for name in "${names[@]}"; do
  found=$(xcrun simctl list devices available --json | python3 -c '
import json, sys
want = sys.argv[1].strip()
for runtime, devices in json.load(sys.stdin)["devices"].items():
    if "iOS" not in runtime:
        continue
    for d in devices:
        if d.get("isAvailable") and d["name"] == want:
            print(d["udid"])
            sys.exit(0)
' "$name" || true)
  if [ -n "$found" ]; then udid="$found"; device="$name"; break; fi
done

if [ -z "$udid" ]; then
  echo "None of these simulators are available: $CANDIDATES"
  echo "Xcode has:"
  xcrun simctl list devices available
  exit 1
fi

echo "Using $device ($udid), expecting $EXPECT_SIZE"
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$APP_PATH"

# simctl captures at the device's native resolution, which is exactly what App
# Store Connect wants. Asserting it here means a renamed or resized simulator
# in a future Xcode is caught in CI rather than at upload.
shoot() {
  local name="$1" wait_s="$2"
  sleep "$wait_s"
  xcrun simctl io "$udid" screenshot "$OUT_DIR/$name.png"
  python3 - "$OUT_DIR/$name.png" "$EXPECT_SIZE" <<'PY'
import struct, sys
path, expect = sys.argv[1], sys.argv[2]
with open(path, 'rb') as f:
    head = f.read(24)
w, h = struct.unpack('>II', head[16:24])
got = f"{w}x{h}"
print(f"  {path}: {got}")
if got != expect:
    sys.exit(f"  WRONG SIZE: expected {expect}, got {got}")
PY
}

echo "--- 01: first launch, nothing accepted ---"
xcrun simctl launch "$udid" "$BUNDLE_ID"
shoot "01-first-launch" 15

echo "--- preseeding consent ---"
xcrun simctl terminate "$udid" "$BUNDLE_ID" || true
sleep 2
# Capacitor Preferences (group 'NSUserDefaults') writes to UserDefaults.standard,
# which for a sandboxed app is a plist inside the app's DATA container - not the
# simulator's own defaults domain. `simctl spawn defaults write <bundle-id>` was
# tried first and silently did nothing: the capture still showed the consent
# sheet. Writing the container plist by path is what actually lands. The stored
# value is JSON, so the string is quoted.
container=$(xcrun simctl get_app_container "$udid" "$BUNDLE_ID" data)
plist="$container/Library/Preferences/$BUNDLE_ID.plist"
mkdir -p "$(dirname "$plist")"
defaults write "$plist" "trailer-roulette.policy-accepted" -string "\"$POLICY_VERSION\""
echo "  read back: $(defaults read "$plist" "trailer-roulette.policy-accepted" 2>&1 || echo 'NOT SET')"

echo "--- 02: consent on file, autoplay armed ---"
xcrun simctl launch "$udid" "$BUNDLE_ID"
# Cumulative waits: 4s, 8s, 14s, 22s after launch.
shoot "02-after-consent-04s" 4
shoot "02-after-consent-08s" 4
shoot "02-after-consent-14s" 6
shoot "02-after-consent-22s" 8

echo "--- app log, last 40s ---"
xcrun simctl spawn "$udid" log show --last 40s --style compact \
  --predicate 'processImagePath CONTAINS "App.app"' 2>/dev/null | tail -60 || true

xcrun simctl shutdown "$udid" || true
echo "Captured into $OUT_DIR"
