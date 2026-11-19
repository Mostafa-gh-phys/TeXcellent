/**
 * Pure binary container packers for multi-resolution Windows (.ico) and macOS (.icns) icons
 * wrapping lossless PNG payloads (supported by Windows Vista+ and macOS 10.7+).
 */

export interface PngIconEntry {
  size: number;
  png: Uint8Array;
}

export interface IcnsChunkEntry {
  osType: 'ic07' | 'ic08' | 'ic09' | 'ic10'; // 128, 256, 512, 1024
  png: Uint8Array;
}

export function buildIcoBuffer(entries: PngIconEntry[]): Uint8Array {
  if (entries.length === 0) {
    throw new Error('At least one PNG entry is required to build .ico');
  }
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataStartOffset = headerSize + dirEntrySize * entries.length;
  const totalPngBytes = entries.reduce((sum, e) => sum + e.png.byteLength, 0);
  const out = new Uint8Array(dataStartOffset + totalPngBytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  // ICONDIR header: reserved=0 (u16), type=1 (u16), count (u16)
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  let dataCursor = dataStartOffset;
  entries.forEach((entry, idx) => {
    const dirPos = headerSize + idx * dirEntrySize;
    const dim = entry.size >= 256 ? 0 : entry.size; // 0 encodes 256 in ICO spec
    out[dirPos + 0] = dim;
    out[dirPos + 1] = dim;
    out[dirPos + 2] = 0; // palette count
    out[dirPos + 3] = 0; // reserved
    view.setUint16(dirPos + 4, 1, true); // color planes
    view.setUint16(dirPos + 6, 32, true); // bits per pixel
    view.setUint32(dirPos + 8, entry.png.byteLength, true);
    view.setUint32(dirPos + 12, dataCursor, true);

    out.set(entry.png, dataCursor);
    dataCursor += entry.png.byteLength;
  });

  return out;
}

export function buildIcnsBuffer(chunks: IcnsChunkEntry[]): Uint8Array {
  if (chunks.length === 0) {
    throw new Error('At least one PNG chunk is required to build .icns');
  }
  const totalLength = 8 + chunks.reduce((sum, c) => sum + 8 + c.png.byteLength, 0);
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  // 'icns' magic + total big-endian size
  out[0] = 0x69;
  out[1] = 0x63;
  out[2] = 0x6e;
  out[3] = 0x73;
  view.setUint32(4, totalLength, false);

  let cursor = 8;
  for (const chunk of chunks) {
    for (let i = 0; i < 4; i++) {
      out[cursor + i] = chunk.osType.charCodeAt(i);
    }
    const chunkLen = 8 + chunk.png.byteLength;
    view.setUint32(cursor + 4, chunkLen, false);
    out.set(chunk.png, cursor + 8);
    cursor += chunkLen;
  }

  return out;
}
