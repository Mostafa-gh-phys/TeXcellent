import test from 'node:test';
import assert from 'node:assert/strict';
import { latexToMarkdown, markdownToLatex } from './latexMarkdown';

test('markdownToLatex converts headings, emphasis, math, lists, and tables cleanly', () => {
  const md = [
    '# Introduction',
    '',
    'We examine **spectral convergence** with $\\lambda_1 > 0$.',
    '',
    '- First item',
    '- Second item',
    '',
    '| Method | Accuracy |',
    '| --- | --- |',
    '| Baseline | 91.2 |',
  ].join('\n');

  const tex = markdownToLatex(md, { includePreamble: true, title: 'Demo Paper' });
  assert.equal(tex.includes('\\documentclass'), true);
  assert.equal(tex.includes('\\section{Introduction}'), true);
  assert.equal(tex.includes('\\textbf{spectral convergence}'), true);
  assert.equal(tex.includes('$\\lambda_1 > 0$'), true);
  assert.equal(tex.includes('\\begin{itemize}'), true);
  assert.equal(tex.includes('\\begin{tabular}{ll}'), true);
});

test('latexToMarkdown converts LaTeX sections, math, lists, and booktabs tables to Markdown', () => {
  const tex = `\\documentclass{article}
\\begin{document}
\\section{Results}
Our model achieves \\textbf{99.4\\%} accuracy with $x^2 + y^2 = 1$.
\\begin{enumerate}
  \\item Fast convergence
  \\item Low variance
\\end{enumerate}
\\end{document}`;

  const md = latexToMarkdown(tex);
  assert.equal(md.includes('# Results'), true);
  assert.equal(md.includes('**99.4%**'), true);
  assert.equal(md.includes('$x^2 + y^2 = 1$'), true);
  assert.equal(md.includes('1. Fast convergence'), true);
  assert.equal(md.includes('2. Low variance'), true);
});
