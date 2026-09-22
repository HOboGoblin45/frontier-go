/**
 * Just enough ZIP to read NOAA's dive archives over HTTP range requests.
 *
 * A dive's video zip is 3-23 GB. Its table of contents (the central
 * directory) sits at the end and is a few tens of kilobytes, so the whole
 * segment list of a dive costs two small range requests. Small members (the
 * 1 Hz track, the dive summary) are then fetched and inflated individually.
 *
 * Handles ZIP64, which every archive over 4 GB uses.
 */

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  size: number;
  /** Offset of the member's local header. */
  offset: number;
}

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;

function lastIndexOfSignature(buf: Uint8Array, sig: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = buf.length - 4; i >= 0; i -= 1) if (view.getUint32(i, true) === sig) return i;
  return -1;
}

export interface CentralDirectoryLocation {
  offset: number;
  size: number;
  entries: number;
  /** When set, the ZIP64 end record must be read at this offset to get the real values. */
  zip64RecordOffset?: number;
}

/** Find the central directory from the archive's last bytes. */
export function locateCentralDirectory(tail: Uint8Array): CentralDirectoryLocation {
  const e = lastIndexOfSignature(tail, EOCD);
  if (e < 0) throw new Error('zip: end of central directory not found');
  const v = new DataView(tail.buffer, tail.byteOffset + e, 22);
  const loc: CentralDirectoryLocation = {
    entries: v.getUint16(10, true),
    size: v.getUint32(12, true),
    offset: v.getUint32(16, true),
  };
  const l = lastIndexOfSignature(tail.subarray(0, e), ZIP64_LOCATOR);
  if (l >= 0) {
    const lv = new DataView(tail.buffer, tail.byteOffset + l, 20);
    loc.zip64RecordOffset = Number(lv.getBigUint64(8, true));
  }
  return loc;
}

/** Real values from a ZIP64 end-of-central-directory record (56 bytes). */
export function readZip64Record(record: Uint8Array): { entries: number; size: number; offset: number } {
  const v = new DataView(record.buffer, record.byteOffset, record.byteLength);
  if (v.getUint32(0, true) !== 0x06064b50) throw new Error('zip: bad ZIP64 end record');
  return {
    entries: Number(v.getBigUint64(32, true)),
    size: Number(v.getBigUint64(40, true)),
    offset: Number(v.getBigUint64(48, true)),
  };
}

const decoder = new TextDecoder('utf-8');

/** Parse every central directory record. */
export function parseCentralDirectory(cd: Uint8Array): ZipEntry[] {
  const v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const out: ZipEntry[] = [];
  let i = 0;
  while (i + 46 <= cd.length && v.getUint32(i, true) === CENTRAL) {
    const method = v.getUint16(i + 10, true);
    let compressedSize = v.getUint32(i + 20, true);
    let size = v.getUint32(i + 24, true);
    const nameLen = v.getUint16(i + 28, true);
    const extraLen = v.getUint16(i + 30, true);
    const commentLen = v.getUint16(i + 32, true);
    let offset = v.getUint32(i + 42, true);
    const name = decoder.decode(cd.subarray(i + 46, i + 46 + nameLen));
    let j = i + 46 + nameLen;
    const extraEnd = j + extraLen;
    while (j + 4 <= extraEnd) {
      const id = v.getUint16(j, true);
      const len = v.getUint16(j + 2, true);
      if (id === 0x0001) {
        let k = j + 4;
        if (size === 0xffffffff) { size = Number(v.getBigUint64(k, true)); k += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = Number(v.getBigUint64(k, true)); k += 8; }
        if (offset === 0xffffffff) { offset = Number(v.getBigUint64(k, true)); k += 8; }
      }
      j += 4 + len;
    }
    out.push({ name, method, compressedSize, size, offset });
    i = extraEnd + commentLen;
  }
  return out;
}

/** Where a member's data starts, from its 30-byte local header (plus name and extra). */
export function dataOffset(entry: ZipEntry, localHeader: Uint8Array): number {
  const v = new DataView(localHeader.buffer, localHeader.byteOffset, localHeader.byteLength);
  if (v.getUint32(0, true) !== 0x04034b50) throw new Error(`zip: bad local header for ${entry.name}`);
  return entry.offset + 30 + v.getUint16(26, true) + v.getUint16(28, true);
}
