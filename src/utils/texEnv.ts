import path from 'node:path';
import type { CompileLogEntry, CompilerMode, OutputFormat } from '../types/latex';

const KNOWN_TEX_BIN_NAMES = new Set([
  'xelatex',
  'pdflatex',
  'lualatex',
  'latex',
  'latexmk',
  'bibtex',
  'biber',
  'kpsewhich',
  'dvipdfmx',
]);

function isAppImageMountValue(value: string, appDir?: string): boolean {
  if (!value) return false;
  if (value.includes('/tmp/.mount_') || value.includes('/.mount_')) return true;
  if (appDir && value.includes(appDir)) return true;
  return false;
}

function filterPathListVar(
  env: NodeJS.ProcessEnv,
  key: string,
  appDir: string
): void {
  const raw = env[key];
  if (!raw) return;
  const cleaned = raw
    .split(path.delimiter)
    .filter((entry) => entry && !isAppImageMountValue(entry, appDir));
  if (cleaned.length > 0) {
    env[key] = cleaned.join(path.delimiter);
  } else {
    delete env[key];
  }
}

/**
 * Builds a clean child-process environment for spawning host TeX binaries
 * (xelatex, lualatex, pdflatex, biber, kpsewhich, dvipdfmx).
 * Crucially strips Electron/AppImage library, fontconfig, XDG, and script-runtime
 * overrides so host TeX engines and XePersian/fontspec locate system fonts & shared libraries cleanly.
 */
export function sanitizeTexChildEnv(
  baseEnv: NodeJS.ProcessEnv,
  extraDirs: Array<string | null | undefined> = [],
  texRootDir?: string | null
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  const appDir = env.APPDIR || '';

  // Restore original LD_LIBRARY_PATH if AppImage saved it, otherwise strip mount dirs
  if (env.APPIMAGE_ORIGINAL_LD_LIBRARY_PATH !== undefined) {
    if (env.APPIMAGE_ORIGINAL_LD_LIBRARY_PATH.trim()) {
      env.LD_LIBRARY_PATH = env.APPIMAGE_ORIGINAL_LD_LIBRARY_PATH;
    } else {
      delete env.LD_LIBRARY_PATH;
    }
  } else if (env.ORIG_LD_LIBRARY_PATH !== undefined) {
    if (env.ORIG_LD_LIBRARY_PATH.trim()) {
      env.LD_LIBRARY_PATH = env.ORIG_LD_LIBRARY_PATH;
    } else {
      delete env.LD_LIBRARY_PATH;
    }
  } else {
    filterPathListVar(env, 'LD_LIBRARY_PATH', appDir);
  }

  for (const listKey of ['XDG_DATA_DIRS', 'XDG_CONFIG_DIRS', 'PERL5LIB', 'PERLLIB', 'PYTHONPATH']) {
    filterPathListVar(env, listKey, appDir);
  }

  for (const key of [
    'LD_PRELOAD',
    'GSETTINGS_SCHEMA_DIR',
    'GTK_PATH',
    'GDK_PIXBUF_MODULEDIR',
    'QT_PLUGIN_PATH',
    'QT_QPA_PLATFORM_PLUGIN_PATH',
    'FONTCONFIG_PATH',
    'FONTCONFIG_FILE',
    'PYTHONHOME',
  ]) {
    const val = env[key];
    if (val && isAppImageMountValue(val, appDir)) {
      delete env[key];
    }
  }

  delete env.APPDIR;
  delete env.APPIMAGE;
  delete env.ARGV0;
  delete env.OWD;

  const validDirs: string[] = [];
  const seen = new Set<string>();
  for (const raw of extraDirs) {
    const trimmed = raw?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      validDirs.push(trimmed);
    }
  }

  const currentPath = env.PATH || '';
  if (validDirs.length > 0) {
    env.PATH = currentPath
      ? `${validDirs.join(path.delimiter)}${path.delimiter}${currentPath}`
      : validDirs.join(path.delimiter);
  }

  if (texRootDir?.trim()) {
    const rootRecursive = `${texRootDir.trim()}${path.sep}${path.sep}`;
    for (const texVar of ['TEXINPUTS', 'BIBINPUTS', 'BSTINPUTS']) {
      const existing = env[texVar]?.trim();
      env[texVar] = existing
        ? `${rootRecursive}${path.delimiter}${existing}${existing.endsWith(path.delimiter) ? '' : path.delimiter}`
        : `${rootRecursive}${path.delimiter}`;
    }
  }

  return env;
}

/**
 * Normalizes a user-provided custom TeX binary or directory path into candidate bin directories.
 * Accepts either a directory ("/usr/local/texlive/2026/bin/x86_64-linux")
 * or a direct binary path ("/usr/bin/xelatex", "C:\\texlive\\2025\\bin\\windows\\xelatex.exe").
 */
export function normalizeCustomTexPathEntries(rawPath?: string | null): string[] {
  const trimmed = rawPath?.trim();
  if (!trimmed) return [];

  const entries: string[] = [];
  const baseName = path.basename(trimmed).toLowerCase().replace(/\.exe$/i, '');
  if (/\.exe$/i.test(trimmed) || KNOWN_TEX_BIN_NAMES.has(baseName)) {
    const parent = path.dirname(trimmed);
    if (parent && parent !== '.' && parent !== trimmed) {
      entries.push(parent);
    }
  }
  entries.push(trimmed);
  return Array.from(new Set(entries));
}

