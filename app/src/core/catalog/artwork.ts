import type { FrontierMediaItem } from '../types/media';

/**
 * Artwork that is fit to show.
 *
 * About one NOAA poster in five is not a frame of the dive at all: it is the
 * agency's title card - the NOAA emblem, centred on black, over the clip's
 * name. Shown as a thumbnail, a lock-screen image or a link preview it reads
 * as NOAA branding the app, and the emblem is a registered mark "not to be used
 * as a branding device". The ingest flags those cards (`imagery.titleCard`) and
 * everything that picks an image goes through here.
 */
export function artworkFor(item: FrontierMediaItem | null | undefined): string | undefined {
  if (!item || item.imagery.titleCard) return undefined;
  return item.imagery.posterUrl || item.imagery.thumbnailUrl;
}

/** Same, preferring the smaller image for lists. */
export function thumbnailFor(item: FrontierMediaItem | null | undefined): string | undefined {
  if (!item || item.imagery.titleCard) return undefined;
  return item.imagery.thumbnailUrl || item.imagery.posterUrl;
}

/**
 * Is this decoded image an agency title card?
 *
 * Sampled on a 64x36 grid: the card is overwhelmingly black (the frame around
 * the emblem and the caption), with a saturated blue disc in the upper
 * centre. Calibrated on 120 random NOAA posters - it flagged 22, all of them
 * emblem cards, and none of the dark deep-sea frames or the blue open-water
 * shots that each satisfy one half of the test.
 */
export function isAgencyTitleCard(rgba: Uint8Array | Uint8ClampedArray | number[], width: number, height: number): boolean {
  if (width < 16 || height < 9) return false;
  const W = 64;
  const H = 36;
  let dark = 0;
  let boxBlue = 0;
  let boxTotal = 0;
  for (let gy = 0; gy < H; gy += 1) {
    for (let gx = 0; gx < W; gx += 1) {
      const x = Math.min(width - 1, Math.floor(((gx + 0.5) / W) * width));
      const y = Math.min(height - 1, Math.floor(((gy + 0.5) / H) * height));
      const o = (y * width + x) * 4;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      if (Math.max(r, g, b) < 40) dark += 1;
      if (gx >= 24 && gx < 40 && gy >= 2 && gy < 20) {
        boxTotal += 1;
        if (b > 140 && b > r + 60) boxBlue += 1;
      }
    }
  }
  return dark / (W * H) >= 0.7 && boxBlue / boxTotal >= 0.25;
}
