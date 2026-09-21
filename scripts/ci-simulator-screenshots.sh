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
# Captures one file per device size: 01-first-launch, a fresh container with
# the consent sheet up, at the exact pixel size App Store Connect wants.
#
# PRESEEDING CONSENT DOES NOT WORK FROM HERE. Do not try it again without a
# different mechanism entirely. Two attempts, both of which ran green and both
# of which silently produced another first-launch frame:
#   1. `xcrun simctl spawn <udid> defaults write <bundle-id> <key> <value>`.
#      That writes the simulator's own defaults domain, not the app sandbox.
#   2. `defaults write "<data-container>/Library/Preferences/<bundle-id>.plist"`,
#      resolved with `simctl get_app_container`, with the value read back and
#      printed. The read-back is not proof: the simulator runs its own cfprefsd,
#      and a plist written from the host is not what the app sees on next launch.
# Getting past the first screen needs something that drives the UI - an XCUITest
# target, or idb - which is a different piece of work and is not this script.
# Everything past first launch is covered by the device test in
# docs/RELEASE-REVIEW-2026-09.md.
#
# Usage: ci-simulator-screenshots.sh "<device candidates>" <out-dir> <App.app> <policy-version> <WxH>
#        Candidates are comma-separated and tried in order. policy-version is
#        accepted and unused; see above.
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

echo "--- app log, last 40s ---"
xcrun simctl spawn "$udid" log show --last 40s --style compact \
  --predicate 'processImagePath CONTAINS "App.app"' 2>/dev/null | tail -60 || true

xcrun simctl shutdown "$udid" || true
echo "Captured into $OUT_DIR"
