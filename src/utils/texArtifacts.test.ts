import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLatexDocument } from './latexParser';
import {
  formatArtifactSize,
  generateSyntheticAuxContent,
  isInspectableTextArtifact,
} from './texArtifacts';

test('generateSyntheticAuxContent writes TOC, newlabel, bibcite, and lastpage entries', () => {
  const source = `
\\documentclass{article}
\\usepackage{hyperref}
\\begin{document}
\\section{Introduction}
\\label{sec:intro}
See \\cite{knuth1984} and \\ref{sec:intro}.
\\end{document}
`;
  const parsed = parseLatexDocument(source);
  const aux = generateSyntheticAuxContent(parsed, source, 2);

  assert.match(aux, /^\\relax /);
  assert.ok(aux.includes('\\@writefile{toc}{\\contentsline {section}{\\numberline {1}Introduction}{1}{}}'));
  assert.ok(aux.includes('\\newlabel{sec:intro}{{1}{1}{}{}{}}'));
  assert.ok(aux.includes('\\bibcite{knuth1984}{1}'));
  assert.ok(aux.includes('\\gdef\\@abspage@last{2}'));
});

test('artifact inspection & formatting helpers classify sidecar files accurately', () => {
  assert.equal(isInspectableTextArtifact('main.aux'), true);
  assert.equal(isInspectableTextArtifact('main.log'), true);
  assert.equal(isInspectableTextArtifact('main.toc'), true);
  assert.equal(isInspectableTextArtifact('main.pdf'), false);
  assert.equal(isInspectableTextArtifact('main.synctex.gz'), false);
  assert.equal(formatArtifactSize(512), '512 B');
  assert.equal(formatArtifactSize(2048), '2.0 KB');
});
