# Icons — pre-rendered PNG set

Generated from `assets/icon-master-1024.svg` with `sharp` at density 600.

The mark is a thin globe with one bronze point. There is no wordmark in it:
"frontier go" is set in Inter and is unreadable below about 120px, and an icon
that only works on the App Store page is not an icon. The strokes are Warm
Stone rather than the palette's mid-greens, which vanish against Forest Black at
40 points — checked on a contact sheet at 180, 120, 80, 58 and 40px before it
was accepted.

## Regenerate

```bash
node -e "
const sharp = require('./app/node_modules/sharp');
const fs = require('fs');
const sizes = [20,29,40,58,60,80,87,120,152,167,180,1024];
const svg = fs.readFileSync('assets/icon-master-1024.svg');
(async () => {
  for (const s of sizes) {
    await sharp(svg, { density: 600 }).resize(s, s).png({ compressionLevel: 9 })
      .toFile('assets/icons/icon-' + s + '.png');
  }
})();
"
```

The sizes here are exactly the ones `Contents.json` references; adding a file
that nothing references makes Xcode warn about an unassigned child.

`.github/workflows/ios-release.yml` copies this folder over
`AppIcon.appiconset` after `cap sync`, because `cap sync` overwrites it.

## Launch screen

`assets/launch-screen.png` renders from `assets/launch-screen.svg` at
2732x2732. Forest Black with the same mark, small and centred. Nothing animates.
