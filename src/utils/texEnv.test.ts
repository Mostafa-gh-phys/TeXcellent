import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  extractPrimaryTexError,
  inferPreferredCompilerMode,
  normalizeCustomTexPathEntries,
  sanitizeTexChildEnv,
} from './texEnv';

test('sanitizeTexChildEnv strips AppImage mount LD_LIBRARY_PATH and preserves system dirs', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    PATH: '/usr/bin:/bin',
    APPDIR: '/tmp/.mount_TeXcelAbCdEf',
    APPIMAGE: '/home/user/TeXcellent.AppImage',
    LD_LIBRARY_PATH: '/tmp/.mount_TeXcelAbCdEf/usr/lib:/usr/local/lib',
    LD_PRELOAD: '/tmp/.mount_TeXcelAbCdEf/libpreload.so',
  };

  const cleaned = sanitizeTexChildEnv(baseEnv, ['/usr/local/texlive/2026/bin/x86_64-linux'], '/tmp/job1');
  assert.equal(cleaned.APPDIR, undefined);
  assert.equal(cleaned.APPIMAGE, undefined);
  assert.equal(cleaned.LD_PRELOAD, undefined);
  assert.equal(cleaned.LD_LIBRARY_PATH, '/usr/local/lib');
  assert.equal(cleaned.PATH?.startsWith('/usr/local/texlive/2026/bin/x86_64-linux'), true);
  assert.equal(cleaned.TEXINPUTS?.includes(`/tmp/job1${path.sep}${path.sep}`), true);
  assert.equal(cleaned.TEXINPUTS?.endsWith(path.delimiter), true);
});

test('sanitizeTexChildEnv restores APPIMAGE_ORIGINAL_LD_LIBRARY_PATH when set', () => {
  const cleaned = sanitizeTexChildEnv({
    PATH: '/usr/bin',
    APPDIR: '/tmp/.mount_TeXcel123',
    APPIMAGE_ORIGINAL_LD_LIBRARY_PATH: '',
    LD_LIBRARY_PATH: '/tmp/.mount_TeXcel123/usr/lib',
  });
  assert.equal(cleaned.LD_LIBRARY_PATH, undefined);
});

test('normalizeCustomTexPathEntries extracts parent directory from executable file paths', () => {
  assert.deepEqual(normalizeCustomTexPathEntries('/usr/local/texlive/2026/bin/x86_64-linux/xelatex'), [
    '/usr/local/texlive/2026/bin/x86_64-linux',
    '/usr/local/texlive/2026/bin/x86_64-linux/xelatex',
  ]);
  assert.deepEqual(normalizeCustomTexPathEntries('/Library/TeX/texbin'), ['/Library/TeX/texbin']);
});

test('inferPreferredCompilerMode detects xepersian and fontspec requirements', () => {
  assert.equal(
    inferPreferredCompilerMode('\\documentclass{article}\n\\usepackage{xepersian}', 'lualatex'),
    'xelatex'
  );
  assert.equal(
    inferPreferredCompilerMode('% \\usepackage{xepersian}\n\\documentclass{article}', 'lualatex'),
    'lualatex'
  );
  assert.equal(
    inferPreferredCompilerMode('\\documentclass{article}\n\\usepackage{fontspec}', 'pdflatex'),
    'xelatex'
  );
});

test('extractPrimaryTexError surfaces actionable xepersian, fontspec, and missing file errors', () => {
  assert.match(
    extractPrimaryTexError('! Fatal Package xepersian Error: You must run XeTeX.', 'lualatex'),
    /requires XeLaTeX/i
  );
  assert.match(
    extractPrimaryTexError("! LaTeX Error: File `vazir.sty' not found.", 'xelatex'),
    /File `vazir\.sty' not found/
  );
  assert.equal(
    extractPrimaryTexError('main.tex:42: Undefined control sequence.', 'xelatex'),
    'Undefined control sequence.'
  );
});
