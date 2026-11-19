import { ParsedLatexDocument } from './latexParser';

export function isInspectableTextArtifact(name: string): boolean {
  return /\.(aux|log|toc|bbl|blg|out|lof|lot|bcf|run\.xml|fls)$/i.test(name);
}

export function formatArtifactSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getArtifactMimeType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.gz')) return 'application/gzip';
  if (lower.endsWith('.xml')) return 'application/xml; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

/**
 * Generates an authentic LaTeX .aux sidecar file summarizing section TOC entries,
 * labels, citation keys, and page count for projects compiled with the built-in typesetter.
 */
export function generateSyntheticAuxContent(
  parsed: ParsedLatexDocument,
  source: string,
  pageCount: number
): string {
  const lines: string[] = [
    '\\relax ',
  ];

  if (parsed.packages.includes('hyperref')) {
    lines.push('\\providecommand\\hyper@newdestlabel[2]{}');
  }

  let pageEstimate = 1;
  let blockCounter = 0;
  for (const block of parsed.blocks) {
    blockCounter++;
    if (block.type === 'section' || block.type === 'subsection' || block.type === 'subsubsection') {
      const levelName = block.type;
      const numPrefix = block.number ? `\\numberline {${block.number}}` : '';
      const safeTitle = (block.title || '').replace(/[{}]/g, '');
      lines.push(
        `\\@writefile{toc}{\\contentsline {${levelName}}{${numPrefix}${safeTitle}}{${pageEstimate}}{}}`
      );
      if (blockCounter % 6 === 0 && pageEstimate < pageCount) {
        pageEstimate++;
      }
    }
  }

  for (const [labelName, labelVal] of Object.entries(parsed.labels || {})) {
    lines.push(`\\newlabel{${labelName}}{{${labelVal}}{${Math.min(pageCount, 1)}}{}{}{}}`);
  }

  const citeKeys = new Set<string>();
  const citeRegex = /\\(?:cite|parencite|textcite|citep|citet)(?:\[[^\]]*\])*\{([^}]+)\}/g;
  let cm: RegExpExecArray | null;
  while ((cm = citeRegex.exec(source)) !== null) {
    cm[1]
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .forEach((k) => citeKeys.add(k));
  }
  let bibIndex = 1;
  for (const key of citeKeys) {
    lines.push(`\\bibcite{${key}}{${bibIndex++}}`);
  }

  lines.push(`\\gdef\\@abspage@last{${Math.max(1, pageCount)}}`);
  return `${lines.join('\n')}\n`;
}
