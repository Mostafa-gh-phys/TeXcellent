// Pure helpers for resolving and auditing pre-built native & WASI fallback packages
// across Windows, macOS, and Linux CI runners.

/**
 * @typedef {{ name: string; version: string; kind: 'native' | 'wasm' }} BindingSpec
 * @typedef {{ rolldown?: string; oxide?: string; esbuild?: string }} ToolVersions
 */

/**
 * Resolve exact pre-built platform package names for rolldown, @tailwindcss/oxide, and esbuild.
 * @param {{ platform: string; arch: string; isMusl?: boolean; versions: ToolVersions }} params
 * @returns {BindingSpec[]}
 */
export function getPlatformBindingTargets({ platform, arch, isMusl = false, versions }) {
  /** @type {BindingSpec[]} */
  const specs = [];

  if (versions.rolldown) {
    const v = versions.rolldown;
    let nativePkg = null;
    if (platform === 'win32') {
      if (arch === 'x64') nativePkg = '@rolldown/binding-win32-x64-msvc';
      else if (arch === 'arm64') nativePkg = '@rolldown/binding-win32-arm64-msvc';
    } else if (platform === 'darwin') {
      if (arch === 'arm64') nativePkg = '@rolldown/binding-darwin-arm64';
      else if (arch === 'x64') nativePkg = '@rolldown/binding-darwin-x64';
    } else if (platform === 'linux') {
      const libc = isMusl ? 'musl' : 'gnu';
      if (arch === 'x64') nativePkg = `@rolldown/binding-linux-x64-${libc}`;
      else if (arch === 'arm64') nativePkg = `@rolldown/binding-linux-arm64-${libc}`;
    }

    if (nativePkg) {
      specs.push({ name: nativePkg, version: v, kind: 'native' });
    }
    specs.push({ name: '@rolldown/binding-wasm32-wasi', version: v, kind: 'wasm' });
  }

  if (versions.oxide) {
    const v = versions.oxide;
    let oxidePkg = null;
    if (platform === 'win32') {
      if (arch === 'x64') oxidePkg = '@tailwindcss/oxide-win32-x64-msvc';
      else if (arch === 'arm64') oxidePkg = '@tailwindcss/oxide-win32-arm64-msvc';
    } else if (platform === 'darwin') {
      if (arch === 'arm64') oxidePkg = '@tailwindcss/oxide-darwin-arm64';
      else if (arch === 'x64') oxidePkg = '@tailwindcss/oxide-darwin-x64';
    } else if (platform === 'linux') {
      const libc = isMusl ? 'musl' : 'gnu';
      if (arch === 'x64') oxidePkg = `@tailwindcss/oxide-linux-x64-${libc}`;
      else if (arch === 'arm64') oxidePkg = `@tailwindcss/oxide-linux-arm64-${libc}`;
    }

    if (oxidePkg) {
      specs.push({ name: oxidePkg, version: v, kind: 'native' });
    }
    specs.push({ name: '@tailwindcss/oxide-wasm32-wasi', version: v, kind: 'wasm' });
  }

  if (versions.esbuild) {
    const v = versions.esbuild;
    let esbuildPkg = null;
    if (platform === 'win32') {
      if (arch === 'x64') esbuildPkg = '@esbuild/win32-x64';
      else if (arch === 'arm64') esbuildPkg = '@esbuild/win32-arm64';
    } else if (platform === 'darwin') {
      if (arch === 'arm64') esbuildPkg = '@esbuild/darwin-arm64';
      else if (arch === 'x64') esbuildPkg = '@esbuild/darwin-x64';
    } else if (platform === 'linux') {
      if (arch === 'x64') esbuildPkg = '@esbuild/linux-x64';
      else if (arch === 'arm64') esbuildPkg = '@esbuild/linux-arm64';
    }

    if (esbuildPkg) {
      specs.push({ name: esbuildPkg, version: v, kind: 'native' });
    }
  }

  return specs;
}

/**
 * Filter specs to those missing from node_modules or mismatched in version.
 * @param {BindingSpec[]} specs
 * @param {Record<string, string | null | undefined>} installedVersions
 * @returns {BindingSpec[]}
 */
export function findMissingBindingPackages(specs, installedVersions) {
  return specs.filter((spec) => installedVersions[spec.name] !== spec.version);
}

/**
 * Format exact npm package@version descriptors.
 * @param {BindingSpec[]} specs
 * @returns {string[]}
 */
export function formatNpmSpecs(specs) {
  return specs.map((spec) => `${spec.name}@${spec.version}`);
}
