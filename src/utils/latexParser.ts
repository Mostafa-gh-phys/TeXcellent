import { CompileLogEntry, CompilerMode, TexDistribution, TexEdition } from '../types/latex';
import { hasRtlChar } from './bidiLatex';

export interface ParsedInlineSegment {
  kind: 'text' | 'bold' | 'italic' | 'code' | 'underline' | 'math' | 'link' | 'lr' | 'rl' | 'ref';
  text: string;
  href?: string;
}

export interface ParsedBlock {
  type:
    | 'section'
    | 'subsection'
    | 'subsubsection'
    | 'paragraph'
    | 'display-math'
    | 'itemize'
    | 'enumerate'
    | 'table'
    | 'theorem'
    | 'code'
    | 'figure'
    | 'frame'
    | 'divider';
  number?: string;
  title?: string;
  rtl: boolean;
  segments?: ParsedInlineSegment[];
  items?: ParsedInlineSegment[][];
  rows?: string[][];
  math?: string;
  caption?: string;
}

export interface ParsedLatexDocument {
  documentClass: string;
  packages: string[];
  title: string;
  author: string;
  date: string;
  hasMaketitle: boolean;
  hasToc: boolean;
  isRtlDocument: boolean;
  blocks: ParsedBlock[];
  labels: Record<string, string>;
}

const BASIC_EDITION_PACKAGES = new Set([
  'amsmath',
  'amssymb',
  'graphicx',
  'hyperref',
  'geometry',
  'xcolor',
  'inputenc',
  'fontenc',
  'babel',
  'booktabs',
  'amsthm',
  'fancyhdr',
]);

function extractBracedArg(src: string, startAfterCmd: number): { value: string; end: number } | null {
  let i = startAfterCmd;
  while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n')) i++;
  // Skip optional [...]
  if (src[i] === '[') {
    let depth = 1;
    i++;
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth++;
      else if (src[i] === ']') depth--;
      i++;
    }
    while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n')) i++;
  }
  if (src[i] !== '{') return null;
  let depth = 1;
  i++;
  const start = i;
  while (i < src.length && depth > 0) {
    if (src[i] === '{' && src[i - 1] !== '\\') depth++;
    else if (src[i] === '}' && src[i - 1] !== '\\') depth--;
    i++;
  }
  return { value: src.slice(start, i - 1), end: i };
}

export function parseInlineSegments(text: string, labels: Record<string, string> = {}): ParsedInlineSegment[] {
  const segments: ParsedInlineSegment[] = [];
  let i = 0;

  const pushText = (t: string) => {
    if (!t) return;
    const cleaned = t
      .replace(/\\today\b/g, 'November 15, 2026')
      .replace(/\\\\/g, '\n')
      .replace(/~/g, ' ')
      .replace(/---/g, '—')
      .replace(/--/g, '–')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\_/g, '_');
    segments.push({ kind: 'text', text: cleaned });
  };

  while (i < text.length) {
    // Inline math $...$
    if (text[i] === '$' && text[i - 1] !== '\\') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        segments.push({ kind: 'math', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Inline math \(...\)
    if (text.startsWith('\\(', i)) {
      const end = text.indexOf('\\)', i + 2);
      if (end !== -1) {
        segments.push({ kind: 'math', text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    // Inline commands
    if (text[i] === '\\') {
      const cmdMatch = text.slice(i).match(/^\\([a-zA-Z]+)/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        const afterCmd = i + cmdMatch[0].length;
        if (cmd === 'textbf' || cmd === 'textbf*' || cmd === 'bf') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'bold', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'textit' || cmd === 'emph') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'italic', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'texttt') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'code', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'underline') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'underline', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'lr') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'lr', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'rl') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'rl', text: arg.value });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'ref' || cmd === 'eqref') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            const resolved = labels[arg.value] || '?';
            segments.push({
              kind: 'ref',
              text: cmd === 'eqref' ? `(${resolved})` : resolved,
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'cite' || cmd === 'parencite' || cmd === 'textcite') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({ kind: 'ref', text: `[${arg.value}]` });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'href') {
          const urlArg = extractBracedArg(text, afterCmd);
          if (urlArg) {
            const labelArg = extractBracedArg(text, urlArg.end);
            if (labelArg) {
              segments.push({ kind: 'link', text: labelArg.value, href: urlArg.value });
              i = labelArg.end;
              continue;
            }
          }
        }
        if (cmd === 'url') {
          const urlArg = extractBracedArg(text, afterCmd);
          if (urlArg) {
            segments.push({ kind: 'link', text: urlArg.value, href: urlArg.value });
            i = urlArg.end;
            continue;
          }
        }
      }
    }

    // Consume plain text until next $ or \
    let next = i + 1;
    while (next < text.length && text[next] !== '$' && text[next] !== '\\') {
      next++;
    }
    pushText(text.slice(i, next));
    i = next;
  }

  return segments;
}

