import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFile } from '../types/latex';
import {
  clampPageNumber,
  computeFitWidthScale,
  computeNextZoom,
  computeOptimalDprScale,
  findForwardSyncTarget,
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
      '\\usepackage{xepersian}',
      '\\title{یادداشت‌های آنالیز ریاضی}',
      '\\begin{document}',
      '\\section{درس اول: نابرابری کوشی-شوارتز}',
      'در هر فضای ضرب داخلی نامساوی \\lr{Cauchy-Schwarz} برقرار است.',
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
    'نابرابری کوشی-شوارتز'
  );
  assert.equal(
    stripLatexMarkup('In \\lr{Quantum Mechanics} $x^2$ holds.'),
    'In Quantum Mechanics x^2 holds.'
  );
});

test('findSourceLineForPdfText resolves English and Persian inverse sync lines and exact columns', () => {
  const persianHit = findSourceLineForPdfText('نابرابری کوشی-شوارتز', SAMPLE_FILES, 'main', 'کوشی');
  assert.ok(persianHit);
  assert.equal(persianHit.fileId, 'main');
  assert.equal(persianHit.line, 5);
  assert.ok(persianHit.col > 10);

  const inlineHit = findSourceLineForPdfText(
    'نامساوی Cauchy-Schwarz برقرار است',
    SAMPLE_FILES,
    'main',
    'Cauchy-Schwarz'
  );
  assert.ok(inlineHit);
  assert.equal(inlineHit.line, 6);
  const line6 = SAMPLE_FILES[0].content.split('\n')[5];
  assert.equal(line6.slice(inlineHit.col - 1, inlineHit.col - 1 + 6), 'Cauchy');

  const chapterHit = findSourceLineForPdfText('compact self-adjoint operators', SAMPLE_FILES, 'main', 'adjoint');
  assert.ok(chapterHit);
  assert.equal(chapterHit.fileId, 'ch2');
  assert.equal(chapterHit.line, 2);

  assert.equal(findSourceLineForPdfText('x', SAMPLE_FILES), null);
});

test('findForwardSyncTarget skips preamble boilerplate on click, allows title, and isolates clicked column phrase', () => {
  const src = SAMPLE_FILES[0].content;
  assert.equal(findForwardSyncTarget(src, 2, 5, { allowNeighborFallback: false }), null);

  const titleTarget = findForwardSyncTarget(src, 3, 12, { allowNeighborFallback: false });
  assert.ok(titleTarget);
  assert.match(titleTarget.lineExcerpt, /یادداشت/);

  const line6 = src.split('\n')[5];
  const cauchyCol = line6.indexOf('Cauchy-Schwarz') + 2;
  const bodyTarget = findForwardSyncTarget(src, 6, cauchyCol, { allowNeighborFallback: false });
  assert.ok(bodyTarget);
  assert.match(bodyTarget.anchorText, /Cauchy-Schwarz/);
  assert.equal(findSearchExcerptForSourceLine(src, 7), 'Convergence Analysis');
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
