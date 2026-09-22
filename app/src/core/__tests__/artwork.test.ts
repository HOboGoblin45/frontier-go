import { describe, expect, it } from 'vitest';
import { artworkFor, isAgencyTitleCard, thumbnailFor } from '../catalog/artwork';
import { makeItem } from './fixtures';

function canvas(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const [r, g, b] = paint(x, y);
    const o = (y * w + x) * 4;
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
  }
  return data;
}

describe('agency title cards', () => {
  const W = 640; const H = 360;
  it('recognises an emblem centred on black', () => {
    const card = canvas(W, H, (x, y) => (Math.hypot(x - 320, y - 90) < 80 ? [20, 90, 220] : [4, 4, 6]));
    expect(isAgencyTitleCard(card, W, H)).toBe(true);
  });
  it('leaves a dark deep-sea frame alone', () => {
    const dive = canvas(W, H, (x, y) => (Math.hypot(x - 320, y - 200) < 60 ? [200, 170, 150] : [3, 5, 8]));
    expect(isAgencyTitleCard(dive, W, H)).toBe(false);
  });
  it('leaves open blue water alone', () => {
    const water = canvas(W, H, () => [20, 80, 200]);
    expect(isAgencyTitleCard(water, W, H)).toBe(false);
  });
  it('keeps flagged posters off every surface that shows artwork', () => {
    const card = makeItem({ id: 'c', imagery: { posterUrl: 'https://x/p.jpg', thumbnailUrl: 'https://x/t.jpg', titleCard: true } });
    const frame = makeItem({ id: 'f', imagery: { posterUrl: 'https://x/p.jpg', thumbnailUrl: 'https://x/t.jpg' } });
    expect(artworkFor(card)).toBeUndefined();
    expect(thumbnailFor(card)).toBeUndefined();
    expect(artworkFor(frame)).toBe('https://x/p.jpg');
    expect(thumbnailFor(frame)).toBe('https://x/t.jpg');
  });
});
