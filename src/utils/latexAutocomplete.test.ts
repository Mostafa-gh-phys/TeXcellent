import test from 'node:test';
import assert from 'node:assert/strict';
import { extractUsedPackages, getLatexSuggestions } from './latexAutocomplete';

test('extractUsedPackages parses single and comma-separated \\usepackage declarations', () => {
  const doc = `
    \\documentclass{article}
    \\usepackage[utf8]{inputenc}
    \\usepackage{amsmath, amssymb, xepersian}
  `;
  const pkgs = extractUsedPackages(doc);
  assert.equal(pkgs.has('core'), true);
  assert.equal(pkgs.has('amsmath'), true);
  assert.equal(pkgs.has('amssymb'), true);
  assert.equal(pkgs.has('xepersian'), true);
});

test('getLatexSuggestions prioritizes loaded package commands and resolves refs & bib keys', () => {
  const doc = `
    \\usepackage{xepersian,amsmath}
    \\section{Intro}\\label{sec:intro}
    \\settext
  `;
  const cmdRes = getLatexSuggestions(doc, doc.indexOf('\\settext') + 8, []);
  assert.ok(cmdRes);
  assert.equal(cmdRes.items[0].label, '\\settextfont');
  assert.equal(cmdRes.items[0].pkg, 'xepersian');

  const refDoc = doc + '\\ref{sec:';
  const refRes = getLatexSuggestions(refDoc, refDoc.length, []);
  assert.ok(refRes);
  assert.equal(refRes.items[0].label, 'sec:intro');

  const citeDoc = doc + '\\cite{rud';
  const citeRes = getLatexSuggestions(citeDoc, citeDoc.length, [
    {
      id: 'bib',
      name: 'refs.bib',
      language: 'bibtex',
      updatedAt: '',
      content: '@book{rudin1987,\n author={Rudin}\n}',
    },
  ]);
  assert.ok(citeRes);
  assert.equal(citeRes.items[0].label, 'rudin1987');
});

test('getLatexSuggestions surfaces smart snippets on \\snip and topic triggers', () => {
  const doc = '\\usepackage{xepersian,tcolorbox}\n\\snip:bi';
  const snipRes = getLatexSuggestions(doc, doc.length, []);
  assert.ok(snipRes);
  assert.equal(snipRes.items[0].kind, 'snippet');
  assert.equal(snipRes.items[0].label, '\\snip:bilingual-box');
  assert.equal(snipRes.items[0].insertText.includes('\\begin{tcolorbox}'), true);

  const casesDoc = '\\usepackage{amsmath}\n\\cases';
  const casesRes = getLatexSuggestions(casesDoc, casesDoc.length, []);
  assert.ok(casesRes);
  assert.equal(casesRes.items.some((it) => it.kind === 'snippet' && it.label === '\\snip:cases'), true);
});

test('getLatexSuggestions completes package options inside \\usepackage[...]{pkg} and without closing brace', () => {
  const geomDoc = '\\usepackage[margin=1in, ]{geometry}';
  const geomCursor = geomDoc.indexOf(']{geometry}');
  const geomRes = getLatexSuggestions(geomDoc, geomCursor, []);
  assert.ok(geomRes);
  assert.equal(geomRes.items.some((it) => it.kind === 'option' && it.label === 'a4paper'), true);
  assert.equal(geomRes.items.some((it) => it.label === 'margin=1in'), false);

  const hyperDoc = '\\usepackage[color]{hyperref}';
  const hyperCursor = hyperDoc.indexOf(']{hyperref}');
  const hyperRes = getLatexSuggestions(hyperDoc, hyperCursor, []);
  assert.ok(hyperRes);
  assert.equal(hyperRes.items[0].label, 'colorlinks=true');
  assert.equal(hyperRes.items[0].kind, 'option');

  const openPkgDoc = '\\usepackage[utf8]{inputenc}\n\\usepackage[a4';
  const openPkgRes = getLatexSuggestions(openPkgDoc, openPkgDoc.length, []);
  assert.ok(openPkgRes);
  assert.equal(openPkgRes.items.some((it) => it.kind === 'option' && it.label === 'a4paper'), true);
});

test('getLatexSuggestions completes \\documentclass, \\hypersetup, \\includegraphics, and environment options', () => {
  const docClass = '\\documentclass[12';
  const docRes = getLatexSuggestions(docClass, docClass.length, []);
  assert.ok(docRes);
  assert.equal(docRes.items.some((it) => it.kind === 'option' && it.label === '12pt'), true);

  const hyperSetup = '\\hypersetup{linkc';
  const setupRes = getLatexSuggestions(hyperSetup, hyperSetup.length, []);
  assert.ok(setupRes);
  assert.equal(setupRes.items[0].label, 'linkcolor=blue');

  const imgDoc = '\\includegraphics[wid';
  const imgRes = getLatexSuggestions(imgDoc, imgDoc.length, []);
  assert.ok(imgRes);
  assert.equal(imgRes.items[0].label, 'width=0.8\\textwidth');

  const figDoc = '\\begin{figure}[ht';
  const figRes = getLatexSuggestions(figDoc, figDoc.length, []);
  assert.ok(figRes);
  assert.equal(figRes.items[0].label, 'htbp');
});


