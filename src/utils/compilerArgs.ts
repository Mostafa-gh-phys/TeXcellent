import type {
  BibliographyTool,
  CompilerMode,
  CompilerSettings,
  ProjectFile,
} from '../types/latex';

export const DEFAULT_COMPILER_SETTINGS: CompilerSettings = {
  compilerMode: 'xelatex',
  customBinaryPath: '',
  remoteEndpointUrl: '',
  shellEscape: false,
  synctex: true,
  interactionMode: 'nonstopmode',
  compilePasses: 'auto',
  bibliographyTool: 'auto',
  outputFormat: 'pdf',
  fileLineError: true,
  haltOnError: false,
  extraArgs: '',
  distribution: 'texlive-2025',
  edition: 'full',
};

export function mergeCompilerSettings(
  partial?: Partial<CompilerSettings> | null
): CompilerSettings {
  return {
    ...DEFAULT_COMPILER_SETTINGS,
    ...(partial || {}),
  };
}

export function sanitizeRelativeTeXPath(rawPath: string): string {
  return (
    rawPath
      .replace(/\\/g, '/')
      .split('/')
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && s !== '.' && s !== '..')
      .join('/') || 'main.tex'
  );
}

const ALLOWED_EXTRA_ARG_RE = /^-[a-zA-Z0-9][a-zA-Z0-9=_-]*$/;

export function parseExtraCliArgs(rawExtraArgs?: string): string[] {
  if (!rawExtraArgs?.trim()) return [];
  return rawExtraArgs
    .trim()
    .split(/\s+/)
    .filter((token) => ALLOWED_EXTRA_ARG_RE.test(token));
}

export function buildCompilerCliArgs(
  mode: CompilerMode,
  mainFileName: string,
  settings: Partial<CompilerSettings> = {},
  sourceHint = ''
): string[] {
  const cfg = mergeCompilerSettings(settings);
  const safeMain = sanitizeRelativeTeXPath(mainFileName);
  const extraFlags = parseExtraCliArgs(cfg.extraArgs);

  if (mode === 'latexmk') {
    const hasEngineFlag = extraFlags.some((flag) =>
      /^-(pdf|xelatex|lualatex|dvi|ps|pdflatex)$/.test(flag)
    );
    const engineFlag = hasEngineFlag
      ? null
      : /\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:xepersian|fontspec|polyglossia)\b[^}]*\}/i.test(
            sourceHint
          )
        ? '-xelatex'
        : /\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:luacode|luatexja)\b[^}]*\}/i.test(sourceHint)
          ? '-lualatex'
          : '-pdf';

    const args = engineFlag
      ? [engineFlag, `-interaction=${cfg.interactionMode}`]
      : [`-interaction=${cfg.interactionMode}`];
    if (cfg.fileLineError) args.push('-file-line-error');
    if (cfg.haltOnError) args.push('-halt-on-error');
    if (cfg.synctex) args.push('-synctex=1');
    if (cfg.shellEscape) args.push('-shell-escape');
    args.push(...extraFlags);
    args.push(safeMain);
    return args;
  }

  const args = [`-interaction=${cfg.interactionMode}`];
  if (cfg.fileLineError) args.push('-file-line-error');
  if (cfg.haltOnError) args.push('-halt-on-error');
  if (cfg.synctex) args.push('-synctex=1');
  if (cfg.shellEscape) args.push('-shell-escape');

  if (cfg.outputFormat === 'dvi') {
    if (mode === 'pdflatex' || mode === 'lualatex') {
      args.push('-output-format=dvi');
    } else if (mode === 'xelatex') {
      args.push('-no-pdf');
    }
  } else if (cfg.outputFormat === 'draft') {
    if (mode === 'pdflatex' || mode === 'lualatex') {
      args.push('-draftmode');
    } else if (mode === 'xelatex') {
      args.push('-no-pdf');
    }
  }

  args.push(...extraFlags);
  args.push(safeMain);
  return args;
}

export function resolveBibliographyTool(
  source: string,
  files: ProjectFile[],
  preferred: BibliographyTool = 'auto'
): 'none' | 'bibtex' | 'biber' {
  if (preferred === 'none' || preferred === 'bibtex' || preferred === 'biber') {
    return preferred;
  }
  const hasBibFile = files.some((f) => f.name.toLowerCase().endsWith('.bib'));
  const hasBiblatex = /\\usepackage(?:\[[^\]]*\])?\{[^}]*biblatex[^}]*\}/i.test(source);
  const hasBibtexCmd = /\\bibliography\{|\\addbibresource\{|\\cite\{/i.test(source);
  if (!hasBibFile && !hasBibtexCmd && !hasBiblatex) return 'none';
  if (hasBiblatex || /\\addbibresource\{/i.test(source)) return 'biber';
  if (/\\bibliography\{/i.test(source) && hasBibFile) return 'bibtex';
  return 'none';
}

export function resolvePassCount(
  source: string,
  settings: Partial<CompilerSettings> = {},
  bibTool: 'none' | 'bibtex' | 'biber' = 'none'
): number {
  const cfg = mergeCompilerSettings(settings);
  if (cfg.compilerMode === 'latexmk' || cfg.compilePasses === '1') {
    return 1;
  }
  if (cfg.compilePasses === '2') return 2;
  if (cfg.compilePasses === '3') return 3;

  // Auto: run 2 passes if cross-references / TOC / labels or bibliography exist
  if (bibTool !== 'none') return 3;
  if (/\\tableofcontents\b|\\ref\{|\\pageref\{|\\eqref\{|\\listoffigures\b/i.test(source)) {
    return 2;
  }
  return 1;
}

function stripLatexComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^\\])%.*$/, '$1'))
    .join('\n');
}

export function inferPreferredCompilerMode(
  source: string,
  currentMode: CompilerMode = 'xelatex'
): CompilerMode {
  const stripped = stripLatexComments(source || '');
  if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bxepersian\b[^}]*\}/i.test(stripped)) {
    return 'xelatex';
  }
  if (
    (currentMode === 'pdflatex' || currentMode === 'latex') &&
    /\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:fontspec|polyglossia)\b[^}]*\}/i.test(stripped)
  ) {
    return 'xelatex';
  }
  return currentMode;
}
