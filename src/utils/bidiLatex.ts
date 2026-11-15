import { DirectionMode } from '../types/latex';

// Strong RTL Unicode ranges: Hebrew, Arabic, Persian, Syriac, Thaana, Presentation Forms
const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u03FF]/;

export type LatexTokenType =
  | 'command'
  | 'environment'
  | 'brace'
  | 'math'
  | 'comment'
  | 'rtl-text'
  | 'ltr-text'
  | 'whitespace'
  | 'plain';

export interface LatexToken {
  from: number;
  to: number;
  text: string;
  type: LatexTokenType;
  dir?: 'ltr' | 'rtl';
  isolate?: boolean;
}

export function hasRtlChar(text: string): boolean {
  return RTL_CHAR_REGEX.test(text);
}

export function hasLtrChar(text: string): boolean {
  return LTR_CHAR_REGEX.test(text);
}

/**
 * Detects the active script direction of a newly typed character or text snippet.
 */
export function detectInputScript(text: string): 'rtl' | 'ltr' | null {
  if (!text) return null;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (RTL_CHAR_REGEX.test(ch)) return 'rtl';
    if (LTR_CHAR_REGEX.test(ch)) return 'ltr';
  }
  return null;
}

/**
 * Determines the base paragraph/line direction for a line of LaTeX code.
 *
 * Rules:
 * - Explicit mode ('ltr' | 'rtl') overrides auto-detection.
 * - Lines starting with a LaTeX command (e.g. \section{درس}, \begin{...}, % comment, $$)
 *   keep a structural 'ltr' base direction so commands always flow left-to-right,
 *   while their inner RTL braces are isolated with dir="rtl".
 * - Prose lines use the first strong directional character (Unicode BiDi P2/P3 rule),
 *   so Persian/Arabic passages automatically render RTL even when they later contain
 *   inline commands like \lr{LaTeX} or English terms.
 */
export function detectLineDirection(line: string, mode: DirectionMode = 'auto'): 'ltr' | 'rtl' {
  if (mode === 'ltr' || mode === 'rtl') return mode;

  const trimmed = line.trimStart();
  if (!trimmed) return 'ltr';

  // Structural LaTeX commands at the start of a line stay LTR
  if (/^(\\[a-zA-Z@*]+|[%$])/.test(trimmed)) {
    return 'ltr';
  }

  // First strong directional character determines prose direction
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (RTL_CHAR_REGEX.test(ch)) return 'rtl';
    if (LTR_CHAR_REGEX.test(ch)) return 'ltr';
  }

  return 'ltr';
}

/**
 * Tokenizes a single line of LaTeX for syntax coloring AND BiDi isolation.
 * Ensures commands like `\section{درس}` isolate `\section`, `{`, `}` as LTR
 * and `درس` as RTL so the command and argument never visually scramble.
 */