export function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

export function parseLatexDocument(source: string): ParsedLatexDocument {
  const clean = stripComments(source);
  const classMatch = clean.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
  const documentClass = classMatch?.[1]?.trim() || 'article';

  const packages: string[] = [];
  const pkgRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let pm: RegExpExecArray | null;
  while ((pm = pkgRegex.exec(clean)) !== null) {
    pm[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((p) => packages.push(p));
  }

  const titleMatch = clean.match(/\\title\{([^}]*)\}/);
  const authorMatch = clean.match(/\\author\{([^}]*)\}/);
  const dateMatch = clean.match(/\\date\{([^}]*)\}/);
  const title = titleMatch?.[1]?.trim() || '';
  const author = authorMatch?.[1]?.trim() || '';
  const date = (dateMatch?.[1]?.trim() || '\\today').replace(/\\today/g, 'November 15, 2026');

  const isRtlDocument =
    packages.includes('xepersian') ||
    /\\setdefaultlanguage\{persian\}|\\setdefaultlanguage\{arabic\}/.test(clean) ||
    hasRtlChar(title);

  // Extract body
  const beginDoc = clean.indexOf('\\begin{document}');
  const endDoc = clean.lastIndexOf('\\end{document}');
  const body =
    beginDoc !== -1
      ? clean.slice(beginDoc + '\\begin{document}'.length, endDoc !== -1 ? endDoc : clean.length)
      : clean;

  const hasMaketitle = /\\maketitle\b/.test(body);
  const hasToc = /\\tableofcontents\b/.test(body);

  const labels: Record<string, string> = {};
  const blocks: ParsedBlock[] = [];

  let secCount = 0;
  let subCount = 0;
  let subsubCount = 0;
  let thmCount = 0;

  // Tokenize body into logical chunks
  let pos = 0;
  while (pos < body.length) {
    // Skip whitespace
    while (pos < body.length && /\s/.test(body[pos])) pos++;
    if (pos >= body.length) break;

    // Display math $$...$$
    if (body.startsWith('$$', pos)) {
      const end = body.indexOf('$$', pos + 2);
      if (end !== -1) {
        blocks.push({
          type: 'display-math',
          math: body.slice(pos + 2, end).trim(),
          rtl: false,
        });
        pos = end + 2;
        continue;
      }
    }

    // Display math \[...\]
    if (body.startsWith('\\[', pos)) {
      const end = body.indexOf('\\]', pos + 2);
      if (end !== -1) {
        blocks.push({
          type: 'display-math',
          math: body.slice(pos + 2, end).trim(),
          rtl: false,
        });
        pos = end + 2;
        continue;
      }
    }

    // Check block commands & environments
    if (body.startsWith('\\maketitle', pos) || body.startsWith('\\tableofcontents', pos)) {
      pos += body.startsWith('\\maketitle', pos) ? 10 : 16;
      continue;
    }

    if (body.startsWith('\\newpage', pos)) {
      blocks.push({ type: 'divider', rtl: false });
      pos += 8;
      continue;
    }

    // Sections
    const secMatch = body.slice(pos).match(/^\\(section|subsection|subsubsection)(\*?)/);
    if (secMatch) {
      const arg = extractBracedArg(body, pos + secMatch[0].length);
      if (arg) {
        const starred = secMatch[2] === '*';
        let num = '';
        if (!starred) {
          if (secMatch[1] === 'section') {
            secCount++;
            subCount = 0;
            subsubCount = 0;
            num = `${secCount}`;
          } else if (secMatch[1] === 'subsection') {
            subCount++;
            subsubCount = 0;
            num = `${secCount}.${subCount}`;
          } else {
            subsubCount++;
            num = `${secCount}.${subCount}.${subsubCount}`;
          }
        }
        blocks.push({
          type: secMatch[1] as 'section' | 'subsection' | 'subsubsection',
          number: num || undefined,
          title: arg.value,
          rtl: hasRtlChar(arg.value) || isRtlDocument,
        });
        pos = arg.end;
        // Check immediate \label{...}
        const labelAhead = body.slice(pos).match(/^\s*\\label\{([^}]+)\}/);
        if (labelAhead && num) {
          labels[labelAhead[1].trim()] = num;
          pos += labelAhead[0].length;
        }
        continue;
      }
    }

    // Environments \begin{...}...\end{...}
    const envStart = body.slice(pos).match(/^\\begin\{([a-zA-Z0-9_*]+)\}/);
    if (envStart) {
      const envName = envStart[1];
      const endTag = `\\end{${envName}}`;
      const endIdx = body.indexOf(endTag, pos + envStart[0].length);
      if (endIdx !== -1) {
        const inner = body.slice(pos + envStart[0].length, endIdx).trim();
        pos = endIdx + endTag.length;

        if (envName === 'equation' || envName === 'equation*' || envName === 'align' || envName === 'align*' || envName === 'gather') {
          const cleanMath = inner.replace(/\\label\{([^}]+)\}/g, (_, lbl) => {
            labels[lbl.trim()] = `${blocks.filter((b) => b.type === 'display-math').length + 1}`;
            return '';
          });
          blocks.push({
            type: 'display-math',
            math: envName.startsWith('align') ? `\\begin{aligned}\n${cleanMath}\n\\end{aligned}` : cleanMath.trim(),
            rtl: false,
          });
          continue;
        }

        if (envName === 'itemize' || envName === 'enumerate') {
          const rawItems = inner
            .split(/\\item\b/)
            .map((s) => s.trim())
            .filter(Boolean);
          blocks.push({
            type: envName,
            items: rawItems.map((it) => parseInlineSegments(it, labels)),
            rtl: rawItems.some((it) => hasRtlChar(it)) || isRtlDocument,
          });
          continue;
        }

        if (envName === 'table' || envName === 'tabular') {
          const captionMatch = inner.match(/\\caption\{([^}]+)\}/);
          const tabBodyMatch =
            envName === 'table'
              ? inner.match(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/)
              : [null, inner];
          const tabContent = (tabBodyMatch?.[1] || inner)
            .replace(/\\(toprule|midrule|bottomrule|hline)\b/g, '')
            .trim();
          const rows = tabContent
            .split(/\\\\/)
            .map((r) => r.trim())
            .filter(Boolean)
            .map((r) => r.split('&').map((c) => c.trim()));
          blocks.push({
            type: 'table',
            caption: captionMatch?.[1],
            rows,
            rtl: isRtlDocument && !/\\begin\{latin\}/.test(inner),
          });
          continue;
        }

        if (envName === 'figure') {
          const captionMatch = inner.match(/\\caption\{([^}]+)\}/);
          const imgMatch = inner.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
          blocks.push({
            type: 'figure',
            caption: captionMatch?.[1] || imgMatch?.[1] || 'Figure',
            title: imgMatch?.[1] || 'graphic',
            rtl: hasRtlChar(captionMatch?.[1] || '') || isRtlDocument,
          });
          continue;
        }

        if (envName === 'theorem' || envName === 'lemma' || envName === 'proof' || envName === 'tcolorbox') {
          thmCount++;
          blocks.push({
            type: 'theorem',
            title: envName === 'proof' ? (isRtlDocument ? 'اثبات' : 'Proof') : `${envName.charAt(0).toUpperCase() + envName.slice(1)} ${thmCount}`,
            segments: parseInlineSegments(inner, labels),
            rtl: hasRtlChar(inner) || isRtlDocument,
          });
          continue;
        }

        if (envName === 'lstlisting' || envName === 'verbatim') {
          blocks.push({
            type: 'code',
            title: inner.replace(/^\[[^\]]*\]/, '').trim(),
            rtl: false,
          });
          continue;
        }

        if (envName === 'latin' || envName === 'persian') {
          const innerRtl = envName === 'persian';
          blocks.push({
            type: 'paragraph',
            segments: parseInlineSegments(inner, labels),
            rtl: innerRtl,
          });
          continue;
        }

        if (envName === 'frame') {
          const frameTitle = inner.match(/^\{([^}]+)\}/)?.[1] || 'Slide';
          const frameBody = inner.replace(/^\{[^}]+\}/, '').trim();
          blocks.push({
            type: 'frame',
            title: frameTitle,
            segments: parseInlineSegments(frameBody, labels),
            rtl: hasRtlChar(frameTitle + frameBody) || isRtlDocument,
          });
          continue;
        }

        // Generic environment text fallback
        blocks.push({
          type: 'paragraph',
          segments: parseInlineSegments(inner, labels),
          rtl: hasRtlChar(inner) || isRtlDocument,
        });
        continue;
      }
    }

    // Consume paragraph until blank line or next block command
    const nextBlockRegex = /\n\s*\n|\\(section|subsection|subsubsection|begin|newpage|maketitle|tableofcontents)\b|\$\$|\\\[/;
    const rest = body.slice(pos);
    const match = rest.match(nextBlockRegex);
    let endOffset = match && match.index !== undefined && match.index > 0 ? match.index : rest.length;
    if (match && match.index === 0) {
      // Avoid infinite loop on unhandled commands
      const newline = rest.indexOf('\n');
      endOffset = newline !== -1 ? newline + 1 : rest.length;
    }
    const paraRaw = rest.slice(0, endOffset).trim();
    pos += endOffset;

    if (paraRaw && !/^\\(label|vspace|hspace|noindent|centering)\b/.test(paraRaw)) {
      const cleanedPara = paraRaw.replace(/\n+/g, ' ');
      blocks.push({
        type: 'paragraph',
        segments: parseInlineSegments(cleanedPara, labels),
        rtl: hasRtlChar(cleanedPara) || (isRtlDocument && !/^\\lr\{/.test(cleanedPara)),
      });
    }
  }

  return {
    documentClass,
    packages,
    title,
    author,
    date,
    hasMaketitle,
    hasToc,
    isRtlDocument,
    blocks,
    labels,
  };
}

