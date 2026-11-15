import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBidiSpans,
  detectInputScript,
  detectLineDirection,
  hasRtlChar,
  tokenizeLatexLine,
} from './bidiLatex';

test('detects RTL characters in Persian and Arabic strings', () => {
  assert.equal(hasRtlChar('درس اول'), true);
  assert.equal(hasRtlChar('Hello World'), false);
  assert.equal(hasRtlChar('\\section{درس}'), true);
});

test('detectLineDirection keeps LaTeX commands LTR while Persian prose is RTL', () => {
  assert.equal(detectLineDirection('\\section{درس}', 'auto'), 'ltr');
  assert.equal(detectLineDirection('  \\textbf{متن مهم}', 'auto'), 'ltr');
  assert.equal(detectLineDirection('این یک متن فارسی با \\lr{LaTeX} است.', 'auto'), 'rtl');
  assert.equal(detectLineDirection('This is English prose.', 'auto'), 'ltr');
  assert.equal(detectLineDirection('این متن فارسی است', 'ltr'), 'ltr');
  assert.equal(detectLineDirection('English override', 'rtl'), 'rtl');
});

test('tokenizeLatexLine isolates \\section{درس} into LTR command/braces and RTL inner text', () => {
  const tokens = tokenizeLatexLine('\\section{درس}');
  assert.deepEqual(
    tokens.map((t) => ({ text: t.text, type: t.type, dir: t.dir, isolate: t.isolate })),
    [
      { text: '\\section', type: 'command', dir: 'ltr', isolate: true },
      { text: '{', type: 'brace', dir: 'ltr', isolate: true },
      { text: 'درس', type: 'rtl-text', dir: 'rtl', isolate: true },
      { text: '}', type: 'brace', dir: 'ltr', isolate: true },
    ]
  );
});

test('computeBidiSpans keeps inline math and \\lr{...} as single LTR units inside RTL lines and preserves RTL brace spaces', () => {
  const rtlLine = 'برای هر $u, v \\in H$ نامساوی \\lr{Cauchy-Schwarz} و \\textbf{متن} برقرار است.';
  const spans = computeBidiSpans(rtlLine, 'rtl').map((s) => ({
    slice: rtlLine.slice(s.from, s.to),
    dir: s.dir,
  }));
  assert.equal(spans.some((s) => s.slice === '$u, v \\in H$' && s.dir === 'ltr'), true);
  assert.equal(spans.some((s) => s.slice === '\\lr{Cauchy-Schwarz}' && s.dir === 'ltr'), true);
  assert.equal(spans.some((s) => s.slice === '\\textbf{متن}' && s.dir === 'ltr'), true);
  assert.equal(spans.some((s) => s.slice === 'متن' && s.dir === 'rtl'), true);

  const secLine = '\\section{درس های متنی }';
  const secSpans = computeBidiSpans(secLine, 'ltr').map((s) => ({
    slice: secLine.slice(s.from, s.to),
    dir: s.dir,
  }));
  assert.deepEqual(secSpans, [{ slice: 'درس های متنی ', dir: 'rtl' }]);
});

test('detectInputScript identifies keyboard language changes from typed input', () => {
  assert.equal(detectInputScript('س'), 'rtl');
  assert.equal(detectInputScript('a'), 'ltr');
  assert.equal(detectInputScript('hello ش'), 'rtl');
  assert.equal(detectInputScript('سلام x'), 'ltr');
  assert.equal(detectInputScript('123'), null);
});
