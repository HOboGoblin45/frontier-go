import { describe, expect, it } from 'vitest';
import { sha256Hex, signRequest, uriEncode } from './sigv4';

// AWS Signature Version 4 test suite, "get-vanilla" and "get-vanilla-query-order-key-case".
const credentials = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', region: 'us-east-1', service: 'service' };
const now = new Date(Date.UTC(2015, 7, 30, 12, 36, 0));

describe('SigV4', () => {
  it('matches the AWS test suite for a plain GET', () => {
    const h = signRequest({ method: 'GET', url: new URL('https://example.amazonaws.com/'), headers: { host: 'example.amazonaws.com' }, payloadHash: sha256Hex(''), credentials, now, contentHashHeader: false });
    expect(h.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
  });

  it('matches the AWS test suite with sorted query parameters', () => {
    const h = signRequest({ method: 'GET', url: new URL('https://example.amazonaws.com/?Param2=value2&Param1=value1'), headers: { host: 'example.amazonaws.com' }, payloadHash: sha256Hex(''), credentials, now, contentHashHeader: false });
    expect(h.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500');
  });

  it('encodes paths the S3 way', () => {
    expect(uriEncode('/dives/EX2104-DIVE05/a b+c.mp4', true)).toBe('/dives/EX2104-DIVE05/a%20b%2Bc.mp4');
  });
});
