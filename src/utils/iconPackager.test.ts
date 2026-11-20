import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIcnsBuffer, buildIcoBuffer } from './iconPackager';
import {
  decodeRgbaPng,
  encodeIcoBmpDib,
  encodeRgbaPng,
  ensureDesktopIcons,
  resizeRgba,
} from '../../scripts/desktop-icons-lib.mjs';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('buildIcoBuffer encodes valid ICONDIR and offsets for multiple sizes', () => {
  const dummy16 = new Uint8Array([...PNG_SIG, 1, 2, 3]);
  const dummy256 = new Uint8Array([...PNG_SIG, 4, 5, 6, 7]);
  const ico = buildIcoBuffer([
    { size: 16, png: dummy16 },
    { size: 256, png: dummy256 },
  ]);

  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  assert.equal(view.getUint16(0, true), 0);
  assert.equal(view.getUint16(2, true), 1);
  assert.equal(view.getUint16(4, true), 2);
  assert.equal(ico[6], 16);
  assert.equal(ico[6 + 16], 0); // 256 stored as 0
  assert.equal(view.getUint32(6 + 8, true), dummy16.byteLength);
  assert.equal(view.getUint32(6 + 12, true), 6 + 32);
  assert.equal(view.getUint32(6 + 16 + 12, true), 6 + 32 + dummy16.byteLength);
});

test('buildIcnsBuffer writes valid Apple icns header and OSType chunks', () => {
  const dummy128 = new Uint8Array([...PNG_SIG, 9, 8]);
  const dummy1024 = new Uint8Array([...PNG_SIG, 7, 6, 5]);
  const icns = buildIcnsBuffer([
    { osType: 'ic07', png: dummy128 },
    { osType: 'ic10', png: dummy1024 },
  ]);

  assert.equal(Buffer.from(icns.subarray(0, 4)).toString('ascii'), 'icns');
  const view = new DataView(icns.buffer, icns.byteOffset, icns.byteLength);
  assert.equal(view.getUint32(4, false), icns.byteLength);
  assert.equal(Buffer.from(icns.subarray(8, 12)).toString('ascii'), 'ic07');
  assert.equal(view.getUint32(12, false), 8 + dummy128.byteLength);
});

test('PNG codec round-trips and resizes RGBA pixels with intact alpha', () => {
  const src = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) {
    src[i * 4 + 0] = 96;
    src[i * 4 + 1] = 165;
    src[i * 4 + 2] = 250;
    src[i * 4 + 3] = 255;
  }
  const png = encodeRgbaPng(src, 4, 4);
  const decoded = decodeRgbaPng(png);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 4);
  assert.deepEqual(Buffer.from(decoded.rgba), Buffer.from(src));

  const scaledUp = resizeRgba(decoded.rgba, 4, 4, 8);
  assert.equal(scaledUp.length, 8 * 8 * 4);
  assert.equal(scaledUp[0], 96);
  assert.equal(scaledUp[3], 255);

  const dib = encodeIcoBmpDib(scaledUp, 8);
  assert.equal(dib.readUInt32LE(0), 40);
  assert.equal(dib.readInt32LE(4), 8);
  assert.equal(dib.readInt32LE(8), 16);
  assert.equal(dib.readUInt16LE(14), 32);
});

test('ensureDesktopIcons materializes multi-platform packaging icons with valid ICO, ICNS, and PNG entries', () => {
  const manifest = ensureDesktopIcons(process.cwd(), 'packaging');
  assert.ok(fs.existsSync(manifest.pngPath), 'packaging/icon.png must exist');
  assert.ok(fs.existsSync(manifest.icoPath), 'packaging/icon.ico must exist');
  assert.ok(fs.existsSync(manifest.icnsPath), 'packaging/icon.icns must exist');

  const mainPng = fs.readFileSync(manifest.pngPath);
  assert.deepEqual(mainPng.subarray(0, 8), PNG_SIG);
  const mainDecoded = decodeRgbaPng(mainPng);
  assert.equal(mainDecoded.width, 512);
  assert.equal(mainDecoded.height, 512);

  // Verify center pixel is opaque (not blank/empty icon)
  const centerIdx = (256 * 512 + 256) * 4;
  assert.ok(mainDecoded.rgba[centerIdx + 3] > 200, 'center pixel should be opaque');

  // Verify Windows ICO has 7 entries: 16..128 DIB + 256 PNG
  const ico = fs.readFileSync(manifest.icoPath);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);

  for (let i = 0; i < 7; i++) {
    const dirPos = 6 + i * 16;
    const size = ico[dirPos] === 0 ? 256 : ico[dirPos];
    const payloadSize = ico.readUInt32LE(dirPos + 8);
    const payloadOffset = ico.readUInt32LE(dirPos + 12);
    const payload = ico.subarray(payloadOffset, payloadOffset + payloadSize);

    if (size === 256) {
      assert.deepEqual(payload.subarray(0, 8), PNG_SIG, '256px ICO entry must be PNG');
    } else {
      assert.equal(payload.readUInt32LE(0), 40, `${size}px ICO entry must have BITMAPINFOHEADER`);
      assert.equal(payload.readInt32LE(4), size);
      assert.equal(payload.readInt32LE(8), size * 2);
      assert.equal(payload.readUInt16LE(14), 32);
    }
  }

  // Verify Apple ICNS container
  const icns = fs.readFileSync(manifest.icnsPath);
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);

  // Verify Linux icon directory has 16..1024 PNGs
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    const p = path.join(manifest.outDir, 'icons', `${size}x${size}.png`);
    assert.ok(fs.existsSync(p), `Missing Linux icon ${size}x${size}.png`);
    const decoded = decodeRgbaPng(fs.readFileSync(p));
    assert.equal(decoded.width, size);
    assert.equal(decoded.height, size);
  }
});
