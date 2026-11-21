import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIncludeAppPublishFile } from './appPublishFilter';

test('shouldIncludeAppPublishFile permits only TeXcellent app source and packaging files', () => {
  assert.equal(shouldIncludeAppPublishFile('src/App.tsx'), true);
  assert.equal(shouldIncludeAppPublishFile('server.ts'), true);
  assert.equal(shouldIncludeAppPublishFile('electron/main.cjs'), true);
  assert.equal(shouldIncludeAppPublishFile('packaging/icon.ico'), true);
  assert.equal(shouldIncludeAppPublishFile('scripts/package-desktop.mjs'), true);
  assert.equal(shouldIncludeAppPublishFile('.github/workflows/build-desktop.yml'), true);
  assert.equal(shouldIncludeAppPublishFile('.env.example'), true);
  assert.equal(shouldIncludeAppPublishFile('public/favicon.svg'), true);
});

test('shouldIncludeAppPublishFile blocks personal projects, compiled outputs, secrets, and local artifacts', () => {
  assert.equal(shouldIncludeAppPublishFile('my-thesis.tex'), false);
  assert.equal(shouldIncludeAppPublishFile('personal-projects/paper.tex'), false);
  assert.equal(shouldIncludeAppPublishFile('src/notes/draft.pdf'), false);
  assert.equal(shouldIncludeAppPublishFile('src/notes/main.aux'), false);
  assert.equal(shouldIncludeAppPublishFile('src/notes/main.synctex.gz'), false);
  assert.equal(shouldIncludeAppPublishFile('public/assets/aistudio/error.txt'), false);
  assert.equal(shouldIncludeAppPublishFile('.env'), false);
  assert.equal(shouldIncludeAppPublishFile('.env.local'), false);
  assert.equal(shouldIncludeAppPublishFile('release/TeXcellent.exe'), false);
  assert.equal(shouldIncludeAppPublishFile('.playwright-cli/desktop.png'), false);
  assert.equal(shouldIncludeAppPublishFile('workspace.sqlite'), false);
});
