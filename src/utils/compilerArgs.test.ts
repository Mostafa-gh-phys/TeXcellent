import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompilerCliArgs,
  mergeCompilerSettings,
  parseExtraCliArgs,
  resolveBibliographyTool,
  resolvePassCount,
  sanitizeRelativeTeXPath,
} from './compilerArgs';
import type { ProjectFile } from '../types/latex';

test('mergeCompilerSettings fills missing fields from legacy localStorage objects', () => {
  const merged = mergeCompilerSettings({ compilerMode: 'pdflatex', synctex: false });
  assert.equal(merged.compilerMode, 'pdflatex');
  assert.equal(merged.synctex, false);
  assert.equal(merged.interactionMode, 'nonstopmode');
  assert.equal(merged.bibliographyTool, 'auto');
  assert.equal(merged.fileLineError, true);
});

test('buildCompilerCliArgs builds safe CLI flags for xelatex, pdflatex DVI, and latexmk', () => {
  const xeArgs = buildCompilerCliArgs('xelatex', 'chapters/main.tex', {
    interactionMode: 'nonstopmode',
    synctex: true,
    haltOnError: true,
    fileLineError: true,
    shellEscape: true,
    extraArgs: '-recorder -output-directory=out',
  });
  assert.deepEqual(xeArgs, [
    '-interaction=nonstopmode',
    '-file-line-error',
    '-halt-on-error',
    '-synctex=1',
    '-shell-escape',
    '-recorder',
    '-output-directory=out',
    'chapters/main.tex',
  ]);

  const pdfDvi = buildCompilerCliArgs('pdflatex', 'paper.tex', { outputFormat: 'dvi' });
  assert.equal(pdfDvi.includes('-output-format=dvi'), true);

  assert.deepEqual(parseExtraCliArgs('-recorder; $(whoami) /tmp -max-print-line=120'), [
    '-max-print-line=120',
  ]);
  assert.equal(sanitizeRelativeTeXPath('../../secret/main.tex'), 'secret/main.tex');
});

test('resolveBibliographyTool and resolvePassCount detect biblatex/bibtex/refs cleanly', () => {
  const bibFiles: ProjectFile[] = [
    { id: 'bib', name: 'references.bib', content: '', language: 'bibtex', updatedAt: '' },
  ];
  const biblatexSrc = '\\usepackage[backend=biber]{biblatex}\n\\addbibresource{references.bib}';
  assert.equal(resolveBibliographyTool(biblatexSrc, bibFiles, 'auto'), 'biber');
  assert.equal(resolvePassCount(biblatexSrc, { compilePasses: 'auto' }, 'biber'), 3);

  const bibtexSrc = '\\bibliography{references}\\cite{rudin1987}';
  assert.equal(resolveBibliographyTool(bibtexSrc, bibFiles, 'auto'), 'bibtex');

  const simpleRefsSrc = '\\section{A}\\label{a} See \\ref{a}.';
  assert.equal(resolvePassCount(simpleRefsSrc, { compilePasses: 'auto' }, 'none'), 2);
});
