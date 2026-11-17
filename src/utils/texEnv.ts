import path from 'node:path';
import type { CompilerMode, OutputFormat } from '../types/latex';

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

/**
 * Builds a clean child-process environment for spawning host TeX binaries
 * (xelatex, lualatex, pdflatex, biber, kpsewhich, dvipdfmx).
 * Crucially strips Electron/AppImage LD_LIBRARY_PATH / LD_PRELOAD / APPDIR
 * overrides so host TeX engines link against system libraries cleanly.
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
  } else if (env.LD_LIBRARY_PATH) {
    const cleaned = env.LD_LIBRARY_PATH.split(path.delimiter).filter(
      (entry) => entry && !isAppImageMountValue(entry, appDir)
    );
    if (cleaned.length > 0) {
      env.LD_LIBRARY_PATH = cleaned.join(path.delimiter);
    } else {
      delete env.LD_LIBRARY_PATH;
    }
  }

  for (const key of [
    'LD_PRELOAD',
    'GSETTINGS_SCHEMA_DIR',
    'GTK_PATH',
    'GDK_PIXBUF_MODULEDIR',
    'QT_PLUGIN_PATH',
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
