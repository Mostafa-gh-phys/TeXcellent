import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildPolyfilledWorkerSource, installMainThreadPdfPolyfills } from './pdfWorkerSetup';

test('buildPolyfilledWorkerSource installs toHex, fromHex, Promise.withResolvers, and URL.parse before importing worker', () => {
  const workerUrl = 'http://127.0.0.1:3000/assets/pdf.worker.min.mjs';
  const code = buildPolyfilledWorkerSource(workerUrl);

  const importIdx = code.indexOf('await import(');
  const toHexIdx = code.indexOf('Uint8Array.prototype');
  const fromHexIdx = code.indexOf('Uint8Array.fromHex');
  const resolversIdx = code.indexOf('Promise.withResolvers');
  const urlParseIdx = code.indexOf('URL.parse');

  assert.ok(toHexIdx !== -1 && toHexIdx < importIdx, 'toHex polyfill precedes import');
  assert.ok(fromHexIdx !== -1 && fromHexIdx < importIdx, 'fromHex polyfill precedes import');
  assert.ok(resolversIdx !== -1 && resolversIdx < importIdx, 'Promise.withResolvers polyfill precedes import');
  assert.ok(urlParseIdx !== -1 && urlParseIdx < importIdx, 'URL.parse polyfill precedes import');
  assert.ok(code.includes(JSON.stringify(workerUrl)), 'includes resolved worker URL');
});

test('polyfill script produces working toHex and fromHex implementations', () => {
  installMainThreadPdfPolyfills();
  const sample = new Uint8Array([0x00, 0x0f, 0xab, 0xff]) as Uint8Array & { toHex: () => string };
  assert.equal(sample.toHex(), '000fabff');

  // Also test the preamble snippet inside an isolated VM context without native toHex
  const rawCode = buildPolyfilledWorkerSource('http://localhost/w.mjs').replace(/await import\([\s\S]*\);?/, '');
  const sandbox: Record<string, unknown> = {
    Uint8Array: class extends Uint8Array {},
    Promise,
    URL,
    Object,
    SyntaxError,
    String,
    parseInt,
  };
  vm.runInNewContext(rawCode, sandbox);
  const VmU8 = sandbox.Uint8Array as typeof Uint8Array & { fromHex: (s: string) => Uint8Array };
  const arr = new VmU8([16, 255]) as Uint8Array & { toHex: () => string };
  assert.equal(arr.toHex(), '10ff');
  assert.deepEqual(Array.from(VmU8.fromHex('10ff')), [16, 255]);
});
