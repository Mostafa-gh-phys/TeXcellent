import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDesktopIcons } from './desktop-icons-lib.mjs';
import { buildElectronBuilderArgs, resolveReleaseTagMetadata } from './release-tag-lib.mjs';

const rootDir = process.cwd();
const platformFlags = process.argv.slice(2).filter(Boolean);

if (platformFlags.length === 0) {
  console.error('Usage: node scripts/package-desktop.mjs <electron-builder-flags...>');
  process.exit(1);
}

const meta = resolveReleaseTagMetadata(process.env.RELEASE_TAG);

fs.rmSync(path.join(rootDir, 'release'), { recursive: true, force: true });
const iconManifest = ensureDesktopIcons(rootDir, 'packaging');
console.log(
  `[package-desktop] Prepared icons in ${path.relative(rootDir, iconManifest.outDir) || 'packaging'} (ico=${fs.statSync(iconManifest.icoPath).size}B, icns=${fs.statSync(iconManifest.icnsPath).size}B)`
);

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = meta.appVersion;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(
  `[package-desktop] Packaging version=${meta.appVersion} tag=${meta.safeTag} artifactName=${meta.artifactName}`
);

const args = buildElectronBuilderArgs({
  platformFlags,
  appVersion: meta.appVersion,
  artifactName: meta.artifactName,
});

const localCli = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
if (fs.existsSync(localCli)) {
  execFileSync(process.execPath, [localCli, ...args.slice(2)], {
    cwd: rootDir,
    stdio: 'inherit',
  });
} else {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npxCmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
