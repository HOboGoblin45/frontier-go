import type { FrontierProviderAdapter } from './types';
import { noaaAdapter } from './noaa/adapter';
import { nasaAdapter } from './nasa/adapter';

/**
 * The provider registry. Adding National Park Service, USGS, DVIDS or a
 * qualified live feed means adding an adapter here and nothing else — no
 * downstream system knows the list.
 */
export const ADAPTERS: FrontierProviderAdapter[] = [noaaAdapter, nasaAdapter];

export { noaaAdapter, nasaAdapter };
export * from './types';
