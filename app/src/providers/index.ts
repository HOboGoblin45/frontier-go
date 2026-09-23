import type { FrontierProviderAdapter } from './types';
import { noaaAdapter } from './noaa/adapter';
import { nasaAdapter } from './nasa/adapter';
import { npsAdapter } from './nps/adapter';
import { locAdapter } from './loc/adapter';

/**
 * The provider registry. Adding a source means adding an adapter here and
 * nothing else — no downstream system knows the list.
 */
export const ADAPTERS: FrontierProviderAdapter[] = [noaaAdapter, nasaAdapter, npsAdapter, locAdapter];

export { noaaAdapter, nasaAdapter, npsAdapter, locAdapter };
export * from './types';
