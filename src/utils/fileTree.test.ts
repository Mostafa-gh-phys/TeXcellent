import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFileTree,
  collectFolderPaths,
  inferFileLanguage,
  normalizeProjectFilePath,
  stripSharedRootFolder,
} from './fileTree';
import type { ProjectFile } from '../types/latex';

test('normalizeProjectFilePath strips traversal segments and normalizes slashes', () => {
  assert.equal(normalizeProjectFilePath('chapters\\..\\sections/intro.tex'), 'chapters/sections/intro.tex');
  assert.equal(normalizeProjectFilePath('/leading/slash/refs.bib'), 'leading/slash/refs.bib');
});

test('stripSharedRootFolder unwraps common top-level directory when opening a folder', () => {
  const input = ['my-paper/main.tex', 'my-paper/chapters/ch1.tex', 'my-paper/refs.bib'];
  assert.deepEqual(stripSharedRootFolder(input), ['main.tex', 'chapters/ch1.tex', 'refs.bib']);

  const mixed = ['a/main.tex', 'b/other.tex'];
  assert.deepEqual(stripSharedRootFolder(mixed), ['a/main.tex', 'b/other.tex']);
});

test('buildFileTree creates sorted folder hierarchy with folders before files', () => {
  const files: ProjectFile[] = [
    { id: '1', name: 'references.bib', content: '', language: 'bibtex', updatedAt: '' },
    { id: '2', name: 'chapters/intro.tex', content: '', language: 'latex', updatedAt: '' },
    { id: '3', name: 'chapters/appendix/proofs.tex', content: '', language: 'latex', updatedAt: '' },
    { id: '4', name: 'main.tex', content: '', language: 'latex', updatedAt: '' },
  ];

  const tree = buildFileTree(files);
  assert.equal(tree.length, 3);
  assert.equal(tree[0].kind, 'folder');
  assert.equal(tree[0].name, 'chapters');
  assert.equal(tree[1].kind, 'file');
  assert.equal(tree[1].name, 'main.tex');
  assert.equal(tree[2].kind, 'file');
  assert.equal(tree[2].name, 'references.bib');

  if (tree[0].kind === 'folder') {
    assert.equal(tree[0].children[0].kind, 'folder');
    assert.equal(tree[0].children[0].name, 'appendix');
    assert.equal(tree[0].children[1].kind, 'file');
    assert.equal(tree[0].children[1].name, 'intro.tex');
  }

  assert.deepEqual(collectFolderPaths(files), ['chapters', 'chapters/appendix']);
  assert.equal(inferFileLanguage('preamble.sty'), 'style');
  assert.equal(inferFileLanguage('refs.bib'), 'bibtex');
  assert.equal(inferFileLanguage('ch1.tex'), 'latex');
});
