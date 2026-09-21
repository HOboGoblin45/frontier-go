/**
 * TMDB API wrapper — minimal surface for the iOS port.
 *
 * Auth strategy: prefer v4 Bearer token via Authorization header (the modern
 * TMDB recommendation, and more reliable through Capacitor's native iOS HTTP
 * layer than v3 query-string auth which the WKWebView CORS layer was mangling).
 *
 * Falls back to v3 ?api_key= for local dev where only that's configured.
 */
const API_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const BEARER = import.meta.env.VITE_TMDB_BEARER_TOKEN || '';

if (!API_KEY && !BEARER) {
  console.warn('[tmdb] Neither VITE_TMDB_API_KEY nor VITE_TMDB_BEARER_TOKEN is set');
}

// Small in-memory cache for per-movie lookups so re-surfacing a movie or
// re-rendering doesn't re-hit TMDB. Cleared on app restart; no persistence.
const _cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
async function cached(key, fn) {
  const hit = _cache.get(key);
  if (hit && (Date.now() - hit.t) < CACHE_TTL_MS) return hit.v;
  const v = await fn();
  _cache.set(key, { v, t: Date.now() });
  return v;
}

async function call(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  const headers = { Accept: 'application/json' };
  if (BEARER) {
    headers.Authorization = `Bearer ${BEARER}`;
  } else if (API_KEY) {
    url.searchParams.set('api_key', API_KEY);
  }
  let r;
  try {
    r = await fetch(url.toString(), { headers });
  } catch (e) {
    const err = new Error(`TMDB network error: ${e.message || e}`);
    err.cause = e;
    throw err;
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`TMDB ${r.status} ${r.statusText} @ ${path} :: ${body.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * Upper bound for the optional 'classic' era filter (pre-2010). The app's
 * default catalog spans ALL eras of cinema; selecting Classic caps results
 * at this date, while Modern starts at 2010.
 */
export const DEFAULT_ERA_END = '2009-12-31';

/**
 * Turn user filter selections into /discover query params (filters feature,
 * v3.4.3).
 *   decades: array of decade start-years, e.g. [1980, 1990]. Multiple decades
 *            collapse to the contiguous span between the earliest and latest
 *            pick ("the 80s and 90s" → 1980–1999). This matches how the feed
 *            draws years on every other path: a single primary_release_date
 *            window.
 *   genres:  array of TMDB genre ids → with_genres (OR semantics).
 * Returns {} when nothing is selected, so callers can spread it unconditionally.
 */
export function filtersQuery({ decades = [], genres = [] } = {}) {
  const q = {};
  if (Array.isArray(genres) && genres.length > 0) {
    q.with_genres = genres.filter(Number.isFinite).join(',');
  }
  if (Array.isArray(decades) && decades.length > 0) {
    const lo = Math.min(...decades);
    const hi = Math.max(...decades);
    q['primary_release_date.gte'] = `${lo}-01-01`;
    q['primary_release_date.lte'] = `${hi + 9}-12-31`;
  }
  return q;
}

export async function discoverMovies({ genre, genres, decade, decades, era = 'all', page = 1 } = {}) {
  // The floor exists to keep out the long tail of no-vote uploads - DVD
  // extras, shorts, untitled fragments - not to keep the feed famous. It used
  // to be 200 unfiltered, which did the second thing; see CATALOG_VOTE_FLOOR.
  // A user-applied filter goes lower still, because a chosen niche is thinner
  // by nature and the user has already told us what they want.
  const params = {
    sort_by: 'popularity.desc',
    page,
    include_adult: false,
    'vote_count.gte': (genres?.length || decades?.length) ? 20 : CATALOG_VOTE_FLOOR,
  };
  const today = new Date().toISOString().slice(0, 10);
  Object.assign(params, filtersQuery({ decades, genres }));
  if (genre) params.with_genres = String(genre);
  if (decade) {
    params['primary_release_date.gte'] = `${decade}-01-01`;
    params['primary_release_date.lte'] = `${Number(decade) + 9}-12-31`;
  } else if (!params['primary_release_date.gte']) {
    // No decade window (single or multi) — apply the era window instead.
    if (era === 'classic') {
      // Classic: released up to and including 2009.
      params['primary_release_date.lte'] = DEFAULT_ERA_END;
    } else if (era === 'modern') {
      // Modern: 2010 through today. Capping at today excludes unreleased/future
      // titles so the queue isn't dominated by hyped upcoming releases.
      params['primary_release_date.gte'] = '2010-01-01';
      params['primary_release_date.lte'] = today;
    } else {
      // 'all' (default): everything released up to today — the cap keeps the
      // catalog from over-indexing on not-yet-released hype.
      params['primary_release_date.lte'] = today;
    }
  }
  return call('/discover/movie', params);
}

/**
 * A filter-friendly batch: learn the filtered corpus's page count from page
 * 1, then sample extra pages WITHIN it. The queue's unfiltered path samples
 * a random page in 1..500, but a filtered corpus is small (1980s Horror is
 * only ~10-20 pages), so blindly sampling 1..500 mostly lands on empty pages
 * and the feed would silently fall back to Everything. First page always
 * included; up to `pages` extra random pages within [1, total_pages].
 * A failed extra-page fetch degrades gracefully (page 1 alone still returns).
 */
export async function discoverFilteredMix({ genres = [], decades = [], pages = 3 } = {}) {
  const q = { genres, decades };
  const first = await discoverMovies({ ...q, page: 1 });
  const total = Math.max(1, first.total_pages || 1);
  const seen = new Set();
  const results = [];
  for (const m of first.results || []) {
    if (m && !seen.has(m.id)) { seen.add(m.id); results.push(m); }
  }
  if (total > 1) {
    const attempted = new Set([1]);
    let guard = 0;
    while (attempted.size < Math.min(pages, total) + 1 && guard < 50) {
      guard += 1;
      const p = pickDiscoverPage(total);
      if (p === 1 || attempted.has(p)) continue;
      attempted.add(p);
      const d = await discoverMovies({ ...q, page: p }).catch(() => null);
      if (!d) continue;
      for (const m of d.results || []) {
        if (m && !seen.has(m.id)) { seen.add(m.id); results.push(m); }
      }
    }
  }
  return results;
}

// TMDB's /discover endpoint paginates the full catalog (20 results per page)
// but only exposes the first 500 pages. We pick a random page within the
// known range so the queue keeps drawing fresh movies from deep in the
// catalog instead of replaying page 1's ~20 most-popular titles forever.
export const TMDB_MAX_DISCOVER_PAGE = 500;

export function pickDiscoverPage(totalPages, max = TMDB_MAX_DISCOVER_PAGE) {
  const cap = Math.min(Math.max(1, Math.floor(totalPages || 1)), max);
  if (cap <= 1) return 1;
  return Math.floor(Math.random() * cap) + 1;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Where the catalog starts. 1950 rather than 1970 (owner decision 2026-09-21):
 * noir, the New Wave and early colour Hollywood are exactly the "all kinds of
 * cinema" this app is for, and enough of their trailers survive on YouTube to
 * stay playable. Earlier than this the trailers thin out badly.
 */
export const CATALOG_START_YEAR = 1950;

/**
 * The vote floor the whole feed draws against, and the single most important
 * number in this file.
 *
 * It used to be 40-180, rising for newer decades, with a comment saying the
 * floors kept titles "recognizable". They did, and that was the bug: combined
 * with maxPage 2-5 the feed could only ever see the top 40-100 most popular
 * films of a year, which is a list of blockbusters, not a roulette. Measured
 * against live TMDB on 2026-09-21, that feed averaged 4,631 votes per pick and
 * returned Alien, Pulp Fiction, Shawshank, Forrest Gump and Godzilla vs. Kong.
 *
 * 30, sampling the FULL page range, averages 190 votes per pick — about
 * twenty-four times less famous — and 90% of those picks still have a YouTube
 * video, so almost nothing churns. Lower was measured too and is worse than it
 * sounds: at floor 10 only 52% have a trailer, and at 0 only 4% do, because
 * the bottom of TMDB is DVD extras, architecture shorts and untitled
 * fragments rather than obscure films. 30 is the knee of that curve.
 */
export const CATALOG_VOTE_FLOOR = 30;

/**
 * One band per decade, from CATALOG_START_YEAR to now.
 *
 * Sampling a random year from EACH decade (rather than one year across a huge
 * band) means a single batch spans every decade at once, with no two picks
 * clumped on the same year. The floor is uniform: an old film having fewer
 * ratings than a new one is not a reason to demand a bigger share of them,
 * and the graded floors were part of what made the feed famous-only.
 *
 * No maxPage any more. discoverRandomMix learns each year's real page count
 * and samples across all of it — that is the change that actually widened the
 * feed; everything else here is a supporting adjustment.
 */
export function eraStrata(currentYear = new Date().getFullYear()) {
  const bands = [];
  for (let lo = CATALOG_START_YEAR; lo <= currentYear; lo += 10) {
    bands.push({ lo, hi: Math.min(lo + 9, currentYear), voteFloor: CATALOG_VOTE_FLOOR });
  }
  return bands;
}

/**
 * How many discover pages a given year actually has at a given floor.
 *
 * Cached for the session: it is the price of sampling deep, and a year's page
 * count does not meaningfully move inside half an hour. Capped at TMDB's own
 * 500-page ceiling, beyond which it refuses to paginate.
 */
async function discoverPageCount(year, voteFloor) {
  return cached(`pages:${year}:${voteFloor}`, async () => {
    const d = await call('/discover/movie', {
      sort_by: 'popularity.desc',
      page: 1,
      include_adult: false,
      'vote_count.gte': voteFloor,
      primary_release_year: year,
    });
    return {
      total: Math.min(Math.max(1, d.total_pages || 1), TMDB_MAX_DISCOVER_PAGE),
      firstPage: d.results || [],
    };
  });
}

/**
 * The decade chips offered in the filter sheet: every decade from the
 * catalog's start year through the current one, in steps of ten
 * (1970s, 1980s, …). Matches the coverage of eraStrata(), so a filter can
 * never ask for a decade the unfiltered feed would not draw from anyway.
 */
export function catalogDecades(nowYear = new Date().getFullYear()) {
  const out = [];
  for (let y = CATALOG_START_YEAR; y <= nowYear; y += 10) out.push(y);
  return out;
}

/**
 * Build a genuinely era-diverse batch of candidate movies. Pulls one random
 * year from each era band (in parallel), merges, and de-dupes. A single failed
 * band degrades gracefully — the others still fill the batch. If everything
 * comes back thin, the caller can fall back to plain discoverMovies.
 */
export async function discoverRandomMix({ strata } = {}) {
  const bands = strata || eraStrata();
  const groups = await Promise.all(
    bands.map(async (s) => {
      try {
        const year = randInt(s.lo, s.hi);
        const floor = s.voteFloor ?? CATALOG_VOTE_FLOOR;
        // Learn the year's real depth, then sample anywhere in it. A band with
        // a maxPage of 5 could only ever return that year's 100 best-known
        // films; 1994 alone has 46 pages at this floor, and the interesting
        // half of the catalog starts somewhere around page 10.
        const { total, firstPage } = await discoverPageCount(year, floor);
        const page = randInt(1, total);
        if (page === 1) return firstPage;   // already paid for
        const d = await call('/discover/movie', {
          sort_by: 'popularity.desc',
          page,
          include_adult: false,
          'vote_count.gte': floor,
          primary_release_year: year,
        });
        return d.results || [];
      } catch {
        return [];   // one band failing must not empty the batch
      }
    })
  );
  const seen = new Set();
  return [].concat(...groups).filter((m) => m && !seen.has(m.id) && seen.add(m.id));
}

/**
 * Discover popular movies released in a specific year (used by Time Machine and
 * other year-based fun modes). Returns the raw TMDB discover payload.
 */
export async function discoverByYear(year, { page = 1, voteFloor = 50 } = {}) {
  return call('/discover/movie', {
    sort_by: 'popularity.desc',
    page,
    include_adult: false,
    'vote_count.gte': voteFloor,
    primary_release_year: year,
  });
}

/**
 * Title search (used by Theater Mode to match a theater's programme titles to
 * TMDB movies). Optional year pins remakes ("Moana (2026)" vs 2016). Cached.
 */
export async function searchMovie(query, { year, page = 1 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  return cached(`search:${q.toLowerCase()}:${year || ''}:${page}`, async () => {
    const params = { query: q, page, include_adult: false };
    if (year) params.primary_release_year = year;
    const data = await call('/search/movie', params);
    return data.results || [];
  });
}

export async function getTrailer(movieId) {
  return cached(`trailer:${movieId}`, async () => {
    const data = await call(`/movie/${movieId}/videos`);
    const youtubeVideos = (data.results || []).filter((v) => v.site === 'YouTube');
    // Prefer official Trailer → Teaser → Clip → anything YouTube
    const order = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Behind the Scenes'];
    for (const t of order) {
      const found = youtubeVideos.find((v) => v.type === t);
      if (found) return found;
    }
    return youtubeVideos[0] || null;
  });
}

/**
 * Everything the "About this movie" sheet needs, folded into one request.
 * TMDB's append_to_response returns the sub-resources inline, so opening the
 * sheet costs a single round trip on a phone connection instead of three.
 *
 * Shape note: the base movie fields are untouched — appended data arrives in
 * new sibling keys (details.credits, details.keywords), so callers that only
 * read the plain details fields keep working unchanged.
 */
const DETAILS_APPEND = 'credits,keywords';

export async function getMovieDetails(movieId) {
  return cached(`details:${movieId}`, async () => {
    return call(`/movie/${movieId}`, { append_to_response: DETAILS_APPEND });
  });
}

// Full TMDB movie-genre id → name map (used for genre tags on the card).
export const MOVIE_GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

export function genreNames(ids = []) {
  return (ids || []).map((id) => MOVIE_GENRES[id]).filter(Boolean);
}

/**
 * Normalize a raw TMDB movie object into the app's trailer-candidate shape.
 * Used by discover, search, recommendations, and person credits so the
 * queue is uniform regardless of which endpoint produced the movie.
 */
export function toTrailerCandidate(m) {
  return {
    id: m.id,
    title: m.title || m.name || '',
    overview: m.overview || '',
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    runtime: null,
    genre_ids: m.genre_ids || [],
    poster_path: m.poster_path || null,
    backdrop_path: m.backdrop_path || null,
    vote_average: typeof m.vote_average === 'number' ? m.vote_average : null,
    youtubeKey: null,
  };
}

/**
 * Streaming / rent / buy availability for a movie in a region (default US).
 * Data is sourced by TMDB from JustWatch (attribution required in-app).
 * Returns null when no providers are listed for the region.
 */
export async function getWatchProviders(movieId, region = 'US') {
  return cached(`providers:${movieId}:${region}`, async () => {
    const data = await call(`/movie/${movieId}/watch/providers`);
    const r = (data.results && data.results[region]) || null;
    if (!r) return null;
    const names = (list) => (list || []).map((p) => p.provider_name);
    return {
      link: r.link || null,
      flatrate: names(r.flatrate),
      rent: names(r.rent),
      buy: names(r.buy),
    };
  });
}

export function posterUrl(path, size = 'w500') {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export function backdropUrl(path, size = 'w1280') {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

/**
 * Trailer object shape used throughout the app:
 * {
 *   id: number              // TMDB movie id
 *   title: string
 *   overview: string
 *   year: number
 *   runtime: number | null  // populated lazily on demand
 *   genre_ids: number[]
 *   poster_path: string | null
 *   backdrop_path: string | null
 *   youtubeKey: string      // YouTube video id; built from getTrailer()
 * }
 */
