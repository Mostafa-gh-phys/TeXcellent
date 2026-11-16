import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findMissingBindingPackages,
  formatNpmSpecs,
  getPlatformBindingTargets,
} from '../../scripts/native-bindings-lib.mjs';

test('getPlatformBindingTargets resolves Windows x64 MSVC pre-built and WASI fallback packages', () => {
  const specs = getPlatformBindingTargets({
    platform: 'win32',
    arch: 'x64',
    versions: { rolldown: '1.2.19', oxide: '4.3.5', esbuild: '0.25.12' },
  });

  assert.deepEqual(
    specs.map((s) => `${s.name}@${s.version}`),
    [
      '@rolldown/binding-win32-x64-msvc@1.2.19',
      '@rolldown/binding-wasm32-wasi@1.2.19',
      '@tailwindcss/oxide-win32-x64-msvc@4.3.5',
      '@tailwindcss/oxide-wasm32-wasi@4.3.5',
      '@esbuild/win32-x64@0.25.12',
    ]
  );
});

test('getPlatformBindingTargets resolves macOS arm64 and x64 packages', () => {
  const armSpecs = getPlatformBindingTargets({
    platform: 'darwin',
    arch: 'arm64',
    versions: { rolldown: '1.2.19', oxide: '4.3.5', esbuild: '0.25.12' },
  });
  assert.ok(armSpecs.some((s) => s.name === '@rolldown/binding-darwin-arm64' && s.kind === 'native'));
  assert.ok(armSpecs.some((s) => s.name === '@tailwindcss/oxide-darwin-arm64' && s.kind === 'native'));
  assert.ok(armSpecs.some((s) => s.name === '@esbuild/darwin-arm64'));

  const x64Specs = getPlatformBindingTargets({
    platform: 'darwin',
    arch: 'x64',
    versions: { rolldown: '1.2.19', oxide: '4.3.5', esbuild: '0.25.12' },
  });
  assert.ok(x64Specs.some((s) => s.name === '@rolldown/binding-darwin-x64'));
  assert.ok(x64Specs.some((s) => s.name === '@tailwindcss/oxide-darwin-x64'));
  assert.ok(x64Specs.some((s) => s.name === '@esbuild/darwin-x64'));
});

test('getPlatformBindingTargets differentiates Linux glibc and musl', () => {
  const gnuSpecs = getPlatformBindingTargets({
    platform: 'linux',
    arch: 'x64',
    isMusl: false,
    versions: { rolldown: '1.2.19' },
  });
  assert.equal(gnuSpecs[0]?.name, '@rolldown/binding-linux-x64-gnu');

  const muslSpecs = getPlatformBindingTargets({
    platform: 'linux',
    arch: 'x64',
    isMusl: true,
    versions: { rolldown: '1.2.19' },
  });
  assert.equal(muslSpecs[0]?.name, '@rolldown/binding-linux-x64-musl');
});

test('findMissingBindingPackages detects absent or mismatched versions', () => {
  const specs = getPlatformBindingTargets({
    platform: 'win32',
    arch: 'x64',
    versions: { rolldown: '1.2.19', oxide: '4.3.5', esbuild: '0.25.12' },
  });

  const missing = findMissingBindingPackages(specs, {
    '@rolldown/binding-win32-x64-msvc': null,
    '@rolldown/binding-wasm32-wasi': '1.2.18',
    '@tailwindcss/oxide-win32-x64-msvc': '4.3.5',
    '@tailwindcss/oxide-wasm32-wasi': '4.3.5',
    '@esbuild/win32-x64': '0.25.12',
  });

  assert.deepEqual(formatNpmSpecs(missing), [
    '@rolldown/binding-win32-x64-msvc@1.2.19',
    '@rolldown/binding-wasm32-wasi@1.2.19',
  ]);
});
