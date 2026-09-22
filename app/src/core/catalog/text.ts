/**
 * Text hygiene for provider metadata.
 *
 * Agencies write titles for their own filing systems, not for a television.
 * Measured against the shipped catalog on 2026-09-22, before this existed:
 *
 *   241 NOAA descriptions ended in a literal `&#8230;` (WordPress's ellipsis),
 *       rendered on screen as those seven characters
 *    68 titles were file names: `Apollo_11_Intro_720p`,
 *       `iss060m262481254_Hurricane_Dorian_Live_Views_Sept_5_2019_0905`,
 *       `35sec Green Run Clip 03182021 - with Test Conductor Audio`
 *    19 titles were entirely upper case
 *     7 titles were wrapped whole in quotation marks
 *     1 description carried an emoji, which this product never shows
 *
 * Every rule below exists because one of those was on a screen. Each rule is
 * conservative: a title that does not look like a file name is left alone.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', times: '×', eacute: 'é', ntilde: 'ñ',
};

/** Decode HTML character references. Unknown named entities are left as they are. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/**
 * Remove emoji and pictographs. Typographic symbols (degree, arrows, the middle
 * dot, the ellipsis) are not emoji and survive.
 */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Acronyms that must stay upper case when a shouted title is re-cased. */
const KEEP_UPPER = new Set([
  'ISS', 'NASA', 'NOAA', 'ROV', 'ESA', 'JPL', 'SLS', 'EVA', 'HST', 'JWST', 'CME', 'US', 'U.S.',
  'UK', 'EU', 'ARES', 'GOES', 'VIIRS', 'MODIS', 'SDO', 'LRO', 'ICESAT', 'GPM', 'SWOT', 'PACE',
  'OSIRIS-REX', 'DART', 'RS-25', 'X-59', 'SOFIA', 'TESS', 'MAVEN', 'AI', 'TV', 'HD', 'UV', 'IR',
]);
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'vs']);

function recaseShouted(title: string): string {
  const words = title.toLowerCase().split(/(\s+)/);
  let index = 0;
  return words.map((w) => {
    if (/^\s+$/.test(w)) return w;
    const upper = w.toUpperCase();
    const first = index === 0;
    index += 1;
    if (KEEP_UPPER.has(upper) || KEEP_UPPER.has(upper.replace(/[.,:;!?]+$/, ''))) return upper;
    if (!first && SMALL_WORDS.has(w)) return w;
    return w.replace(/^(\p{L})/u, (c) => c.toUpperCase());
  }).join('');
}

/**
 * A title reads as a file name when it has underscores, or opens with an
 * agency asset code. Only those get the aggressive treatment.
 */
const ASSET_CODE = /^(?:iss\d{3}m\d{6,}|jsc\d{0,4}m\d{6,}|[A-Z]{2,6}-\d{8}|[A-Z]{2,6}-\d{4}-\d{3,}(?:-\d+)?)[\s_-]*/i;

function looksLikeFileName(title: string): boolean {
  return /_/.test(title)
    || ASSET_CODE.test(title)
    || /^\d+\s?sec\b/i.test(title)
    || /^NTV\b/.test(title)
    || /-(?:MP4|4kMP4|UHD|SOCIAL)$/i.test(title);
}

const ENCODE_SUFFIX = /(?:[-_\s]*(?:MP4|4kMP4|UHD|HD|Hi-?Res|SOCIAL|wMetadata|1080p|720p))+$/i;

