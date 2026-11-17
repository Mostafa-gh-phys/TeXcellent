import test from 'node:test';
import assert from 'node:assert/strict';
import { latexMathToUnicode, shapePersianForPdf, shapePersianRunsForPdf } from './pdfTextShaper';

test('shapePersianForPdf shapes Persian words into Presentation Forms-B without losing characters', () => {
  const shaped = shapePersianForPdf('درس اول');
  assert.equal(shaped.includes('?'), false);
  // Final/isolated forms exist in FE70-FEFF or FB50-FDFF
  assert.equal(/[\uFB50-\uFDFF\uFE70-\uFEFF]/.test(shaped), true);
});

test('shapePersianForPdf preserves LTR words inside RTL sentences', () => {
  const mixed = shapePersianForPdf('نامساوی Cauchy-Schwarz برقرار است', true);
  assert.equal(mixed.includes('Cauchy-Schwarz'), true);

  const runs = shapePersianRunsForPdf('نامساوی Cauchy-Schwarz برقرار است', true);
  assert.equal(runs.some((r) => !r.isRtl && r.text.includes('Cauchy-Schwarz')), true);
  assert.equal(runs.some((r) => r.isRtl), true);
});

test('latexMathToUnicode converts LaTeX math operators to readable Unicode glyphs', () => {
  const uni = latexMathToUnicode('|\\langle u, v \\rangle| \\leqslant \\|u\\| \\cdot \\|v\\|');
  assert.equal(uni.includes('⟨u, v⟩'), true);
  assert.equal(uni.includes('≤'), true);
  assert.equal(uni.includes('‖u‖'), true);
  assert.equal(uni.includes('·'), true);
});
