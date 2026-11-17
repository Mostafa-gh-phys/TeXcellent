import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inlineProjectInputs,
  parseLatexDocument,
  validateLatexBuild,
} from './latexParser';

test('parseLatexDocument extracts sections, math, RTL flag, and labels', () => {
  const src = `
    \\documentclass{article}
    \\usepackage{xepersian,amsmath}
    \\title{عنوان}
    \\begin{document}
    \\maketitle
    \\section{درس اول}\\label{sec:one}
    متن آزمایشی با فرمول $x^2 + y^2 = z^2$.
    $$\\int_0^1 x\\,dx = \\frac{1}{2}$$
    \\end{document}
  `;
  const parsed = parseLatexDocument(src);
  assert.equal(parsed.isRtlDocument, true);
  assert.equal(parsed.title, 'عنوان');
  assert.equal(parsed.labels['sec:one'], '1');
  assert.equal(parsed.blocks.some((b) => b.type === 'section' && b.title === 'درس اول'), true);
  assert.equal(parsed.blocks.some((b) => b.type === 'display-math'), true);
});

test('parseLatexDocument handles nested XePersian title/caption braces, chapters, latin/persian blocks, and ignores KashidaOn', () => {
  const src = `
    \\documentclass{book}
    \\usepackage{amsmath}
    \\usepackage{xepersian}
    \\settextfont{Vazirmatn}
    \\title{تحلیل \\lr{XePersian} و \\textbf{ریاضی}}
    \\begin{document}
    \\maketitle
    \\KashidaOn
    \\DefaultMathsDigits
    \\chapter{فصل اول: \\lr{Foundations}}
    \\begin{latin}
    \\section{English Subsection}
    Hello world.
    \\end{latin}
    \\end{document}
  `;
  const parsed = parseLatexDocument(src);
  assert.equal(parsed.title, 'تحلیل XePersian و ریاضی');
  assert.equal(
    parsed.blocks.some((b) => b.type === 'section' && b.title === 'فصل اول: Foundations'),
    true
  );
  assert.equal(
    parsed.blocks.some((b) => b.type === 'section' && b.title === 'English Subsection' && b.rtl === false),
    true
  );
  const allParagraphText = parsed.blocks
    .flatMap((b) => b.segments || [])
    .map((s) => s.text)
    .join(' ');
  assert.equal(allParagraphText.includes('KashidaOn'), false);
  assert.equal(allParagraphText.includes('DefaultMathsDigits'), false);
});

test('inlineProjectInputs expands included chapter .tex files', () => {
  const expanded = inlineProjectInputs('\\begin{document}\n\\input{chapters/ch1}\n\\end{document}', [
    { name: 'main.tex', content: '' },
    { name: 'chapters/ch1.tex', content: '\\section{فصل یک}\nمتن آزمایشی' },
  ]);
  assert.equal(expanded.includes('\\section{فصل یک}'), true);
});

test('validateLatexBuild catches xepersian under pdflatex, load-order warnings, and basic edition warnings', () => {
  const src = `\\documentclass{article}
\\usepackage{xepersian}
\\usepackage{hyperref}
\\begin{document}
\\section{درس}
\\end{document}`;
  const diags = validateLatexBuild(src, 'pdflatex', 'texlive-2025', 'basic');
  assert.equal(diags.some((d) => d.level === 'error' && d.message.includes('XeLaTeX')), true);
  assert.equal(diags.some((d) => d.level === 'warning' && d.message.includes('BEFORE')), true);
  assert.equal(diags.some((d) => d.level === 'warning' && d.message.includes('Basic')), true);
});

