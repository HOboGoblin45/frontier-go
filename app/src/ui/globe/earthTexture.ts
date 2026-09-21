import { feature } from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry, Position } from 'geojson';

/**
 * The Earth, drawn rather than photographed.
 *
 * A satellite basemap would have been the obvious choice and the wrong one:
 * it would be a large binary asset with its own licence to verify, and it
 * would fight the design, which is editorial and restrained rather than
 * photographic. This draws the coastlines from Natural Earth's 110m land
 * polygons — public domain, 55 KB, shipped in the bundle — into a canvas at
 * runtime. Nothing is fetched, so the globe works on a plane.
 */

const LAND = '#3F4A40';      // charcoal moss
const LAND_EDGE = '#556052';
const OCEAN_DEEP = '#070B0A';
const OCEAN_SHELF = '#101A18';
const GRATICULE = 'rgba(215, 201, 187, 0.05)';

export const TEXTURE_WIDTH = 2048;
export const TEXTURE_HEIGHT = 1024;

type LandCollection = FeatureCollection<Geometry>;

let cached: HTMLCanvasElement | null = null;

function project(lon: number, lat: number, w: number, h: number): [number, number] {
  return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
}

function drawRing(ctx: CanvasRenderingContext2D, ring: Position[], w: number, h: number) {
  ring.forEach(([lon, lat], i) => {
    const [x, y] = project(lon, lat, w, h);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawGeometry(ctx: CanvasRenderingContext2D, geometry: Geometry, w: number, h: number) {
  if (geometry.type === 'Polygon') {
    ctx.beginPath();
    geometry.coordinates.forEach((ring) => drawRing(ctx, ring, w, h));
    ctx.fill();
    ctx.stroke();
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => {
      ctx.beginPath();
      polygon.forEach((ring) => drawRing(ctx, ring, w, h));
      ctx.fill();
      ctx.stroke();
    });
  }
}

export function buildEarthCanvas(width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT): HTMLCanvasElement {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Ocean: a little lighter around the equator so the sphere reads as water
  // with depth rather than a flat black ball.
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, OCEAN_DEEP);
  ocean.addColorStop(0.5, OCEAN_SHELF);
  ocean.addColorStop(1, OCEAN_DEEP);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = GRATICULE;
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = project(lon, 0, width, height);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat, width, height);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  const topology = landTopology as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topology, topology.objects.land) as unknown as LandCollection;

  ctx.fillStyle = LAND;
  ctx.strokeStyle = LAND_EDGE;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  for (const f of land.features) drawGeometry(ctx, f.geometry, width, height);

  cached = canvas;
  return canvas;
}
