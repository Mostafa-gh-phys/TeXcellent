import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLatexDocument, validateLatexBuild } from './latexParser';

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

test('validateLatexBuild catches xepersian under pdflatex and basic edition warnings', () => {
  const src = `\\documentclass{article}
\\usepackage{xepersian,tikz}
\\begin{document}
\\section{درس}
\\end{document}`;
  const diags = validateLatexBuild(src, 'pdflatex', 'texlive-2025', 'basic');
  assert.equal(diags.some((d) => d.level === 'error' && d.message.includes('XeLaTeX')), true);
  assert.equal(diags.some((d) => d.level === 'warning' && d.message.includes('Basic')), true);
});
