import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  findMissingBindingPackages,
  formatNpmSpecs,
  getPlatformBindingTargets,
} from './native-bindings-lib.mjs';

const require = createRequire(import.meta.url);
const rootDir = process.cwd();

function readPkgVersion(pkgName) {
  try {
    const pkgPath = path.join(rootDir, 'node_modules', ...pkgName.split('/'), 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof raw.version === 'string' ? raw.version : null;
  } catch {
    return null;
  }
}

function detectLinuxMusl() {
  if (process.platform !== 'linux') return false;
  try {
    const report = process.report?.getReport?.();
    const header = typeof report === 'string' ? JSON.parse(report)?.header : report?.header;
    return !header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

async function verifyBindingsLoad() {
  const failures = [];

  try {
    await import('rolldown');
  } catch (err) {
    failures.push(`rolldown: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    require('@tailwindcss/oxide');
  } catch (err) {
    failures.push(`@tailwindcss/oxide: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const esbuild = require('esbuild');
    if (!esbuild || typeof esbuild.transformSync !== 'function') {
      failures.push('esbuild: module loaded without transformSync');
    }
  } catch (err) {
    failures.push(`esbuild: ${err instanceof Error ? err.message : String(err)}`);
  }

  return failures;
}

function runNpm(args) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npmCmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function unpackBindingTarballFallback(spec) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'texcellent-binding-'));
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packedName = execFileSync(
      npmCmd,
      ['pack', `${spec.name}@${spec.version}`, '--pack-destination', tmpDir, '--silent'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      }
    )
      .trim()
      .split(/\r?\n/)
      .pop();

    if (!packedName) {
      throw new Error(`npm pack returned no tarball name for ${spec.name}@${spec.version}`);
    }

    const tgzPath = path.join(tmpDir, packedName);
    const destDir = path.join(rootDir, 'node_modules', ...spec.name.split('/'));
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync('tar', ['-xzf', tgzPath, '-C', destDir, '--strip-components=1'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const versions = {
    rolldown: readPkgVersion('rolldown') || undefined,
    oxide: readPkgVersion('@tailwindcss/oxide') || undefined,
    esbuild: readPkgVersion('esbuild') || undefined,
  };

  const specs = getPlatformBindingTargets({
    platform: process.platform,
    arch: process.arch,
    isMusl: detectLinuxMusl(),
    versions,
  });

  const initialInstalled = Object.fromEntries(specs.map((s) => [s.name, readPkgVersion(s.name)]));
  const missingNativeOnly = findMissingBindingPackages(
    specs.filter((s) => s.kind === 'native'),
    initialInstalled
  );
  let loadFailures = await verifyBindingsLoad();

  if (loadFailures.length === 0 && missingNativeOnly.length === 0) {
    console.log(`[ensure-native-bindings] Verified native bindings for ${process.platform}-${process.arch}.`);
    return;
  }

  console.log(
    `[ensure-native-bindings] Repairing bindings for ${process.platform}-${process.arch} (missing=${missingNativeOnly.map((s) => s.name).join(', ') || 'none'}, loadFailures=${loadFailures.length})...`
  );

  const missingAll = findMissingBindingPackages(specs, initialInstalled);
  const toInstall = missingAll.length > 0 ? missingAll : specs;

  try {
    runNpm([
      'install',
      '--no-save',
      '--include=optional',
      '--force',
      '--no-audit',
      '--no-fund',
      '--legacy-peer-deps',
      ...formatNpmSpecs(toInstall),
    ]);
  } catch (err) {
    console.warn(
      `[ensure-native-bindings] npm install fallback triggered: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Fallback direct unpack for native packages if npm arborist still skipped optionalDependencies (#4828)
  const afterNpmInstalled = Object.fromEntries(specs.map((s) => [s.name, readPkgVersion(s.name)]));
  const stillMissing = findMissingBindingPackages(specs, afterNpmInstalled);
  for (const spec of stillMissing) {
    console.log(`[ensure-native-bindings] Extracting ${spec.name}@${spec.version} directly via npm pack + tar...`);
    unpackBindingTarballFallback(spec);
  }

  loadFailures = await verifyBindingsLoad();
  if (loadFailures.length > 0) {
    console.error('[ensure-native-bindings] Native binding verification failed:');
    for (const msg of loadFailures) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  console.log(`[ensure-native-bindings] All pre-built native & WASI bindings verified for ${process.platform}-${process.arch}.`);
}

main().catch((err) => {
  console.error('[ensure-native-bindings] Fatal error:', err);
  process.exit(1);
});
