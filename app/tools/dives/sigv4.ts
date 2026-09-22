/**
 * AWS Signature Version 4, just enough to PUT and HEAD objects in any
 * S3-compatible store (Cloudflare R2, Backblaze B2, AWS S3). No SDK: the
 * mirror is the only thing that talks to storage, and a 60-line signer is
 * easier to audit than a dependency tree.
 */
import crypto from 'node:crypto';

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

const hmac = (key: crypto.BinaryLike, data: string) => crypto.createHmac('sha256', key).update(data).digest();
export const sha256Hex = (data: crypto.BinaryLike) => crypto.createHash('sha256').update(data).digest('hex');

/** RFC 3986 encoding as SigV4 wants it; `/` kept in paths. */
export function uriEncode(s: string, keepSlash: boolean): string {
  return [...Buffer.from(s, 'utf8')].map((b) => {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-._~]/.test(c) || (keepSlash && c === '/')) return c;
    return `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }).join('');
}

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * Headers for a signed request. `headers` must include `host`; the payload
 * hash is sent as x-amz-content-sha256 (use 'UNSIGNED-PAYLOAD' for streamed bodies).
 */
export function signRequest(opts: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  credentials: SigV4Credentials;
  now?: Date;
  /** S3 requires x-amz-content-sha256; the generic SigV4 test suite does not send it. */
  contentHashHeader?: boolean;
}): Record<string, string> {
  const { method, url, credentials: c } = opts;
  const date = amzDate(opts.now || new Date());
  const day = date.slice(0, 8);
  const headers: Record<string, string> = {};
  const extra: Record<string, string> = { 'x-amz-date': date };
  if (opts.contentHashHeader !== false) extra['x-amz-content-sha256'] = opts.payloadHash;
  for (const [k, v] of Object.entries({ ...opts.headers, ...extra })) {
    headers[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  }
  const names = Object.keys(headers).sort();
  const query = [...url.searchParams.entries()]
    .map(([k, v]) => [uriEncode(k, false), uriEncode(v, false)])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonical = [
    method,
    uriEncode(decodeURIComponent(url.pathname), true) || '/',
    query,
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    names.join(';'),
    opts.payloadHash,
  ].join('\n');
  const scope = `${day}/${c.region}/${c.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256Hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${c.secretAccessKey}`, day), c.region), c.service), 'aws4_request');
  const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}
