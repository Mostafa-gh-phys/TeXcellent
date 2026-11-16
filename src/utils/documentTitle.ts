import { ProjectFile } from '../types/latex';

function cleanLatexTitle(raw: string): string {
  return raw
    .replace(/\\(?:textbf|textit|emph|text|lr|rl|textrm|textsf|texttt)\{([^{}]*)\}/g, '$1')
    .replace(/\\\\/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the braced argument of `\title{...}` while skipping comments.
 */
export function extractLatexTitle(source: string): string | null {
  if (!source) return null;
  const lines = source.split(/\r?\n/);
  const stripped = lines
    .map((line) => line.replace(/(^|[^\\])%.*$/, '$1'))
    .join('\n');

  const match = stripped.match(/\\title(?:\[[^\]]*\])?\s*\{/);
  if (!match || match.index === undefined) return null;

  let i = match.index + match[0].length;
  let depth = 1;
  const start = i;
  while (i < stripped.length && depth > 0) {
    if (stripped[i] === '{' && stripped[i - 1] !== '\\') depth++;
    else if (stripped[i] === '}' && stripped[i - 1] !== '\\') depth--;
    i++;
  }
  if (depth !== 0) return null;
  const cleaned = cleanLatexTitle(stripped.slice(start, i - 1));
  return cleaned || null;
}

/**
 * Determine which project file should be compiled & previewed.
 * If the currently active .tex file is a standalone document (\documentclass),
 * compile/preview it directly; otherwise (chapter fragment, .bib, .sty) use the project mainFile.
 */
export function resolveCompileTargetFile(
  activeFile: ProjectFile | undefined,
  mainFile: ProjectFile | undefined,
  files: ProjectFile[]
): ProjectFile | undefined {
  if (
    activeFile &&
    activeFile.language === 'latex' &&
    /\.tex$/i.test(activeFile.name) &&
    /\\documentclass(?:\[[^\]]*\])?\s*\{/i.test(activeFile.content)
  ) {
    return activeFile;
  }
  return mainFile || activeFile || files[0];
}

/**
 * Resolve the dynamic document title shown in the workspace top bar for the active document.
 */
export function resolveDocumentDisplayTitle(
  activeFile: ProjectFile | undefined,
  mainFile: ProjectFile | undefined,
  fallbackProjectName: string
): string {
  if (activeFile && activeFile.language === 'latex') {
    const activeTitle = extractLatexTitle(activeFile.content);
    if (activeTitle) return activeTitle;

    if (
      mainFile &&
      activeFile.id !== mainFile.id &&
      !/\\documentclass\b/i.test(activeFile.content)
    ) {
      const mainTitle = extractLatexTitle(mainFile.content);
      return mainTitle ? `${mainTitle} · ${activeFile.name}` : activeFile.name;
    }

    return activeFile.name;
  }

  if (activeFile) {
    return activeFile.name;
  }

  const mainTitle = mainFile ? extractLatexTitle(mainFile.content) : null;
  return mainTitle || fallbackProjectName || 'Untitled Document';
}
