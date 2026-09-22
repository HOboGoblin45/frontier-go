/**
 * Where frontier go lives on the web.
 *
 * GitHub Pages, built from this repository by `deploy-site.yml` every time the
 * site or the catalog changes. Free, needs no account beyond the repository,
 * and moves with it in a sale. One constant, because a custom domain or a new
 * owner changes exactly this line - and the github.io address keeps serving
 * after a custom domain is attached, so links already shared never break.
 */
export const SITE_URL = 'https://hobogoblin45.github.io/frontier-go';

export const APP_STORE_ID = '6764209094';
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const SUPPORT_URL = `${SITE_URL}/support`;
/** Apple's standard licence agreement, which this app uses rather than a custom one. */
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * The newest catalog, published with the site after every weekly ingest. The
 * app re-runs its own rights and eligibility gates on whatever arrives, so
 * this URL is a delivery route and never an authority.
 */
export const REMOTE_CATALOG_URL = `${SITE_URL}/catalog/frontier-catalog.json`;