/**
 * Validates LaTeX source against the chosen compiler mode, distribution, and edition.
 */
export function validateLatexBuild(
  source: string,
  mode: CompilerMode,
  distribution?: TexDistribution,
  edition?: TexEdition
): CompileLogEntry[] {
  const diagnostics: CompileLogEntry[] = [];
  const parsed = parseLatexDocument(source);
  const lines = source.split('\n');

  // 1. Check document structure
  if (!/\\documentclass/.test(source)) {
    diagnostics.push({
      level: 'error',
      line: 1,
      message: 'Missing \\documentclass{...} declaration.',
    });
  }
  if (!/\\begin\{document\}/.test(source)) {
    diagnostics.push({
      level: 'error',
      line: 1,
      message: 'Missing \\begin{document}.',
    });
  }
  if (!/\\end\{document\}/.test(source)) {
    diagnostics.push({
      level: 'error',
      line: lines.length,
      message: 'Missing \\end{document}.',
    });
  }

  // 2. Engine compatibility checks
  if ((parsed.packages.includes('xepersian') || parsed.packages.includes('fontspec')) && (mode === 'pdflatex' || mode === 'latex')) {
    diagnostics.push({
      level: 'error',
      message: `Package '${parsed.packages.includes('xepersian') ? 'xepersian' : 'fontspec'}' requires XeLaTeX or LuaLaTeX (currently using ${mode}).`,
    });
  }

  if (parsed.packages.includes('xepersian') && mode === 'lualatex') {
    diagnostics.push({
      level: 'warning',
      message: 'xepersian is officially designed for XeLaTeX; consider switching mode to XeLaTeX for full Kashida & bidi support.',
    });
  }

  // 3. Edition package checks when explicitly passed
  if (edition === 'basic' && distribution) {
    for (const pkg of parsed.packages) {
      if (!BASIC_EDITION_PACKAGES.has(pkg)) {
        diagnostics.push({
          level: 'warning',
          message: `${distribution.startsWith('miktex') ? 'MiKTeX' : 'TeX Live'} Basic edition: package '${pkg}' is not pre-installed in Basic scheme; on-the-fly resolution or Medium/Full edition recommended.`,
        });
      }
    }
  }

  // 4. Brace balance check
  let braceDepth = 0;
  lines.forEach((line, idx) => {
    const cleanLine = stripComments(line);
    for (let i = 0; i < cleanLine.length; i++) {
      if (cleanLine[i] === '{' && cleanLine[i - 1] !== '\\') braceDepth++;
      if (cleanLine[i] === '}' && cleanLine[i - 1] !== '\\') {
        braceDepth--;
        if (braceDepth < 0) {
          diagnostics.push({
            level: 'error',
            line: idx + 1,
            message: `Unexpected closing brace '}' on line ${idx + 1}.`,
          });
          braceDepth = 0;
        }
      }
    }
  });
  if (braceDepth > 0) {
    diagnostics.push({
      level: 'error',
      line: lines.length,
      message: `${braceDepth} unclosed '{' brace(s) detected before end of file.`,
    });
  }

  // 5. Environment balance check
  const envStack: Array<{ name: string; line: number }> = [];
  lines.forEach((line, idx) => {
    const cleanLine = stripComments(line);
    const regex = /\\(begin|end)\{([a-zA-Z0-9_*]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(cleanLine)) !== null) {
      if (m[1] === 'begin') {
        envStack.push({ name: m[2], line: idx + 1 });
      } else {
        const last = envStack.pop();
        if (!last || last.name !== m[2]) {
          diagnostics.push({
            level: 'error',
            line: idx + 1,
            message: `\\end{${m[2]}} on line ${idx + 1} does not match ${last ? `\\begin{${last.name}} (line ${last.line})` : 'any open environment'}.`,
          });
        }
      }
    }
  });
  for (const unclosed of envStack) {
    diagnostics.push({
      level: 'error',
      line: unclosed.line,
      message: `Environment \\begin{${unclosed.name}} opened on line ${unclosed.line} was never closed.`,
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      level: 'info',
      message: `Compiled cleanly with 0 errors (${mode.toUpperCase()}).`,
    });
  }

  return diagnostics;
}
