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

