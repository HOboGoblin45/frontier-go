import type { FrontierLocation } from '../../core/types/location';
import type { FrontierEnvironment } from '../../core/types/location';
import { UNKNOWN_LOCATION } from '../../core/types/location';
import { lookupNamedRegion, lookupOceanBasin } from '../gazetteer';

/**
 * Depth extraction.
 *
 * NOAA writes depth into captions in a handful of stable shapes
 * ("at a depth of 2,940 meters", "1,500 meters (4,921 feet) deep"). We read
 * those and nothing else: a bare "50 meters" with no depth cue nearby is far
 * more likely to be the length of a ridge than the depth of a dive, so it is
 * ignored rather than guessed at.
 */
const DEPTH_CUE = /(depth|deep|below the (?:sea )?surface|beneath the surface|down at)/i;

export function extractDepthMeters(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const re = /([\d][\d,.]*)\s*(meters|metres|m\b)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1].replace(/,/g, '');
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 11000) continue;
    const window = text.slice(Math.max(0, match.index - 45), match.index + match[0].length + 25);
    if (DEPTH_CUE.test(window)) return Math.round(value);
  }
  return undefined;
}

export interface NoaaGeoInput {
  expeditionTitle?: string;
  multimediaTitle: string;
  description: string;
  credit?: string;
  oceanBasinNames: string[];
}

/**
 * Resolve the most specific honest location: a named operating area if the
 * expedition names one, otherwise the ocean basin NOAA has tagged, otherwise
 * nothing. An unresolved location stays unresolved.
 */
export function resolveNoaaLocation(input: NoaaGeoInput): FrontierLocation {
  const named = lookupNamedRegion(
    `${input.expeditionTitle || ''} ${input.multimediaTitle} ${input.credit || ''}`,
  );
  const basin = input.oceanBasinNames
    .map((n) => lookupOceanBasin(n))
    .find((x): x is FrontierLocation => !!x) || null;

  const base = named && typeof named.latitude === 'number' ? named : (basin || named);
  if (!base) return { ...UNKNOWN_LOCATION };

  const depthMeters = extractDepthMeters(input.description) ?? extractDepthMeters(input.multimediaTitle);
  return {
    ...base,
    // A basin match keeps the named region label when we have one.
    regionName: named?.regionName || base.regionName,
    depthMeters,
    type: 'underwater',
  };
}

const SURFACE_CUES = ['ship', 'vessel', 'deck', 'crew', 'launch and recovery', 'bridge', 'shipboard'];
const VOLCANIC_CUES = ['hydrothermal', 'vent', 'volcano', 'volcanic', 'caldera', 'lava', 'seamount eruption'];
const POLAR_CUES = ['arctic', 'antarctic', 'ice', 'polar'];

export function resolveNoaaEnvironment(
  depthMeters: number | undefined,
  title: string,
  description: string,
  topics: string[],
): FrontierEnvironment {
  const blob = `${title} ${description} ${topics.join(' ')}`.toLowerCase();
  if (SURFACE_CUES.some((c) => blob.includes(c)) && !blob.includes('rov') && !blob.includes('dive')) {
    return 'surface_vessel';
  }
  if (VOLCANIC_CUES.some((c) => blob.includes(c))) return 'volcanic';
  if (POLAR_CUES.some((c) => blob.includes(c))) return 'polar';
  if (typeof depthMeters === 'number') return depthMeters >= 200 ? 'deep_ocean' : 'shallow_ocean';
  return 'deep_ocean';
}
