#!/usr/bin/env bash
#
# Compile-and-run the Foundation-only logic out of FrontierPlayer.swift on
# Linux, where there is no Mac and no simulator.
#
# UIKit, AVFoundation and Capacitor cannot be type-checked off a Mac, so CI on
# a macOS runner remains the only gate for the file as a whole. What CAN be
# proven here is the part that decides what the player will accept: the item
# parser. It is lifted VERBATIM from the plugin and the copy is diffed back
# against the source, so a harness that has drifted from the code it claims to
# test fails loudly instead of passing quietly.
#
# Usage: ios/Tests/extract-and-run.sh    (needs swiftc on PATH)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../Plugin/FrontierPlayer.swift"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Lift the struct, from its declaration to the closing brace of its init.
awk '/^struct FrontierPlayableItem/,/^}/' "$SRC" > "$WORK/body.swift"
# The struct uses Foundation types; the file it came from imports them higher up.
printf 'import Foundation\n\n' > "$WORK/extracted.swift"
cat "$WORK/body.swift" >> "$WORK/extracted.swift"
if [ ! -s "$WORK/body.swift" ]; then
  echo "FAIL: could not extract FrontierPlayableItem from $SRC" >&2
  exit 1
fi

# Prove the copy is the original.
awk '/^struct FrontierPlayableItem/,/^}/' "$SRC" | diff -q - "$WORK/body.swift" >/dev/null || {
  echo "FAIL: extracted copy differs from source" >&2; exit 1; }

cat > "$WORK/main.swift" <<'SWIFT'
import Foundation

var failures = 0
func check(_ name: String, _ condition: Bool) {
    if condition { print("  ok   \(name)") } else { print("  FAIL \(name)"); failures += 1 }
}

let good = FrontierPlayableItem([
    "id": "noaa:1:2",
    "url": "https://oceanexplorer.noaa.gov/a.mp4",
    "title": "Cusk Eel", "place": "Pacific Ocean", "organization": "NOAA",
    "artworkUrl": "https://oceanexplorer.noaa.gov/a.jpg",
    "durationSeconds": 123.0,
])
check("accepts a complete https item", good != nil)
check("keeps the id", good?.id == "noaa:1:2")
check("keeps the artwork", good?.artworkUrl?.absoluteString == "https://oceanexplorer.noaa.gov/a.jpg")
check("keeps the duration hint", good?.durationHint == 123.0)

check("rejects a missing id", FrontierPlayableItem(["url": "https://a.gov/a.mp4"]) == nil)
check("rejects an empty id", FrontierPlayableItem(["id": "", "url": "https://a.gov/a.mp4"]) == nil)
check("rejects a missing url", FrontierPlayableItem(["id": "a"]) == nil)
check("rejects plain http", FrontierPlayableItem(["id": "a", "url": "http://a.gov/a.mp4"]) == nil)
check("rejects file urls", FrontierPlayableItem(["id": "a", "url": "file:///etc/passwd"]) == nil)
check("rejects a non-url string", FrontierPlayableItem(["id": "a", "url": "not a url at all"]) == nil)

let noArt = FrontierPlayableItem(["id": "a", "url": "https://a.gov/a.mp4", "artworkUrl": "http://a.gov/a.jpg"])
check("drops non-https artwork but keeps the item", noArt != nil && noArt?.artworkUrl == nil)

let blank = FrontierPlayableItem(["id": "a", "url": "https://a.gov/a.mp4"])
check("tolerates missing title, place and organization", blank?.title == "" && blank?.place == "")

if failures > 0 { print("\n\(failures) failed"); exit(1) }
print("\nall checks passed")
SWIFT

swiftc -O "$WORK/extracted.swift" "$WORK/main.swift" -o "$WORK/harness"
"$WORK/harness"
