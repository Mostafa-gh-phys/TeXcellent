import { ProjectFile } from '../types/latex';

export interface InverseSyncMatch {
  fileId: string;
  fileName: string;
  line: number;
  score: number;
}

const HEADING_RE = /\\(?:part|chapter|section|subsection|subsubsection|paragraph|title|caption)\*?\{/i;

export function normalizeSyncText(text: string): string {
  return text
    .replace(/\u200c/g, ' ') // ZWNJ -> space tolerance
    .replace(/[\u064A\u0649]/g, '\u06CC') // Arabic Yeh -> Persian Yeh
    .replace(/\u0643/g, '\u06A9') // Arabic Kaf -> Persian Kaf
    .replace(/[\u064B-\u065F\u0670]/g, '') // Strip optional Arabic diacritics
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function stripLatexMarkup(line: string): string {
  // Strip unescaped LaTeX comments
  let cleaned = line
    .replace(/(^|[^\\])%.*$/, '$1')
    .replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g, ' ')
    .replace(/\\(?:label|ref|eqref|cite|usepackage|documentclass|pagestyle|bibliography|bibliographystyle|input|include)\b(?:\[[^\]]*\])?\{[^}]*\}/g, ' ');

  const INLINE_CMD_RE = /\\(?:textbf|textit|emph|texttt|textrm|underline|lr|rl|text)\*?\{([^{}]*)\}/g;
  const BLOCK_CMD_RE = /\\(?:section|subsection|subsubsection|chapter|part|title|author|caption)\*?\{([^{}]*)\}/g;

  for (let pass = 0; pass < 3; pass++) {
    const next = cleaned.replace(INLINE_CMD_RE, '$1').replace(BLOCK_CMD_RE, ' $1 ');
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned
    .replace(/\\[a-zA-Z@]+\*?/g, ' ')
    .replace(/[{}$$\[\]\\~&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findSourceLineForPdfText(
  clickedText: string,
  files: ProjectFile[],
  activeFileId?: string
): InverseSyncMatch | null {
  const normQuery = normalizeSyncText(clickedText);
  if (!normQuery || normQuery.length < 2) return null;

  const queryTokens = normQuery.split(' ').filter((t) => t.length >= 2);
  let best: InverseSyncMatch | null = null;

  for (const file of files) {
    if (file.language === 'asset' || !/\.(tex|ltx|sty|cls)$/i.test(file.name)) continue;
    const lines = file.content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const stripped = normalizeSyncText(stripLatexMarkup(rawLine));
      if (!stripped) continue;

      let score = 0;
      if (normQuery.length >= 4 && stripped.includes(normQuery)) {
        score += 120 + normQuery.length;
      } else if (stripped.length >= 4 && normQuery.includes(stripped)) {
        score += 90 + stripped.length;
      }

      if (queryTokens.length > 0) {
        let matched = 0;
        for (const tok of queryTokens) {
          if (stripped.includes(tok)) matched += 1;
        }
        if (matched > 0) {
          score += (matched / queryTokens.length) * 60 + matched * 8;
        }
      }

      if (score <= 0) continue;

      if (HEADING_RE.test(rawLine)) score += 12;
      if (file.id === activeFileId) score += 6;

      if (!best || score > best.score) {
        best = {
          fileId: file.id,
          fileName: file.name,
          line: i + 1,
          score,
        };
      }
    }
  }

  return best && best.score >= 25 ? best : null;
}

export function findSearchExcerptForSourceLine(sourceContent: string, lineNumber: number): string {
  const lines = sourceContent.split(/\r?\n/);
  if (lines.length === 0) return '';

  const startIdx = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
  const candidateOffsets = [0, 1, -1, 2, -2, 3, -3];

  for (const offset of candidateOffsets) {
    const idx = startIdx + offset;
    if (idx < 0 || idx >= lines.length) continue;
    const stripped = stripLatexMarkup(lines[idx]);
    const clean = stripped.replace(/\s+/g, ' ').trim();
    if (clean.length >= 3) {
      const words = clean.split(' ').filter(Boolean);
      return words.slice(0, 6).join(' ');
    }
  }

  return '';
}

export function clampPageNumber(page: number, numPages: number): number {
  if (!Number.isFinite(numPages) || numPages <= 0) return 1;
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(numPages), Math.floor(page));
}

export function computeNextZoom(
  currentZoom: number,
  delta: number,
  minZoom = 50,
  maxZoom = 250
): number {
  return Math.min(maxZoom, Math.max(minZoom, Math.round(currentZoom + delta)));
}

export function computeFitWidthScale(
  containerWidth: number,
  unscaledPageWidth: number,
  paddingPx = 32
): number {
  if (!Number.isFinite(containerWidth) || !Number.isFinite(unscaledPageWidth) || unscaledPageWidth <= 0) {
    return 1;
  }
  const availableWidth = Math.max(240, containerWidth - paddingPx);
  return Math.min(2.4, Math.max(0.45, availableWidth / unscaledPageWidth));
}

export function computeOptimalDprScale(
  dpr: number,
  cssWidth: number,
  cssHeight: number,
  maxDimension = 4096,
  maxPixels = 12_000_000
): number {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  let scale = Math.min(3, Math.max(2, safeDpr * 1.75));
  const safeW = Math.max(1, cssWidth);
  const safeH = Math.max(1, cssHeight);

  if (safeW * scale > maxDimension || safeH * scale > maxDimension) {
    scale = Math.min(scale, maxDimension / Math.max(safeW, safeH));
  }
  if (safeW * safeH * scale * scale > maxPixels) {
    scale = Math.min(scale, Math.sqrt(maxPixels / (safeW * safeH)));
  }
  return Math.max(1, Number(scale.toFixed(2)));
}