export { inferPreferredCompilerMode } from './compilerArgs';

/**
 * Extracts a clear, actionable primary error message from a TeX compiler log.
 */
export function extractPrimaryTexError(
  combinedLog: string,
  mode: CompilerMode,
  outputFormat: OutputFormat = 'pdf'
): string {
  const xepersianMismatch =
    mode !== 'xelatex' &&
    /xepersian/i.test(combinedLog) &&
    /xetex|xelatex|fatal/i.test(combinedLog);
  if (xepersianMismatch) {
    return `Package xepersian requires XeLaTeX (current mode: ${mode.toUpperCase()}). Switch compiler to XeLaTeX.`;
  }

  const fontspecMismatch =
    (mode === 'pdflatex' || mode === 'latex') &&
    /fontspec|polyglossia|bidi/i.test(combinedLog) &&
    /xetex|luatex|xelatex|lualatex|fatal/i.test(combinedLog);
  if (fontspecMismatch) {
    return `Package fontspec/bidi requires XeLaTeX or LuaLaTeX (current mode: ${mode.toUpperCase()}). Switch compiler to XeLaTeX.`;
  }

  const missingFileMatch = combinedLog.match(/!\s*LaTeX Error:\s*(File `[^']+' not found\.?)/i);
  if (missingFileMatch) {
    return missingFileMatch[1].trim();
  }

  const bangLineMatch = combinedLog.match(/^!\s*(.+)$/m);
  if (bangLineMatch) {
    return bangLineMatch[1].trim();
  }

  const fileLineErrMatch = combinedLog.match(/^[^\s:]+\.tex:\d+:\s*(.+)$/m);
  if (fileLineErrMatch) {
    return fileLineErrMatch[1].trim();
  }

  if (outputFormat !== 'pdf') {
    return `Compiled in ${outputFormat.toUpperCase()} mode without PDF output.`;
  }

  return 'Native compiler halted before producing a PDF file.';
}

/**
 * Parses native TeX engine output (.log / stdout) into structured diagnostics
 * for the Bugs tab (errors & warnings with optional file and line numbers).
 */
export function parseNativeTexDiagnostics(
  combinedLog: string,
  mode: CompilerMode,
  outputFormat: OutputFormat = 'pdf',
  compileOk = true
): CompileLogEntry[] {
  const entries: CompileLogEntry[] = [];
  const seen = new Set<string>();
  const lines = combinedLog.split(/\r?\n/);

  const pushEntry = (entry: CompileLogEntry) => {
    const key = `${entry.level}:${entry.file || ''}:${entry.line || ''}:${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(entry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // 1. -file-line-error format: ./main.tex:42: Undefined control sequence.
    const flMatch = rawLine.match(/^(?:\.\/)?([^\s:]+\.(?:tex|sty|cls|ltx)):(\d+):\s*(.+)$/);
    if (flMatch) {
      pushEntry({
        level: 'error',
        file: path.basename(flMatch[1]),
        line: Number(flMatch[2]),
        message: flMatch[3].trim(),
      });
      continue;
    }

    // 2. Classic ! error line with optional following l.42 line number
    if (rawLine.startsWith('! ')) {
      let msg = rawLine.slice(2).trim();
      let foundLine: number | undefined;
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        const lMatch = lines[j].trim().match(/^l\.(\d+)\b/);
        if (lMatch) {
          foundLine = Number(lMatch[1]);
          break;
        }
      }
      if (/xepersian/i.test(msg) && mode !== 'xelatex') {
        msg = `Package xepersian requires XeLaTeX (current mode: ${mode.toUpperCase()}). ${msg}`;
      }
      pushEntry({
        level: 'error',
        line: foundLine,
        message: msg,
      });
      continue;
    }

    // 3. LaTeX / Package / Class Warnings
    const warnMatch = rawLine.match(
      /^(?:LaTeX|Package\s+[A-Za-z0-9_-]+|Class\s+[A-Za-z0-9_-]+)\s+Warning:\s*(.+)$/i
    );
    if (warnMatch) {
      let fullWarn = rawLine;
      if (
        i + 1 < lines.length &&
        /^\([A-Za-z0-9_-]+\)\s+/.test(lines[i + 1].trim())
      ) {
        fullWarn += ' ' + lines[i + 1].trim().replace(/^\([^)]+\)\s+/, '');
      }
      const lineRef = fullWarn.match(/on input line (\d+)/i);
      pushEntry({
        level: 'warning',
        line: lineRef ? Number(lineRef[1]) : undefined,
        message: fullWarn.trim(),
      });
      continue;
    }

    // 4. Font not found lines emitted by fontspec / xetex
    const fontWarnMatch = rawLine.match(/^(Package fontspec Info|! Package fontspec Error):\s*(.+)$/i);
    if (fontWarnMatch && /cannot be found/i.test(rawLine)) {
      pushEntry({
        level: 'error',
        message: fontWarnMatch[2].trim(),
      });
    }
  }

  if (!compileOk && !entries.some((e) => e.level === 'error')) {
    pushEntry({
      level: 'error',
      message: extractPrimaryTexError(combinedLog, mode, outputFormat),
    });
  }

  return entries.slice(0, 80);
}
