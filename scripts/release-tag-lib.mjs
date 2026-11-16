/**
 * Resolve normalized semver appVersion and filesystem-safe release tag metadata.
 * @param {string | undefined | null} rawTag
 * @returns {{ rawTag: string; safeTag: string; appVersion: string; artifactName: string }}
 */
export function resolveReleaseTagMetadata(rawTag) {
  const trimmed = String(rawTag || 'v1.0.0').trim() || 'v1.0.0';
  const safeTag = trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-') || 'v1.0.0';
  const semverMatch = trimmed
    .replace(/^v/i, '')
    .match(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  const appVersion = semverMatch && semverMatch[0] ? semverMatch[0] : '1.0.0';

  return {
    rawTag: trimmed,
    safeTag,
    appVersion,
    artifactName: `TeXcellent-${safeTag}-\${arch}.\${ext}`,
  };
}

/**
 * Build deterministic electron-builder CLI arguments.
 * @param {{ platformFlags: string[]; appVersion: string; artifactName: string }} params
 * @returns {string[]}
 */
export function buildElectronBuilderArgs({ platformFlags, appVersion, artifactName }) {
  if (!appVersion || !appVersion.trim()) {
    throw new Error('appVersion must be non-empty before invoking electron-builder.');
  }
  return [
    '--no-install',
    'electron-builder',
    '--config',
    'electron-builder.yml',
    ...platformFlags,
    `-c.extraMetadata.version=${appVersion}`,
    `-c.artifactName=${artifactName}`,
    '--publish',
    'never',
  ];
}
