import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildIcnsBuffer, buildIcoBuffer } from './iconPackager';

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

test('generated project icon files exist with valid PNG, ICO, and ICNS signatures if already built', () => {
  const buildDir = path.resolve(process.cwd(), 'build');
  if (!fs.existsSync(buildDir)) return;

  const mainPng = fs.readFileSync(path.join(buildDir, 'icon.png'));
  assert.deepEqual(mainPng.subarray(0, 8), PNG_SIG);

  const ico = fs.readFileSync(path.join(buildDir, 'icon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 6, 'ICO should pack >= 6 sizes');

  const icns = fs.readFileSync(path.join(buildDir, 'icon.icns'));
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
});
