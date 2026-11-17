import test from 'node:test';
import assert from 'node:assert/strict';
import {
  latexMathToUnicode,
  shapePersianForPdf,
  shapePersianRunsForPdf,
  splitBidiRunsForFontkit,
} from './pdfTextShaper';

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

test('splitBidiRunsForFontkit preserves raw Persian Unicode, exact spaces around LTR spans, and digit order', () => {
  const runs = splitBidiRunsForFontkit('نامساوی Cauchy-Schwarz برقرار است', true);
  assert.deepEqual(
    runs.map((r) => r.text),
    ['برقرار است', ' ', 'Cauchy-Schwarz', ' ', 'نامساوی']
  );

  const phraseRuns = splitBidiRunsForFontkit('در Quantum Mechanics برای u, v ∈ H داریم', true);
  assert.deepEqual(
    phraseRuns.map((r) => r.text),
    ['داریم', ' ', 'u, v ∈ H', ' ', 'برای', ' ', 'Quantum Mechanics', ' ', 'در']
  );

  const rtlHyphen = splitBidiRunsForFontkit('درس اول: نابرابری کوشی-شوارتز', true);
  assert.deepEqual(rtlHyphen, [{ text: 'درس اول: نابرابری کوشی-شوارتز', isRtl: true }]);

  const yearRuns = splitBidiRunsForFontkit('سال ۱۴۰۵ هجری', true);
  assert.equal(yearRuns[0].isRtl, true);
  assert.equal(yearRuns[0].text.includes('۵۰۴۱'), true);
});

test('latexMathToUnicode converts LaTeX math operators, roots, subscripts, and superscripts to Unicode', () => {
  const uni = latexMathToUnicode('|\\langle u, v \\rangle| \\leqslant \\|u\\| \\cdot \\|v\\|');
  assert.equal(uni.includes('⟨u, v⟩'), true);
  assert.equal(uni.includes('≤'), true);
  assert.equal(uni.includes('‖u‖'), true);
  assert.equal(uni.includes('·'), true);

  const subSup = latexMathToUnicode('e^{-x^2} + L_1 + \\sqrt{\\pi} + \\mathrm{softmax}(x)');
  assert.equal(subSup.includes('e^(-x²)'), true);
  assert.equal(subSup.includes('L₁'), true);
  assert.equal(subSup.includes('√π'), true);
  assert.equal(subSup.includes('softmax(x)'), true);
});

test('shapePersianForPdf preserves multi-digit Persian numerals in natural order', () => {
  const shaped = shapePersianForPdf('سال ۱۴۰۵ هجری', true);
  assert.equal(shaped.includes('۱۴۰۵'), true);
});
