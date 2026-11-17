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

function extractNamedCommandArg(src: string, cmdName: string): string | null {
  const escaped = cmdName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\\\${escaped}(?=[^a-zA-Z]|$)`);
  const m = re.exec(src);
  if (!m) return null;
  const arg = extractBracedArg(src, m.index + m[0].length);
  return arg ? arg.value.trim() : null;
}

export function stripInlineLatexFormatting(text: string, labels: Record<string, string> = {}): string {
  if (!text) return '';
  return parseInlineSegments(text, labels)
    .map((s) => s.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inlineProjectInputs(
  mainContent: string,
  files: Array<{ name: string; content: string }>,
  depth = 0
): string {
  if (depth > 4 || files.length === 0) return mainContent;
  return mainContent.replace(/\\(?:input|include)\{([^}]+)\}/g, (full, rawTarget: string) => {
    const clean = rawTarget.trim().replace(/^\.\//, '');
    const withExt = clean.endsWith('.tex') ? clean : `${clean}.tex`;
    const match = files.find((f) => {
      const n = f.name.replace(/^\.\//, '');
      return n === clean || n === withExt || n.endsWith(`/${clean}`) || n.endsWith(`/${withExt}`);
    });
    if (!match) return full;
    return inlineProjectInputs(match.content, files, depth + 1);
  });
}

function getFormattedToday(isRtl: boolean): string {
  try {
    return new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function parseInlineSegments(
  text: string,
  labels: Record<string, string> = {},
  isRtlToday = false
): ParsedInlineSegment[] {
  const segments: ParsedInlineSegment[] = [];
  let i = 0;

  const pushText = (t: string) => {
    if (!t) return;
    const todayStr = getFormattedToday(isRtlToday);
    const cleaned = t
      .replace(/\\(?:today|PersianToday|latintoday)\b/g, todayStr)
      .replace(/\\\\/g, '\n')
      .replace(/~/g, ' ')
      .replace(/---/g, '—')
      .replace(/--/g, '–')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\_/g, '_')
      .replace(/\\\$/g, '$')
      .replace(/\\#/g, '#');
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
            segments.push({
              kind: 'bold',
              text: stripInlineLatexFormatting(arg.value, labels),
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'textit' || cmd === 'emph') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({
              kind: 'italic',
              text: stripInlineLatexFormatting(arg.value, labels),
            });
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
            segments.push({
              kind: 'underline',
              text: stripInlineLatexFormatting(arg.value, labels),
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'lr' || cmd === 'textlatin' || cmd === 'LTR') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({
              kind: 'lr',
              text: stripInlineLatexFormatting(arg.value, labels),
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'rl' || cmd === 'textpersian' || cmd === 'RTL') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({
              kind: 'rl',
              text: stripInlineLatexFormatting(arg.value, labels),
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'textcolor') {
          const colorArg = extractBracedArg(text, afterCmd);
          if (colorArg) {
            const innerArg = extractBracedArg(text, colorArg.end);
            if (innerArg) {
              segments.push({
                kind: 'text',
                text: stripInlineLatexFormatting(innerArg.value, labels),
              });
              i = innerArg.end;
              continue;
            }
          }
        }
        if (cmd === 'footnote' || cmd === 'LTRfootnote' || cmd === 'RTLfootnote') {
          const arg = extractBracedArg(text, afterCmd);
          if (arg) {
            segments.push({
              kind: 'text',
              text: ` (${stripInlineLatexFormatting(arg.value, labels)})`,
            });
            i = arg.end;
            continue;
          }
        }
        if (cmd === 'ref' || cmd === 'eqref' || cmd === 'pageref') {
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
        if (cmd === 'cite' || cmd === 'parencite' || cmd === 'textcite' || cmd === 'citep' || cmd === 'citet') {
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
              segments.push({
                kind: 'link',
                text: stripInlineLatexFormatting(labelArg.value, labels),
                href: urlArg.value,
              });
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
        if (
          cmd === 'KashidaOn' ||
          cmd === 'KashidaOff' ||
          cmd === 'DefaultMathsDigits' ||
          cmd === 'AutoMathsDigits' ||
          cmd === 'PersianDigits' ||
          cmd === 'LatinDigits' ||
          cmd === 'noindent' ||
          cmd === 'centering'
        ) {
          i = afterCmd;
          continue;
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

  const rawTitle = extractNamedCommandArg(clean, 'title') || '';
  const rawAuthor = extractNamedCommandArg(clean, 'author') || '';
  const rawDate = extractNamedCommandArg(clean, 'date') || '\\today';

  const isRtlDocument =
    packages.includes('xepersian') ||
    /\\setdefaultlanguage\{persian\}|\\setdefaultlanguage\{arabic\}/.test(clean) ||
    hasRtlChar(rawTitle);

  const title = stripInlineLatexFormatting(rawTitle);
  const author = stripInlineLatexFormatting(rawAuthor.replace(/\\and\b/g, ' & '));
  const date = stripInlineLatexFormatting(
    rawDate.replace(/\\(?:today|PersianToday|latintoday)\b/g, getFormattedToday(isRtlDocument))
  );

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
    if (
      body.startsWith('\\maketitle', pos) ||
      body.startsWith('\\tableofcontents', pos) ||
      body.startsWith('\\listoffigures', pos) ||
      body.startsWith('\\listoftables', pos) ||
      body.startsWith('\\printbibliography', pos)
    ) {
      const m = body.slice(pos).match(/^\\[a-zA-Z]+/);
      pos += m ? m[0].length : 10;
      continue;
    }

    if (
      body.startsWith('\\newpage', pos) ||
      body.startsWith('\\clearpage', pos) ||
      body.startsWith('\\pagebreak', pos)
    ) {
      const m = body.slice(pos).match(/^\\[a-zA-Z]+/);
      blocks.push({ type: 'divider', rtl: false });
      pos += m ? m[0].length : 8;
      continue;
    }

    // Sections / Chapters / Parts
    const secMatch = body.slice(pos).match(/^\\(part|chapter|section|subsection|subsubsection|paragraph)(\*?)/);
    if (secMatch) {
      const arg = extractBracedArg(body, pos + secMatch[0].length);
      if (arg) {
        const starred = secMatch[2] === '*';
        const kind = secMatch[1];
        let num = '';
        if (!starred) {
          if (kind === 'chapter' || kind === 'section') {
            secCount++;
            subCount = 0;
            subsubCount = 0;
            num = `${secCount}`;
          } else if (kind === 'subsection') {
            subCount++;
            subsubCount = 0;
            num = `${secCount}.${subCount}`;
          } else if (kind === 'subsubsection') {
            subsubCount++;
            num = `${secCount}.${subCount}.${subsubCount}`;
          }
        }
        const blockType =
          kind === 'part' || kind === 'chapter' || kind === 'section'
            ? 'section'
            : kind === 'subsection'
              ? 'subsection'
              : 'subsubsection';
        const cleanTitle = stripInlineLatexFormatting(arg.value, labels);
        blocks.push({
          type: blockType,
          number: num || undefined,
          title: cleanTitle,
          rtl: hasRtlChar(cleanTitle) || isRtlDocument,
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

        if (
          envName === 'equation' ||
          envName === 'equation*' ||
          envName === 'align' ||
          envName === 'align*' ||
          envName === 'gather' ||
          envName === 'gather*' ||
          envName === 'multline' ||
          envName === 'multline*'
        ) {
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
            .split(/\\item(?:\[[^\]]*\])?\b/)
            .map((s) => s.trim())
            .filter(Boolean);
          blocks.push({
            type: envName,
            items: rawItems.map((it) => parseInlineSegments(it, labels, isRtlDocument)),
            rtl: rawItems.some((it) => hasRtlChar(it)) || isRtlDocument,
          });
          continue;
        }

        if (envName === 'table' || envName === 'tabular' || envName === 'longtable') {
          const captionVal = extractNamedCommandArg(inner, 'caption');
          const tabBodyMatch =
            envName === 'table'
              ? inner.match(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/)
              : [null, inner];
          const tabContent = (tabBodyMatch?.[1] || inner)
            .replace(/\\(toprule|midrule|bottomrule|hline|cline\{[^}]*\})\b/g, '')
            .trim();
          const rows = tabContent
            .split(/\\\\/)
            .map((r) => r.trim())
            .filter(Boolean)
            .map((r) =>
              r
                .split('&')
                .map((c) => stripInlineLatexFormatting(c.replace(/^\$|\$$/g, ''), labels))
            );
          blocks.push({
            type: 'table',
            caption: captionVal ? stripInlineLatexFormatting(captionVal, labels) : undefined,
            rows,
            rtl: isRtlDocument && !/\\begin\{latin\}/.test(inner),
          });
          continue;
        }

        if (envName === 'figure') {
          const captionVal = extractNamedCommandArg(inner, 'caption');
          const imgMatch = inner.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
          const cleanCap = captionVal ? stripInlineLatexFormatting(captionVal, labels) : undefined;
          blocks.push({
            type: 'figure',
            caption: cleanCap || imgMatch?.[1] || 'Figure',
            title: imgMatch?.[1] || 'graphic',
            rtl: hasRtlChar(cleanCap || '') || isRtlDocument,
          });
          continue;
        }

        if (
          envName === 'theorem' ||
          envName === 'lemma' ||
          envName === 'proof' ||
          envName === 'definition' ||
          envName === 'corollary' ||
          envName === 'proposition' ||
          envName === 'remark' ||
          envName === 'example' ||
          envName === 'tcolorbox'
        ) {
          thmCount++;
          const rtlBlock = hasRtlChar(inner) || isRtlDocument;
          blocks.push({
            type: 'theorem',
            title:
              envName === 'proof'
                ? rtlBlock
                  ? 'اثبات'
                  : 'Proof'
                : `${envName.charAt(0).toUpperCase() + envName.slice(1)} ${thmCount}`,
            segments: parseInlineSegments(inner, labels, isRtlDocument),
            rtl: rtlBlock,
          });
          continue;
        }

        if (envName === 'lstlisting' || envName === 'verbatim' || envName === 'minted') {
          blocks.push({
            type: 'code',
            title: inner.replace(/^\[[^\]]*\]/, '').trim(),
            rtl: false,
          });
          continue;
        }

        if (envName === 'latin' || envName === 'persian') {
          const innerRtl = envName === 'persian';
          const subDoc = parseLatexDocument(`\\begin{document}\n${inner}\n\\end{document}`);
          for (const subBlock of subDoc.blocks) {
            blocks.push({ ...subBlock, rtl: innerRtl });
          }
          continue;
        }

        if (envName === 'frame') {
          const frameTitle = inner.match(/^\{([^}]+)\}/)?.[1] || 'Slide';
          const frameBody = inner.replace(/^\{[^}]+\}/, '').trim();
          blocks.push({
            type: 'frame',
            title: stripInlineLatexFormatting(frameTitle, labels),
            segments: parseInlineSegments(frameBody, labels, isRtlDocument),
            rtl: hasRtlChar(frameTitle + frameBody) || isRtlDocument,
          });
          continue;
        }

        // Generic environment text fallback
        blocks.push({
          type: 'paragraph',
          segments: parseInlineSegments(inner, labels, isRtlDocument),
          rtl: hasRtlChar(inner) || isRtlDocument,
        });
        continue;
      }
    }

    // Consume paragraph until blank line or next block command
    const nextBlockRegex = /\n\s*\n|\\(part|chapter|section|subsection|subsubsection|paragraph|begin|newpage|clearpage|pagebreak|maketitle|tableofcontents)\b|\$\$|\\\[/;
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

    const isPureSetupDirective =
      /^\\(?:label|vspace|hspace|noindent|centering|vfill|hfill|smallskip|medskip|bigskip|KashidaOn|KashidaOff|DefaultMathsDigits|AutoMathsDigits|PersianDigits|LatinDigits|persiandate|latindate|settextfont|setlatintextfont|setdigitfont|setmathsdigitfont|defpersianfont|deflatinfont|SepMark|bibliographystyle|bibliography|addbibresource|pagestyle|thispagestyle|newtheorem|newcommand|renewcommand|hypersetup)\b/.test(
        paraRaw
      );

    if (paraRaw && !isPureSetupDirective) {
      const cleanedPara = paraRaw.replace(/\n+/g, ' ');
      blocks.push({
        type: 'paragraph',
        segments: parseInlineSegments(cleanedPara, labels, isRtlDocument),
        rtl: hasRtlChar(cleanedPara) || (isRtlDocument && !/^\\(?:lr|textlatin)\{/.test(cleanedPara)),
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

  // 2b. Check xepersian package load-order rule (xepersian must be loaded last after hyperref, amsmath, tikz, etc.)
  const cleanSource = stripComments(source);
  const xeIdx = cleanSource.search(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bxepersian\b[^}]*\}/);
  if (xeIdx !== -1) {
    const lineOfXe = source.slice(0, xeIdx).split('\n').length;
    const mustPrecede = [
      'amsmath',
      'amssymb',
      'amsthm',
      'booktabs',
      'geometry',
      'graphicx',
      'hyperref',
      'tikz',
      'pgfplots',
      'xcolor',
      'listings',
      'tcolorbox',
      'biblatex',
    ];
    const pkgCallRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let mPkg: RegExpExecArray | null;
    while ((mPkg = pkgCallRegex.exec(cleanSource)) !== null) {
      if (mPkg.index > xeIdx) {
        const laterPkgs = mPkg[1]
          .split(',')
          .map((s) => s.trim())
          .filter((p) => mustPrecede.includes(p));
        if (laterPkgs.length > 0) {
          const lineOfLater = source.slice(0, mPkg.index).split('\n').length;
          diagnostics.push({
            level: 'warning',
            line: lineOfLater,
            message: `Package '${laterPkgs.join(', ')}' (line ${lineOfLater}) should be loaded BEFORE \\usepackage{xepersian} (line ${lineOfXe}) to avoid XePersian/bidi conflicts.`,
          });
        }
      }
    }
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
