import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElectronBuilderArgs,
  resolveReleaseTagMetadata,
} from '../../scripts/release-tag-lib.mjs';

test('resolveReleaseTagMetadata strips leading v for appVersion and embeds tag in artifactName', () => {
  const meta = resolveReleaseTagMetadata('v1.2.0');
  assert.equal(meta.appVersion, '1.2.0');
  assert.equal(meta.safeTag, 'v1.2.0');
  assert.equal(meta.artifactName, 'TeXcellent-v1.2.0-${arch}.${ext}');
});

test('resolveReleaseTagMetadata handles bare semver, pre-release, and invalid tags safely', () => {
  assert.equal(resolveReleaseTagMetadata('2.4.1-beta.1').appVersion, '2.4.1-beta.1');
  assert.equal(resolveReleaseTagMetadata('').appVersion, '1.0.0');
  assert.equal(resolveReleaseTagMetadata('release/2026').appVersion, '1.0.0');
  assert.equal(resolveReleaseTagMetadata('release/2026').safeTag, 'release-2026');
});

test('buildElectronBuilderArgs passes non-empty version and artifactName', () => {
  const args = buildElectronBuilderArgs({
    platformFlags: ['--win', 'nsis'],
    appVersion: '1.2.0',
    artifactName: 'TeXcellent-v1.2.0-${arch}.${ext}',
  });
  assert.ok(args.includes('-c.extraMetadata.version=1.2.0'));
  assert.ok(args.includes('-c.artifactName=TeXcellent-v1.2.0-${arch}.${ext}'));
  assert.throws(
    () => buildElectronBuilderArgs({ platformFlags: ['--linux', 'AppImage'], appVersion: '', artifactName: 'x' }),
    /non-empty/
  );
});