function tidyFileName(title: string): string {
  let t = title
    // Agency asset codes at the start: iss060m262481254_, jsc2020m000166_,
    // AFRC-2026-14575-01_, JPL-20220811-
    .replace(ASSET_CODE, '')
    // JPL's second-level production code: "TECHf-0001-", "M2020f-0001-"
    .replace(/^[A-Za-z0-9]{2,8}f-\d{4}-/, '')
    // Encode and distribution suffixes: -MP4, -4kMP4, -UHD, _wMetadata, -SOCIAL
    .replace(ENCODE_SUFFIX, '')
    // File-system separators and extensions
    .replace(/_mp4$|\.mp4$|\.mov$/i, '')
    .replace(/_+/g, ' ')
    // NASA TV and Video File markers: "NTV", "NTV-", "VF", "VideoFile"
    .replace(/\b(?:NTV|VF)\b-?/g, ' ')
    // Durations, resolutions and encodes: "35sec", "720p", "4k", "HD"
    .replace(/\b\d+\s?sec\b/gi, ' ')
    .replace(/\b(2160|1080|720|540|480)p\b/gi, ' ')
    .replace(/\b[48]k\b/gi, ' ')
    .replace(/(\p{Ll})4k\b/gu, '$1')
    // Trailing or embedded date stamps: 03182021, 2019 0705, 0905, 1220153
    .replace(/\b(19|20)\d{2}\s\d{4}\b/g, ' ')
    .replace(/\b\d{6,8}\b/g, ' ')
    // A trailing MMDD stamp goes; a trailing year ("Images of 2020") stays.
    .replace(/\s(?!(?:19|20)\d{2}$)\d{4}$/, '')
    // "Video File" is NASA's name for a b-roll package, not part of the title
    .replace(/\bVideo\s?File\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // Once the date stamps are gone an encode suffix can be exposed again.
    .replace(ENCODE_SUFFIX, '')
    .replace(/^[-\u2013\u2014:,\s]+|[-\u2013\u2014:,\s]+$/g, '');

  // CamelCase joins inside a single word: "BeauBierhaus" -> "Beau Bierhaus".
  // Only lower-to-upper boundaries, so "OSIRIS-REx" and "RS-25" are untouched.
  t = t.split(' ').map((w) => (/^[A-Za-z]+$/.test(w) ? w.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2') : w)).join(' ');
  t = t.replace(/\b(Episode|Ep|Part)(\d)/g, '$1 $2').replace(/\s{2,}/g, ' ').trim();

  return t.replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
}

/** Strip quotation marks that wrap the whole title, and nothing else. */
function unwrapQuotes(title: string): string {
  const pairs: Array<[string, string]> = [['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’']];
  for (const [open, close] of pairs) {
    if (title.length > 2 && title.startsWith(open) && title.endsWith(close)) {
      const inner = title.slice(open.length, title.length - close.length);
      // '"Big Red" Jelly' stays: the quotes are a nickname, not a wrapper.
      if (!inner.includes(open) && !inner.includes(close)) return inner.trim();
    }
  }
  return title;
}

/** Longest title a screen should carry. */
export const MAX_TITLE = 110;

/**
 * Some NASA records have the description glued onto the title with no space:
 * "...Captures Ingenuity's Third FlightNASA's Ingenuity Mars Helicopter takes
 * off..." - 1,900 characters of title. Cut at the join, or failing that at a
 * word boundary.
 */
function capLength(title: string): string {
  if (title.length <= MAX_TITLE) return title;
  const glued = /(\p{Ll})(?=(?:NASA|NOAA|The |A |This |In |On )|\p{Lu}\p{Ll}{2,} )/u;
  const m = glued.exec(title.slice(20));
  if (m && m.index + 21 <= MAX_TITLE) return title.slice(0, 20 + m.index + 1).trim();
  const sentence = title.search(/[.!?]\s/);
  if (sentence > 20 && sentence < MAX_TITLE) return title.slice(0, sentence).trim();
  const cut = title.lastIndexOf(' ', MAX_TITLE - 1);
  return `${title.slice(0, cut > 40 ? cut : MAX_TITLE - 1).trim()}\u2026`;
}

export function cleanTitle(raw: string): string {
  let t = stripEmoji(decodeEntities(raw)).replace(/\s+/g, ' ').trim();
  if (!t) return raw.trim();
  t = capLength(t);
  if (looksLikeFileName(t)) t = tidyFileName(t) || t;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 8 && letters === letters.toUpperCase()) t = recaseShouted(t);
  t = unwrapQuotes(t);
  return t;
}

export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const t = stripEmoji(decodeEntities(raw))
    // WordPress excerpts end "... Learn more" or "[&hellip;]" once decoded.
    .replace(/\s*\[…\]\s*$/, '…')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return t || undefined;
}
