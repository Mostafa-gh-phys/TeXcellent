import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLatexTitle,
  resolveCompileTargetFile,
  resolveDocumentDisplayTitle,
} from './documentTitle';
import { ProjectFile } from '../types/latex';

const now = '2026-11-16T00:00:00.000Z';

const mainFile: ProjectFile = {
  id: 'main-tex',
  name: 'main.tex',
  language: 'latex',
  updatedAt: now,
  content: `\\documentclass{article}\n\\title{یادداشت‌های \\textbf{آنالیز ریاضی}}\n\\begin{document}\n\\maketitle\n\\end{document}`,
};

const standaloneReport: ProjectFile = {
  id: 'report-tex',
  name: 'report.tex',
  language: 'latex',
  updatedAt: now,
  content: `\\documentclass{article}\n\\title{Quantum Mechanics Report}\n\\begin{document}\n\\maketitle\nHello\\end{document}`,
};

const untitledStandalone: ProjectFile = {
  id: 'untitled-tex',
  name: 'redest.tex',
  language: 'latex',
  updatedAt: now,
  content: `\\documentclass{article}\n\\begin{document}\nHello\\end{document}`,
};

const chapterFragment: ProjectFile = {
  id: 'chap1-tex',
  name: 'chapters/intro.tex',
  language: 'latex',
  updatedAt: now,
  content: `\\section{Introduction}\nIncluded chapter content.`,
};

test('extractLatexTitle extracts and cleans braced \\title{...}', () => {
  assert.equal(extractLatexTitle(mainFile.content), 'یادداشت‌های آنالیز ریاضی');
  assert.equal(extractLatexTitle(standaloneReport.content), 'Quantum Mechanics Report');
  assert.equal(extractLatexTitle(untitledStandalone.content), null);
});

test('resolveCompileTargetFile targets standalone active .tex document or falls back to mainFile', () => {
  const files = [mainFile, standaloneReport, chapterFragment];
  assert.equal(resolveCompileTargetFile(standaloneReport, mainFile, files)?.id, 'report-tex');
  assert.equal(resolveCompileTargetFile(chapterFragment, mainFile, files)?.id, 'main-tex');
  assert.equal(resolveCompileTargetFile(mainFile, mainFile, files)?.id, 'main-tex');
});

test('resolveDocumentDisplayTitle updates dynamically per active document', () => {
  assert.equal(
    resolveDocumentDisplayTitle(mainFile, mainFile, 'Mathematical Analysis Notes'),
    'یادداشت‌های آنالیز ریاضی'
  );
  assert.equal(
    resolveDocumentDisplayTitle(standaloneReport, mainFile, 'Mathematical Analysis Notes'),
    'Quantum Mechanics Report'
  );
  assert.equal(
    resolveDocumentDisplayTitle(untitledStandalone, mainFile, 'Mathematical Analysis Notes'),
    'redest.tex'
  );
  assert.equal(
    resolveDocumentDisplayTitle(chapterFragment, mainFile, 'Mathematical Analysis Notes'),
    'یادداشت‌های آنالیز ریاضی · chapters/intro.tex'
  );
});
