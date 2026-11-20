import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFile } from '../types/latex';
import {
  clampPageNumber,
  computeFitWidthScale,
  computeNextZoom,
  computeOptimalDprScale,
  findSearchExcerptForSourceLine,
  findSourceLineForPdfText,
  stripLatexMarkup,
} from './pdfSync';

const SAMPLE_FILES: ProjectFile[] = [
  {
    id: 'main',
    name: 'main.tex',
    language: 'latex',
    updatedAt: '2026-11-20T00:00:00Z',
    content: [
      '\\documentclass{article}',
      '\\title{یادداشت‌های آنالیز ریاضی}',
      '\\begin{document}',
      '\\section{درس اول: نابرابری کوشی-شوارتز}',
      'در هر فضای ضرب داخلی نامساوی زیر برقرار است.',
      '\\section{Convergence Analysis}',
      'This theorem guarantees uniform convergence across intervals.',
      '\\end{document}',
    ].join('\n'),
  },
  {
    id: 'ch2',
    name: 'chapters/intro.tex',
    language: 'latex',
    updatedAt: '2026-11-20T00:00:00Z',
    content: [
      '\\section{Spectral Decomposition}',
      'Eigenvalues of compact self-adjoint operators are real.',
    ].join('\n'),
  },
];

test('stripLatexMarkup unwraps headings, formatting commands, and comments cleanly', () => {
  assert.equal(
    stripLatexMarkup('\\section{نابرابری \\textbf{کوشی}-شوارتز} % note'),
    'نابرابری کوشی -شوارتز'.replace(' -', '-')
  );
  assert.equal(
    stripLatexMarkup('In \\lr{Quantum Mechanics} $x^2$ holds.'),
    'In Quantum Mechanics x^2 holds.'
  );
});

test('findSourceLineForPdfText resolves English and Persian inverse sync targets accurately', () => {
  const persianHit = findSourceLineForPdfText('نابرابری کوشی-شوارتز', SAMPLE_FILES, 'main');
  assert.ok(persianHit);
  assert.equal(persianHit.fileId, 'main');
  assert.equal(persianHit.line, 4);

  const chapterHit = findSourceLineForPdfText('compact self-adjoint operators', SAMPLE_FILES, 'main');
  assert.ok(chapterHit);
  assert.equal(chapterHit.fileId, 'ch2');
  assert.equal(chapterHit.line, 2);

  assert.equal(findSourceLineForPdfText('x', SAMPLE_FILES), null);
});

test('findSearchExcerptForSourceLine extracts nearby searchable words for forward sync', () => {
  const src = SAMPLE_FILES[0].content;
  assert.equal(findSearchExcerptForSourceLine(src, 6), 'Convergence Analysis');
  assert.ok(findSearchExcerptForSourceLine(src, 3).length > 0);
});

test('clampPageNumber, computeNextZoom, computeFitWidthScale, and computeOptimalDprScale stay bounded', () => {
  assert.equal(clampPageNumber(0, 5), 1);
  assert.equal(clampPageNumber(9, 5), 5);
  assert.equal(clampPageNumber(3, 5), 3);

  assert.equal(computeNextZoom(100, 15), 115);
  assert.equal(computeNextZoom(245, 20), 250);
  assert.equal(computeNextZoom(55, -20), 50);

  const fit = computeFitWidthScale(640, 595.28, 32);
  assert.ok(fit > 1.0 && fit < 1.1);

  const scaleNormal = computeOptimalDprScale(1, 600, 840);
  assert.equal(scaleNormal, 2);

  const scaleHuge = computeOptimalDprScale(2, 3000, 4200);
  assert.ok(scaleHuge >= 1 && scaleHuge <= 1.4);
});
