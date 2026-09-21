#!/usr/bin/env bash
#
# Native iOS captures from a CI macOS runner, because there is no Mac here and
# the only other screenshots this project has are browser drafts.
#
# Two shots per device size:
#   01-first-launch   fresh container, so the first-run consent sheet is up.
#                     This one is submittable.
#   02-after-consent  acceptance preseeded into NSUserDefaults, so the app
#                     arms autoplay and hands off to the native player. This
#                     one is EVIDENCE - it proves the app launches, renders and
#                     opens its player on iOS - and is usually not submittable,
#                     because whatever YouTube is showing lands in the frame.
#
# It is also the only gate in this repo that runs the app at all. The compile
# check proves it builds; this proves it does not die on launch.
#
# Usage: ci-simulator-screenshots.sh "<device name candidates>" <out-dir> <App.app> <policy-version>
#        Candidates are comma-separated and tried in order.
set -euo pipefail

CANDIDATES="$1"
OUT_DIR="$2"
APP_PATH="$3"
POLICY_VERSION="$4"
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

echo "Using $device ($udid)"
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$APP_PATH"

# simctl captures at the device's native resolution, which is exactly what App
# Store Connect wants: 1320x2868 for 6.9-inch, 2064x2752 for 13-inch. Printing
# it means a wrong simulator is caught here rather than at upload.
shoot() {
  local name="$1" wait_s="$2"
  sleep "$wait_s"
  xcrun simctl io "$udid" screenshot "$OUT_DIR/$name.png"
  python3 - "$OUT_DIR/$name.png" <<'PY'
import struct, sys
path = sys.argv[1]
with open(path, 'rb') as f:
    head = f.read(24)
w, h = struct.unpack('>II', head[16:24])
print(f"  {path}: {w} x {h}")
PY
}

echo "--- 01: first launch, nothing accepted ---"
xcrun simctl launch "$udid" "$BUNDLE_ID"
shoot "01-first-launch" 15

echo "--- 02: consent preseeded, autoplay armed ---"
xcrun simctl terminate "$udid" "$BUNDLE_ID" || true
# Capacitor Preferences stores JSON in NSUserDefaults, so the value on disk is
# a quoted string. Best-effort: if this does not take, 02 simply shows the
# consent sheet again, which the artifact makes obvious.
xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" \
  "trailer-roulette.policy-accepted" -string "\"$POLICY_VERSION\"" || true
xcrun simctl launch "$udid" "$BUNDLE_ID"
shoot "02-after-consent" 20

echo "--- app log, last 40s ---"
xcrun simctl spawn "$udid" log show --last 40s --style compact \
  --predicate 'processImagePath CONTAINS "App.app"' 2>/dev/null | tail -60 || true

xcrun simctl shutdown "$udid" || true
echo "Captured into $OUT_DIR"
