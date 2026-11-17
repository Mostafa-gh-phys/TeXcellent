import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  extractPrimaryTexError,
  inferPreferredCompilerMode,
  normalizeCustomTexPathEntries,
  parseNativeTexDiagnostics,
  sanitizeTexChildEnv,
} from './texEnv';

test('sanitizeTexChildEnv strips AppImage mount LD_LIBRARY_PATH, Fontconfig, and XDG dirs while preserving system dirs', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    PATH: '/usr/bin:/bin',
    APPDIR: '/tmp/.mount_TeXcelAbCdEf',
    APPIMAGE: '/home/user/TeXcellent.AppImage',
    LD_LIBRARY_PATH: '/tmp/.mount_TeXcelAbCdEf/usr/lib:/usr/local/lib',
    LD_PRELOAD: '/tmp/.mount_TeXcelAbCdEf/libpreload.so',
    FONTCONFIG_PATH: '/tmp/.mount_TeXcelAbCdEf/etc/fonts',
    XDG_DATA_DIRS: '/tmp/.mount_TeXcelAbCdEf/usr/share:/usr/local/share:/usr/share',
  };

  const cleaned = sanitizeTexChildEnv(baseEnv, ['/usr/local/texlive/2026/bin/x86_64-linux'], '/tmp/job1');
  assert.equal(cleaned.APPDIR, undefined);
  assert.equal(cleaned.APPIMAGE, undefined);
  assert.equal(cleaned.LD_PRELOAD, undefined);
  assert.equal(cleaned.FONTCONFIG_PATH, undefined);
  assert.equal(cleaned.XDG_DATA_DIRS, '/usr/local/share:/usr/share');
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

test('parseNativeTexDiagnostics extracts file-line errors and warnings for Bugs tab', () => {
  const sampleLog = [
    './main.tex:18: Undefined control sequence.',
    'LaTeX Warning: Reference `sec:missing` on page 1 undefined on input line 24.',
    '! Package xepersian Error: Please load hyperref before xepersian.',
    'l.7 \\usepackage{hyperref}',
  ].join('\n');

  const diags = parseNativeTexDiagnostics(sampleLog, 'xelatex', 'pdf', false);
  assert.equal(diags.length, 3);
  assert.deepEqual(diags[0], {
    level: 'error',
    file: 'main.tex',
    line: 18,
    message: 'Undefined control sequence.',
  });
  assert.equal(diags[1].level, 'warning');
  assert.equal(diags[1].line, 24);
  assert.equal(diags[2].level, 'error');
  assert.equal(diags[2].line, 7);
});
