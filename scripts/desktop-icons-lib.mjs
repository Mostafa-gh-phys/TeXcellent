import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode an 8-bit non-interlaced RGB or RGBA PNG into raw RGBA pixels.
 * @param {Buffer | Uint8Array} input
 * @returns {{ width: number; height: number; rgba: Uint8Array }}
 */
export function decodeRgbaPng(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) {
      throw new Error(`Truncated PNG chunk: ${type}`);
    }
    const chunkData = buf.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlace = chunkData[12];
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height) {
    throw new Error('PNG missing valid IHDR dimensions');
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(
      `Unsupported PNG format (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`
    );
  }

  const bpp = colorType === 6 ? 4 : 3;
  const rowBytes = width * bpp;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const expectedMin = (rowBytes + 1) * height;
  if (inflated.length < expectedMin) {
    throw new Error('PNG IDAT stream shorter than expected scanline data');
  }

  const rgba = new Uint8Array(width * height * 4);
  let prevRow = new Uint8Array(rowBytes);
  let currRow = new Uint8Array(rowBytes);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    const filter = inflated[rowStart];

    for (let x = 0; x < rowBytes; x++) {
      const raw = inflated[rowStart + 1 + x];
      const a = x >= bpp ? currRow[x - bpp] : 0;
      const b = y > 0 ? prevRow[x] : 0;
      const c = x >= bpp && y > 0 ? prevRow[x - bpp] : 0;

      let val = raw;
      if (filter === 1) val = (raw + a) & 0xff;
      else if (filter === 2) val = (raw + b) & 0xff;
      else if (filter === 3) val = (raw + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (raw + paethPredictor(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG scanline filter: ${filter}`);

      currRow[x] = val;
    }

    const dstRowOffset = y * width * 4;
    if (bpp === 4) {
      rgba.set(currRow, dstRowOffset);
    } else {
      for (let px = 0; px < width; px++) {
        rgba[dstRowOffset + px * 4 + 0] = currRow[px * 3 + 0];
        rgba[dstRowOffset + px * 4 + 1] = currRow[px * 3 + 1];
        rgba[dstRowOffset + px * 4 + 2] = currRow[px * 3 + 2];
        rgba[dstRowOffset + px * 4 + 3] = 255;
      }
    }

    const tmp = prevRow;
    prevRow = currRow;
    currRow = tmp;
  }

  return { width, height, rgba };
}

/**
 * Resize RGBA buffer to square dstSize x dstSize using premultiplied-alpha
 * box averaging (downscale) or bilinear interpolation (upscale).
 * @param {Uint8Array} srcRgba
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {number} dstSize
 * @returns {Uint8Array}
 */
export function resizeRgba(srcRgba, srcWidth, srcHeight, dstSize) {
  if (srcWidth === dstSize && srcHeight === dstSize) {
    return new Uint8Array(srcRgba);
  }
  const dst = new Uint8Array(dstSize * dstSize * 4);

  if (dstSize < srcWidth || dstSize < srcHeight) {
    const scaleX = srcWidth / dstSize;
    const scaleY = srcHeight / dstSize;
    for (let dy = 0; dy < dstSize; dy++) {
      const sy0 = dy * scaleY;
      const sy1 = (dy + 1) * scaleY;
      const iy0 = Math.floor(sy0);
      const iy1 = Math.min(srcHeight - 1, Math.floor(sy1 - 1e-6));

      for (let dx = 0; dx < dstSize; dx++) {
        const sx0 = dx * scaleX;
        const sx1 = (dx + 1) * scaleX;
        const ix0 = Math.floor(sx0);
        const ix1 = Math.min(srcWidth - 1, Math.floor(sx1 - 1e-6));

        let pr = 0;
        let pg = 0;
        let pb = 0;
        let pa = 0;
        let totalWeight = 0;

        for (let sy = iy0; sy <= iy1; sy++) {
          const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
          if (wy <= 0) continue;
          for (let sx = ix0; sx <= ix1; sx++) {
            const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
            if (wx <= 0) continue;
            const w = wx * wy;
            const idx = (sy * srcWidth + sx) * 4;
            const a = srcRgba[idx + 3] / 255;
            pr += srcRgba[idx + 0] * a * w;
            pg += srcRgba[idx + 1] * a * w;
            pb += srcRgba[idx + 2] * a * w;
            pa += a * w;
            totalWeight += w;
          }
        }

        const outIdx = (dy * dstSize + dx) * 4;
        if (totalWeight > 0 && pa > 1e-6) {
          const alphaNorm = pa / totalWeight;
          dst[outIdx + 0] = Math.min(255, Math.max(0, Math.round(pr / pa)));
          dst[outIdx + 1] = Math.min(255, Math.max(0, Math.round(pg / pa)));
          dst[outIdx + 2] = Math.min(255, Math.max(0, Math.round(pb / pa)));
          dst[outIdx + 3] = Math.min(255, Math.max(0, Math.round(alphaNorm * 255)));
        }
      }
    }
    return dst;
  }

  // Bilinear upscale with premultiplied alpha
  for (let dy = 0; dy < dstSize; dy++) {
    const fy = ((dy + 0.5) * srcHeight) / dstSize - 0.5;
    const y0 = Math.max(0, Math.min(srcHeight - 1, Math.floor(fy)));
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));

    for (let dx = 0; dx < dstSize; dx++) {
      const fx = ((dx + 0.5) * srcWidth) / dstSize - 0.5;
      const x0 = Math.max(0, Math.min(srcWidth - 1, Math.floor(fx)));
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));

      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;

      const i00 = (y0 * srcWidth + x0) * 4;
      const i10 = (y0 * srcWidth + x1) * 4;
      const i01 = (y1 * srcWidth + x0) * 4;
      const i11 = (y1 * srcWidth + x1) * 4;

      const a00 = srcRgba[i00 + 3] / 255;
      const a10 = srcRgba[i10 + 3] / 255;
      const a01 = srcRgba[i01 + 3] / 255;
      const a11 = srcRgba[i11 + 3] / 255;

      const pa = a00 * w00 + a10 * w10 + a01 * w01 + a11 * w11;
      const outIdx = (dy * dstSize + dx) * 4;

      if (pa > 1e-6) {
        const pr =
          srcRgba[i00 + 0] * a00 * w00 +
          srcRgba[i10 + 0] * a10 * w10 +
          srcRgba[i01 + 0] * a01 * w01 +
          srcRgba[i11 + 0] * a11 * w11;
        const pg =
          srcRgba[i00 + 1] * a00 * w00 +
          srcRgba[i10 + 1] * a10 * w10 +
          srcRgba[i01 + 1] * a01 * w01 +
          srcRgba[i11 + 1] * a11 * w11;
        const pb =
          srcRgba[i00 + 2] * a00 * w00 +
          srcRgba[i10 + 2] * a10 * w10 +
          srcRgba[i01 + 2] * a01 * w01 +
          srcRgba[i11 + 2] * a11 * w11;

        dst[outIdx + 0] = Math.min(255, Math.max(0, Math.round(pr / pa)));
        dst[outIdx + 1] = Math.min(255, Math.max(0, Math.round(pg / pa)));
        dst[outIdx + 2] = Math.min(255, Math.max(0, Math.round(pb / pa)));
        dst[outIdx + 3] = Math.min(255, Math.max(0, Math.round(pa * 255)));
      }
    }
  }
  return dst;
}

/**
 * Encode RGBA pixels into an 8-bit PNG Buffer.
 * @param {Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @returns {Buffer}
 */
export function encodeRgbaPng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowStride = width * 4;
  const raw = Buffer.alloc((rowStride + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcOffset = y * rowStride;
    const dstOffset = y * (rowStride + 1);
    raw[dstOffset] = 0; // filter None
    Buffer.from(rgba.buffer, rgba.byteOffset + srcOffset, rowStride).copy(raw, dstOffset + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    PNG_SIGNATURE,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Encode RGBA image as a 32-bit BGRA BITMAPINFOHEADER DIB + 1-bpp AND mask
 * for maximum compatibility with Windows NSIS (makensis), rcedit, and Explorer.
 * @param {Uint8Array} rgba
 * @param {number} size
 * @returns {Buffer}
 */
export function encodeIcoBmpDib(rgba, size) {
  const headerSize = 40;
  const xorBytes = size * size * 4;
  const andRowStride = Math.ceil(size / 32) * 4;
  const andBytes = andRowStride * size;
  const out = Buffer.alloc(headerSize + xorBytes + andBytes);

  // BITMAPINFOHEADER
  out.writeUInt32LE(headerSize, 0);
  out.writeInt32LE(size, 4);
  out.writeInt32LE(size * 2, 8); // XOR + AND combined height per ICO spec
  out.writeUInt16LE(1, 12); // planes
  out.writeUInt16LE(32, 14); // bitCount
  out.writeUInt32LE(0, 16); // BI_RGB
  out.writeUInt32LE(xorBytes + andBytes, 20);

  // Bottom-up BGRA XOR bitmap
  let xorCursor = headerSize;
  const andStart = headerSize + xorBytes;
  for (let y = size - 1; y >= 0; y--) {
    const andRowOffset = andStart + (size - 1 - y) * andRowStride;
    for (let x = 0; x < size; x++) {
      const srcIdx = (y * size + x) * 4;
      const r = rgba[srcIdx + 0];
      const g = rgba[srcIdx + 1];
      const b = rgba[srcIdx + 2];
      const a = rgba[srcIdx + 3];
      out[xorCursor++] = b;
      out[xorCursor++] = g;
      out[xorCursor++] = r;
      out[xorCursor++] = a;

      if (a < 128) {
        out[andRowOffset + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return out;
}

/**
 * Build a multi-resolution Windows .ico buffer:
 * - BMP/DIB frames for 16..128 (required by NSIS/classic resource parsers)
 * - PNG frame for 256 (Windows Vista+ HiDPI support)
 * @param {Array<{ size: number; payload: Uint8Array }>} entries
 * @returns {Buffer}
 */
export function buildHybridIcoBuffer(entries) {
  if (entries.length === 0) {
    throw new Error('At least one icon entry is required to build .ico');
  }
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataStartOffset = headerSize + dirEntrySize * entries.length;
  const totalBytes = dataStartOffset + entries.reduce((sum, e) => sum + e.payload.byteLength, 0);
  const out = Buffer.alloc(totalBytes);

  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // type: ICON
  out.writeUInt16LE(entries.length, 4);

  let dataCursor = dataStartOffset;
  entries.forEach((entry, idx) => {
    const dirPos = headerSize + idx * dirEntrySize;
    const dim = entry.size >= 256 ? 0 : entry.size;
    out[dirPos + 0] = dim;
    out[dirPos + 1] = dim;
    out[dirPos + 2] = 0;
    out[dirPos + 3] = 0;
    out.writeUInt16LE(1, dirPos + 4);
    out.writeUInt16LE(32, dirPos + 6);
    out.writeUInt32LE(entry.payload.byteLength, dirPos + 8);
    out.writeUInt32LE(dataCursor, dirPos + 12);

    Buffer.from(entry.payload.buffer, entry.payload.byteOffset, entry.payload.byteLength).copy(
      out,
      dataCursor
    );
    dataCursor += entry.payload.byteLength;
  });

  return out;
}

/**
 * Build an Apple .icns container with ic07 (128), ic08 (256), ic09 (512), ic10 (1024).
 * @param {Array<{ osType: 'ic07' | 'ic08' | 'ic09' | 'ic10'; png: Uint8Array }>} chunks
 * @returns {Buffer}
 */
export function buildIcnsContainer(chunks) {
  if (chunks.length === 0) {
    throw new Error('At least one PNG chunk is required to build .icns');
  }
  const totalLength = 8 + chunks.reduce((sum, c) => sum + 8 + c.png.byteLength, 0);
  const out = Buffer.alloc(totalLength);
  out.write('icns', 0, 'ascii');
  out.writeUInt32BE(totalLength, 4);

  let cursor = 8;
  for (const chunk of chunks) {
    out.write(chunk.osType, cursor, 'ascii');
    const chunkLen = 8 + chunk.png.byteLength;
    out.writeUInt32BE(chunkLen, cursor + 4);
    Buffer.from(chunk.png.buffer, chunk.png.byteOffset, chunk.png.byteLength).copy(out, cursor + 8);
    cursor += chunkLen;
  }

  return out;
}

/**
 * Ensure all Electron & installer icon assets exist in `outputDir` (default: `packaging/`),
 * derived deterministically from `public/icon-512.png` (or `electron/icon.png` fallback).
 * @param {string} rootDir
 * @param {string} [outputFolderName]
 */
export function ensureDesktopIcons(rootDir, outputFolderName = 'packaging') {
  const candidates = [
    path.join(rootDir, 'public', 'icon-512.png'),
    path.join(rootDir, 'electron', 'icon.png'),
  ];
  const sourcePath = candidates.find((p) => fs.existsSync(p));
  if (!sourcePath) {
    throw new Error('Master icon source not found (expected public/icon-512.png or electron/icon.png).');
  }

  const decoded = decodeRgbaPng(fs.readFileSync(sourcePath));
  const outDir = path.join(rootDir, outputFolderName);
  const iconsDir = path.join(outDir, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  /** @type {Record<number, { rgba: Uint8Array; png: Buffer }>} */
  const rendered = {};

  for (const size of sizes) {
    const rgba = resizeRgba(decoded.rgba, decoded.width, decoded.height, size);
    const png = encodeRgbaPng(rgba, size, size);
    rendered[size] = { rgba, png };
    fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), png);
  }

  fs.writeFileSync(path.join(outDir, 'icon.png'), rendered[512].png);

  const icoBuffer = buildHybridIcoBuffer([
    { size: 16, payload: encodeIcoBmpDib(rendered[16].rgba, 16) },
    { size: 24, payload: encodeIcoBmpDib(rendered[24].rgba, 24) },
    { size: 32, payload: encodeIcoBmpDib(rendered[32].rgba, 32) },
    { size: 48, payload: encodeIcoBmpDib(rendered[48].rgba, 48) },
    { size: 64, payload: encodeIcoBmpDib(rendered[64].rgba, 64) },
    { size: 128, payload: encodeIcoBmpDib(rendered[128].rgba, 128) },
    { size: 256, payload: rendered[256].png },
  ]);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);

  const icnsBuffer = buildIcnsContainer([
    { osType: 'ic07', png: rendered[128].png },
    { osType: 'ic08', png: rendered[256].png },
    { osType: 'ic09', png: rendered[512].png },
    { osType: 'ic10', png: rendered[1024].png },
  ]);
  fs.writeFileSync(path.join(outDir, 'icon.icns'), icnsBuffer);

  const electronIconPath = path.join(rootDir, 'electron', 'icon.png');
  if (!fs.existsSync(electronIconPath)) {
    fs.mkdirSync(path.dirname(electronIconPath), { recursive: true });
    fs.writeFileSync(electronIconPath, rendered[256].png);
  }

  return {
    sourcePath,
    outDir,
    icoPath: path.join(outDir, 'icon.ico'),
    icnsPath: path.join(outDir, 'icon.icns'),
    pngPath: path.join(outDir, 'icon.png'),
    sizes,
  };
}