export function tokenizeLatexLine(line: string): LatexToken[] {
  const tokens: LatexToken[] = [];
  let i = 0;
  const len = line.length;
  let inMath = false;

  while (i < len) {
    const ch = line[i];

    // 1. Comments (% to end of line)
    if (ch === '%' && (i === 0 || line[i - 1] !== '\\')) {
      const rest = line.slice(i);
      tokens.push({
        from: i,
        to: len,
        text: rest,
        type: 'comment',
        dir: hasRtlChar(rest) ? 'rtl' : 'ltr',
        isolate: true,
      });
      break;
    }

    // 2. Math delimiters ($ or $$)
    if (ch === '$') {
      const isDouble = line[i + 1] === '$';
      const end = isDouble ? i + 2 : i + 1;
      tokens.push({
        from: i,
        to: end,
        text: line.slice(i, end),
        type: 'math',
        dir: 'ltr',
        isolate: true,
      });
      inMath = !inMath;
      i = end;
      continue;
    }

    // 3. LaTeX commands (\command or \begin{env} / \end{env} or escaped symbol)
    if (ch === '\\') {
      const envMatch = line.slice(i).match(/^\\(begin|end)\{([a-zA-Z0-9_*]+)\}/);
      if (envMatch) {
        const cmdEnd = i + 1 + envMatch[1].length;
        tokens.push({
          from: i,
          to: cmdEnd,
          text: line.slice(i, cmdEnd),
          type: 'command',
          dir: 'ltr',
          isolate: true,
        });
        tokens.push({
          from: cmdEnd,
          to: cmdEnd + 1,
          text: '{',
          type: 'brace',
          dir: 'ltr',
          isolate: true,
        });
        const envEnd = cmdEnd + 1 + envMatch[2].length;
        tokens.push({
          from: cmdEnd + 1,
          to: envEnd,
          text: envMatch[2],
          type: 'environment',
          dir: 'ltr',
          isolate: true,
        });
        tokens.push({
          from: envEnd,
          to: envEnd + 1,
          text: '}',
          type: 'brace',
          dir: 'ltr',
          isolate: true,
        });
        i = envEnd + 1;
        continue;
      }

      const cmdMatch = line.slice(i).match(/^\\([a-zA-Z@]+\*?|[\\{}%$&#_~^])/);
      if (cmdMatch) {
        const end = i + cmdMatch[0].length;
        tokens.push({
          from: i,
          to: end,
          text: cmdMatch[0],
          type: 'command',
          dir: 'ltr',
          isolate: true,
        });
        i = end;
        continue;
      }
    }

    // 4. Braces & Brackets
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      tokens.push({
        from: i,
        to: i + 1,
        text: ch,
        type: 'brace',
        dir: 'ltr',
        isolate: true,
      });
      i++;
      continue;
    }

    // 5. Inline math content
    if (inMath) {
      let end = i + 1;
      while (end < len && line[end] !== '$' && line[end] !== '\\' && line[end] !== '{' && line[end] !== '}') {
        end++;
      }
      tokens.push({
        from: i,
        to: end,
        text: line.slice(i, end),
        type: 'math',
        dir: 'ltr',
        isolate: true,
      });
      i = end;
      continue;
    }

    // 6. Contiguous RTL text run (including spaces/ZWNJ/digits between RTL words)
    if (RTL_CHAR_REGEX.test(ch)) {
      let end = i + 1;
      while (end < len) {
        const next = line[end];
        if (next === '\\' || next === '{' || next === '}' || next === '[' || next === ']' || next === '$' || next === '%') {
          break;
        }
        // Stop RTL run if we hit a strong LTR Latin word
        if (LTR_CHAR_REGEX.test(next)) {
          break;
        }
        end++;
      }
      // Trim trailing whitespace from RTL isolation so surrounding braces/spaces behave cleanly
      let trimmedEnd = end;
      while (trimmedEnd > i + 1 && line[trimmedEnd - 1] === ' ') {
        trimmedEnd--;
      }
      tokens.push({
        from: i,
        to: trimmedEnd,
        text: line.slice(i, trimmedEnd),
        type: 'rtl-text',
        dir: 'rtl',
        isolate: true,
      });
      i = trimmedEnd;
      continue;
    }

    // 7. Whitespace
    if (ch === ' ' || ch === '\t') {
      let end = i + 1;
      while (end < len && (line[end] === ' ' || line[end] === '\t')) end++;
      tokens.push({
        from: i,
        to: end,
        text: line.slice(i, end),
        type: 'whitespace',
      });
      i = end;
      continue;
    }

    // 8. Contiguous LTR text / numbers
    let end = i + 1;
    while (end < len) {
      const next = line[end];
      if (
        next === '\\' ||
        next === '{' ||
        next === '}' ||
        next === '[' ||
        next === ']' ||
        next === '$' ||
        next === '%' ||
        next === ' ' ||
        next === '\t' ||
        RTL_CHAR_REGEX.test(next)
      ) {
        break;
      }
      end++;
    }
    const text = line.slice(i, end);
    tokens.push({
      from: i,
      to: end,
      text,
      type: LTR_CHAR_REGEX.test(text) ? 'ltr-text' : 'plain',
      dir: LTR_CHAR_REGEX.test(text) ? 'ltr' : undefined,
      isolate: LTR_CHAR_REGEX.test(text),
    });
    i = end;
  }

  return tokens;
}

export interface BidiSpan {
  from: number;
  to: number;
  dir: 'ltr' | 'rtl';
}

/**
 * Computes properly nested BiDi isolate spans for a line of LaTeX synchronized with CodeMirror's
 * `EditorView.bidiIsolatedRanges`:
 * - On an LTR line (e.g. `\section{درس های متنی }`), only RTL runs need `'rtl'` isolation, and
 *   spaces inside `{...}` stay inside the `'rtl'` run so typing Persian words never jumps the caret.
 * - On an RTL line (e.g. Persian prose with `\ref{sec:cauchy}` or `$u, v \in H$`), math and
 *   commands are isolated as `'ltr'`, with any inner RTL arguments isolated as `'rtl'`.
 */
export function computeBidiSpans(line: string, lineDir: 'ltr' | 'rtl' = 'rtl'): BidiSpan[] {
  const spans: BidiSpan[] = [];
  const len = line.length;
  let i = 0;

  const pushRtlRuns = (start: number, end: number) => {
    let j = start;
    while (j < end) {
      if (RTL_CHAR_REGEX.test(line[j])) {
        let k = j + 1;
        while (
          k < end &&
          !LTR_CHAR_REGEX.test(line[k]) &&
          line[k] !== '\\' &&
          line[k] !== '{' &&
          line[k] !== '}' &&
          line[k] !== '[' &&
          line[k] !== ']' &&
          line[k] !== '$' &&
          line[k] !== '%'
        ) {
          k++;
        }
        // Only trim trailing space if followed by an LTR character or end of unbraced segment
        if (k < end && LTR_CHAR_REGEX.test(line[k])) {
          while (k > j + 1 && line[k - 1] === ' ') k--;
        }
        spans.push({ from: j, to: k, dir: 'rtl' });
        j = k;
      } else {
        j++;
      }
    }
  };

  while (i < len) {
    // 1. Comment to end of line
    if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) {
      const commentDir = hasRtlChar(line.slice(i)) ? 'rtl' : 'ltr';
      if (commentDir !== lineDir) {
        spans.push({ from: i, to: len, dir: commentDir });
      }
      break;
    }

    // 2. Display or inline math ($...$ or $$...$$)
    if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
      const delim = line[i + 1] === '$' ? '$$' : '$';
      const closeIdx = line.indexOf(delim, i + delim.length);
      if (closeIdx !== -1) {
        const end = closeIdx + delim.length;
        if (lineDir === 'rtl') {
          spans.push({ from: i, to: end, dir: 'ltr' });
        }
        i = end;
        continue;
      }
    }

    // 3. Command possibly followed by [...] and {...} arguments
    if (line[i] === '\\') {
      const cmdMatch = line.slice(i).match(/^\\[a-zA-Z@]+\*?/);
      if (cmdMatch) {
        let end = i + cmdMatch[0].length;
        while (end < len) {
          if (line[end] === '[' || line[end] === '{') {
            const openCh = line[end];
            const closeCh = openCh === '[' ? ']' : '}';
            let depth = 1;
            let scan = end + 1;
            while (scan < len && depth > 0) {
              if (line[scan] === openCh && line[scan - 1] !== '\\') depth++;
              else if (line[scan] === closeCh && line[scan - 1] !== '\\') depth--;
              scan++;
            }
            if (depth === 0) {
              end = scan;
              continue;
            }
          }
          break;
        }
        if (lineDir === 'rtl') {
          spans.push({ from: i, to: end, dir: 'ltr' });
        }
        // Isolate RTL runs inside {...} arguments
        if (end > i + cmdMatch[0].length && hasRtlChar(line.slice(i + cmdMatch[0].length, end))) {
          pushRtlRuns(i + cmdMatch[0].length, end);
        }
        i = end;
        continue;
      }
    }

    // 4. Standalone RTL run
    if (RTL_CHAR_REGEX.test(line[i])) {
      let end = i + 1;
      while (
        end < len &&
        !LTR_CHAR_REGEX.test(line[end]) &&
        line[end] !== '\\' &&
        line[end] !== '$' &&
        line[end] !== '%' &&
        line[end] !== '{' &&
        line[end] !== '}'
      ) {
        end++;
      }
      if (end < len && (LTR_CHAR_REGEX.test(line[end]) || line[end] === '\\' || line[end] === '$')) {
        while (end > i + 1 && line[end - 1] === ' ') end--;
      }
      if (lineDir === 'ltr') {
        spans.push({ from: i, to: end, dir: 'rtl' });
      }
      i = end;
      continue;
    }

    // 5. Standalone LTR word/run on RTL lines
    if (LTR_CHAR_REGEX.test(line[i])) {
      let end = i + 1;
      while (
        end < len &&
        !RTL_CHAR_REGEX.test(line[end]) &&
        line[end] !== '\\' &&
        line[end] !== '$' &&
        line[end] !== '%'
      ) {
        if (line[end] === ' ' && (end + 1 >= len || RTL_CHAR_REGEX.test(line[end + 1]))) break;
        end++;
      }
      while (end > i + 1 && line[end - 1] === ' ') end--;
      if (lineDir === 'rtl') {
        spans.push({ from: i, to: end, dir: 'ltr' });
      }
      i = end;
      continue;
    }

    i++;
  }

  return spans;
}

