/**
 * Shapes Persian/Arabic text using Arabic Presentation Forms-B and reorders
 * RTL segments visually for static PDF drawing (pdf-lib) without HarfBuzz.
 */

interface GlyphForms {
  isolated: string;
  final: string;
  initial?: string;
  medial?: string;
}

const ARABIC_PERSIAN_FORMS: Record<string, GlyphForms> = {
  '\u0621': { isolated: '\uFE80', final: '\uFE80' }, // ء
  '\u0622': { isolated: '\uFE81', final: '\uFE82' }, // آ
  '\u0623': { isolated: '\uFE83', final: '\uFE84' }, // أ
  '\u0624': { isolated: '\uFE85', final: '\uFE86' }, // ؤ
  '\u0625': { isolated: '\uFE87', final: '\uFE88' }, // إ
  '\u0626': { isolated: '\uFE89', final: '\uFE8A', initial: '\uFE8B', medial: '\uFE8C' }, // ئ
  '\u0627': { isolated: '\uFE8D', final: '\uFE8E' }, // ا
  '\u0628': { isolated: '\uFE8F', final: '\uFE90', initial: '\uFE91', medial: '\uFE92' }, // ب
  '\u0629': { isolated: '\uFE93', final: '\uFE94' }, // ة
  '\u062A': { isolated: '\uFE95', final: '\uFE96', initial: '\uFE97', medial: '\uFE98' }, // ت
  '\u062B': { isolated: '\uFE99', final: '\uFE9A', initial: '\uFE9B', medial: '\uFE9C' }, // ث
  '\u062C': { isolated: '\uFE9D', final: '\uFE9E', initial: '\uFE9F', medial: '\uFEA0' }, // ج
  '\u062D': { isolated: '\uFEA1', final: '\uFEA2', initial: '\uFEA3', medial: '\uFEA4' }, // ح
  '\u062E': { isolated: '\uFEA5', final: '\uFEA6', initial: '\uFEA7', medial: '\uFEA8' }, // خ
  '\u062F': { isolated: '\uFEA9', final: '\uFEAA' }, // د
  '\u0630': { isolated: '\uFEAB', final: '\uFEAC' }, // ذ
  '\u0631': { isolated: '\uFEAD', final: '\uFEAE' }, // ر
  '\u0632': { isolated: '\uFEAF', final: '\uFEB0' }, // ز
  '\u0633': { isolated: '\uFEB1', final: '\uFEB2', initial: '\uFEB3', medial: '\uFEB4' }, // س
  '\u0634': { isolated: '\uFEB5', final: '\uFEB6', initial: '\uFEB7', medial: '\uFEB8' }, // ش
  '\u0635': { isolated: '\uFEB9', final: '\uFEBA', initial: '\uFEBB', medial: '\uFEBC' }, // ص
  '\u0636': { isolated: '\uFEBD', final: '\uFEBE', initial: '\uFEBF', medial: '\uFEC0' }, // ض
  '\u0637': { isolated: '\uFEC1', final: '\uFEC2', initial: '\uFEC3', medial: '\uFEC4' }, // ط
  '\u0638': { isolated: '\uFEC5', final: '\uFEC6', initial: '\uFEC7', medial: '\uFEC8' }, // ظ
  '\u0639': { isolated: '\uFEC9', final: '\uFECA', initial: '\uFECB', medial: '\uFECC' }, // ع
  '\u063A': { isolated: '\uFECD', final: '\uFECE', initial: '\uFECF', medial: '\uFED0' }, // غ
  '\u0641': { isolated: '\uFED1', final: '\uFED2', initial: '\uFED3', medial: '\uFED4' }, // ف
  '\u0642': { isolated: '\uFED5', final: '\uFED6', initial: '\uFED7', medial: '\uFED8' }, // ق
  '\u0643': { isolated: '\uFED9', final: '\uFEDA', initial: '\uFEDB', medial: '\uFEDC' }, // ك
  '\u0644': { isolated: '\uFEDD', final: '\uFEDE', initial: '\uFEDF', medial: '\uFEE0' }, // ل
  '\u0645': { isolated: '\uFEE1', final: '\uFEE2', initial: '\uFEE3', medial: '\uFEE4' }, // م
  '\u0646': { isolated: '\uFEE5', final: '\uFEE6', initial: '\uFEE7', medial: '\uFEE8' }, // ن
  '\u0647': { isolated: '\uFEE9', final: '\uFEEA', initial: '\uFEEB', medial: '\uFEEC' }, // ه
  '\u0648': { isolated: '\uFEED', final: '\uFEEE' }, // و
  '\u0649': { isolated: '\uFEEF', final: '\uFEF0' }, // ى
  '\u064A': { isolated: '\uFEF1', final: '\uFEF2', initial: '\uFEF3', medial: '\uFEF4' }, // ي
  // Persian-specific letters
  '\u067E': { isolated: '\uFB56', final: '\uFB57', initial: '\uFB58', medial: '\uFB59' }, // پ
  '\u0686': { isolated: '\uFB7A', final: '\uFB7B', initial: '\uFB7C', medial: '\uFB7D' }, // چ
  '\u0698': { isolated: '\uFB8A', final: '\uFB8B' }, // ژ
  '\u06A9': { isolated: '\uFB8E', final: '\uFB8F', initial: '\uFB90', medial: '\uFB91' }, // ک
  '\u06AF': { isolated: '\uFB92', final: '\uFB93', initial: '\uFB94', medial: '\uFB95' }, // گ
  '\u06C0': { isolated: '\uFBA4', final: '\uFBA5' }, // ۀ
  '\u06CC': { isolated: '\uFBFC', final: '\uFBFD', initial: '\uFBFE', medial: '\uFBFF' }, // ی
};

const LAM_ALEF_LIGATURES: Record<string, { isolated: string; final: string }> = {
  '\u0622': { isolated: '\uFEF5', final: '\uFEF6' }, // لآ
  '\u0623': { isolated: '\uFEF7', final: '\uFEF8' }, // لأ
  '\u0625': { isolated: '\uFEF9', final: '\uFEFA' }, // لإ
  '\u0627': { isolated: '\uFEFB', final: '\uFEFC' }, // لا
};

const TASHKEEL_REGEX = /[\u064B-\u065F\u0670]/;
const RTL_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const PERSIAN_ARABIC_DIGIT_REGEX = /[\u0660-\u0669\u06F0-\u06F9]/;

const RTL_MIRROR_PAIRS: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '«': '»',
  '»': '«',
};

function connectsAfter(ch: string): boolean {
  const forms = ARABIC_PERSIAN_FORMS[ch];
  return Boolean(forms?.initial);
}

function connectsBefore(ch: string): boolean {
  return Boolean(ARABIC_PERSIAN_FORMS[ch]);
}

function shapeArabicWord(word: string): string {
  // Preserve multi-digit Persian/Arabic numerals in natural left-to-right digit order
  if (/^[\u0660-\u0669\u06F0-\u06F9.,/٫٬-]+$/.test(word) && PERSIAN_ARABIC_DIGIT_REGEX.test(word)) {
    return word;
  }

  // Strip tashkeel diacritics & normalize ZWNJ as a join breaker
  const chars = Array.from(word).filter((c) => !TASHKEEL_REGEX.test(c));
  const shaped: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\u200C' || ch === '\u200D') {
      continue;
    }

    // Preserve embedded Persian/Arabic digit runs in forward order when reversed below
    if (PERSIAN_ARABIC_DIGIT_REGEX.test(ch)) {
      let end = i + 1;
      while (end < chars.length && PERSIAN_ARABIC_DIGIT_REGEX.test(chars[end])) {
        end++;
      }
      const digitRun = chars.slice(i, end).reverse().join('');
      shaped.push(digitRun);
      i = end - 1;
      continue;
    }

    // Handle Lam + Alef ligature
    if (ch === '\u0644' && i + 1 < chars.length && LAM_ALEF_LIGATURES[chars[i + 1]]) {
      const prevChar = i > 0 ? chars[i - 1] : '';
      const hasPrev = prevChar !== '' && prevChar !== '\u200C' && connectsAfter(prevChar);
      const lig = LAM_ALEF_LIGATURES[chars[i + 1]];
      shaped.push(hasPrev ? lig.final : lig.isolated);
      i++;
      continue;
    }

    const forms = ARABIC_PERSIAN_FORMS[ch];
    if (!forms) {
      shaped.push(RTL_MIRROR_PAIRS[ch] || ch);
      continue;
    }

    const prevChar = i > 0 ? chars[i - 1] : '';
    const nextChar = i + 1 < chars.length ? chars[i + 1] : '';

    const prevJoins = prevChar !== '' && prevChar !== '\u200C' && connectsAfter(prevChar);
    const nextJoins = nextChar !== '' && nextChar !== '\u200C' && connectsBefore(nextChar);

    if (prevJoins && nextJoins && forms.medial) {
      shaped.push(forms.medial);
    } else if (prevJoins && forms.final) {
      shaped.push(forms.final);
    } else if (nextJoins && forms.initial) {
      shaped.push(forms.initial);
    } else {
      shaped.push(forms.isolated);
    }
  }

  return shaped.reverse().join('');
}

export interface PdfTextRun {
  text: string;
  isRtl: boolean;
}

/**
 * Splits and visually orders a mixed RTL/LTR string left-to-right into typed runs
 * so the PDF renderer can pick an Arabic font for RTL runs and a Latin/Math font for LTR runs.
 */
export function shapePersianRunsForPdf(
  text: string,
  baseRtl = RTL_CHAR_REGEX.test(text)
): PdfTextRun[] {
  if (!text) return [];
  if (!RTL_CHAR_REGEX.test(text)) return [{ text, isRtl: false }];

  // Tokenize into RTL runs (Persian/Arabic + adjacent RTL punctuation/spaces) and LTR runs (Latin/numbers/math)
  const chars = Array.from(text);
  const segments: Array<{ isRtl: boolean; value: string }> = [];
  let current = '';
  let currentRtl: boolean | null = null;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const chIsRtl = RTL_CHAR_REGEX.test(ch) || ch === '\u200C';
    const chIsLtr =
      /[A-Za-z0-9\u0370-\u03FF\u2016\u2022\u2100-\u214F\u2190-\u22FF\u27E8-\u27E9\\${}[\]()+\-=<>*/^_|]/.test(
        ch
      );

    if (ch === ' ') {
      if (currentRtl === null) {
        currentRtl = baseRtl;
      }
      current += ch;
      continue;
    }

    // Sentence/clause punctuation (., :, !, ?) in an RTL line belongs to baseRtl unless directly inside an LTR expression
    const isNeutralClausePunct = /^[.:!?]$/.test(ch);
    const nextNonSpace = chars.slice(i + 1).find((c) => c !== ' ') || '';
    const nextLooksLtr = /[A-Za-z0-9]/.test(nextNonSpace);
    const nextIsRtl: boolean = chIsRtl
      ? true
      : chIsLtr
        ? false
        : isNeutralClausePunct && baseRtl && !nextLooksLtr
          ? true
          : (currentRtl ?? baseRtl);

    if (currentRtl !== null && nextIsRtl !== currentRtl) {
      segments.push({ isRtl: currentRtl, value: current });
      current = ch;
      currentRtl = nextIsRtl;
    } else {
      current += ch;
      currentRtl = nextIsRtl;
    }
  }
  if (current) {
    segments.push({ isRtl: currentRtl ?? baseRtl, value: current });
  }

  const renderedRuns: PdfTextRun[] = segments.map((seg) => {
    if (!seg.isRtl) return { text: seg.value, isRtl: false };
    // Shape each Persian/Arabic word individually then reverse token order inside the RTL segment
    const parts = seg.value.split(/( +)/);
    const shapedParts = parts.map((p) => {
      if (!p || /^ +$/.test(p)) return p;
      if (RTL_CHAR_REGEX.test(p)) return shapeArabicWord(p);
      return Array.from(p)
        .map((c) => RTL_MIRROR_PAIRS[c] || c)
        .reverse()
        .join('');
    });
    return { text: shapedParts.reverse().join(''), isRtl: true };
  });

  if (baseRtl) {
    return renderedRuns.reverse();
  }
  return renderedRuns;
}

/**
 * Splits mixed RTL/LTR strings into visually ordered runs for `pdf-lib` + `@pdf-lib/fontkit`.
 * Leaves Arabic/Persian codepoints in raw Unicode so fontkit's OpenType GSUB shaper
 * produces genuine connected cursive glyphs, ligatures, and ZWNJ spacing without double-reversal,
 * while preserving spaces cleanly on both sides of inline LTR spans and fixing Persian digit order.
 */
export function splitBidiRunsForFontkit(
  text: string,
  baseRtl = RTL_CHAR_REGEX.test(text)
): PdfTextRun[] {
  if (!text) return [];
  if (!RTL_CHAR_REGEX.test(text)) return [{ text, isRtl: false }];

  const runs: PdfTextRun[] = [];
  const chars = Array.from(text);
  let current = '';
  let currentKind: 'rtl' | 'ltr' | 'space' | null = null;

  const flush = () => {
    if (!current || !currentKind) return;
    if (currentKind === 'space') {
      runs.push({ text: current, isRtl: false });
    } else if (currentKind === 'rtl') {
      // fontkit reverses RTL runs; pre-reverse Persian/Arabic digit sequences so digits render LTR
      const fixedDigits = current.replace(/[\u0660-\u0669\u06F0-\u06F9]+/g, (m) =>
        Array.from(m).reverse().join('')
      );
      runs.push({ text: fixedDigits, isRtl: true });
    } else {
      runs.push({ text: current, isRtl: false });
    }
    current = '';
    currentKind = null;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      if (currentKind !== 'space') {
        flush();
        currentKind = 'space';
      }
      current += ch;
      continue;
    }

    const chIsRtl =
      (RTL_CHAR_REGEX.test(ch) && !PERSIAN_ARABIC_DIGIT_REGEX.test(ch)) || ch === '\u200C';
    const chIsPersianDigit = PERSIAN_ARABIC_DIGIT_REGEX.test(ch);
    const chIsLtr =
      /[A-Za-z0-9\u0370-\u03FF\u2016\u2022\u2100-\u214F\u2190-\u22FF\u27E8-\u27E9\\${}[\]()+*=<>*/^_|]/.test(
        ch
      );

    let nextKind: 'rtl' | 'ltr';
    if (chIsRtl || chIsPersianDigit) {
      nextKind = 'rtl';
    } else if (chIsLtr) {
      nextKind = 'ltr';
    } else {
      const nextNonSpace = chars.slice(i + 1).find((c) => c !== ' ') || '';
      const nextLooksLtr = /[A-Za-z0-9\u0370-\u03FF\u2190-\u22FF]/.test(nextNonSpace);
      if (/^[.:!?,،؛\-–—]$/.test(ch)) {
        if (nextLooksLtr && (currentKind === 'ltr' || ch === '-' || !baseRtl)) {
          nextKind = 'ltr';
        } else if (baseRtl && !nextLooksLtr) {
          nextKind = 'rtl';
        } else {
          nextKind = currentKind === 'ltr' && nextLooksLtr ? 'ltr' : baseRtl ? 'rtl' : 'ltr';
        }
      } else {
        nextKind = currentKind === 'ltr' ? 'ltr' : baseRtl ? 'rtl' : 'ltr';
      }
    }

    if (currentKind !== nextKind) {
      flush();
      currentKind = nextKind;
    }
    current += ch;
  }
  flush();

  // Merge adjacent same-direction runs separated by spaces (RTL+space+RTL and LTR+space+LTR)
  // so fontkit shapes Persian phrases cleanly AND multi-word LTR phrases stay in forward order.
  const merged: PdfTextRun[] = [];
  for (let i = 0; i < runs.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = runs[i];
    const next = runs[i + 1];
    if (
      prev &&
      prev.text.trim() !== '' &&
      curr.text.trim() === '' &&
      next &&
      next.text.trim() !== '' &&
      prev.isRtl === next.isRtl
    ) {
      prev.text = `${prev.text}${curr.text}${next.text}`;
      i++;
      continue;
    }
    merged.push(curr);
  }

  return baseRtl ? merged.reverse() : merged;
}

/**
 * Visually orders a mixed RTL/LTR string left-to-right for `pdf-lib` drawing.
 * Pure RTL spans are shaped + reversed; inline LTR spans (English, formulas, numbers)
 * stay left-to-right while positioned in proper RTL sentence order when `baseRtl` is true.
 */
export function shapePersianForPdf(text: string, baseRtl = RTL_CHAR_REGEX.test(text)): string {
  return shapePersianRunsForPdf(text, baseRtl)
    .map((r) => r.text)
    .join('');
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

function mapDigitsScript(raw: string, map: Record<string, string>, fallbackPrefix: string): string {
  const chars = Array.from(raw);
  if (chars.every((c) => Boolean(map[c]))) {
    return chars.map((c) => map[c]).join('');
  }
  return `${fallbackPrefix}(${raw})`;
}

const LATEX_MATH_GLYPHS: Array<[RegExp, string]> = [
  [/\\leqslant/g, '≤'],
  [/\\geqslant/g, '≥'],
  [/\\leq\b|\\le\b/g, '≤'],
  [/\\geq\b|\\ge\b/g, '≥'],
  [/\\neq\b|\\ne\b/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\equiv/g, '≡'],
  [/\\sim\b/g, '∼'],
  [/\\propto/g, '∝'],
  [/\\langle/g, '⟨'],
  [/\\rangle/g, '⟩'],
  [/\\infty/g, '∞'],
  [/\\sqrt/g, '√'],
  [/\\sum/g, '∑'],
  [/\\prod/g, '∏'],
  [/\\int/g, '∫'],
  [/\\partial/g, '∂'],
  [/\\nabla/g, '∇'],
  [/\\cdot/g, '·'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\mp/g, '∓'],
  [/\\top\b/g, 'ᵀ'],
  [/\\mapsto/g, '↦'],
  [/\\to\b|\\rightarrow/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\Rightarrow/g, '⇒'],
  [/\\Leftrightarrow|\\iff/g, '⇔'],
  [/\\in\b/g, '∈'],
  [/\\notin\b/g, '∉'],
  [/\\subseteq/g, '⊆'],
  [/\\subset/g, '⊂'],
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\setminus/g, '∖'],
  [/\\emptyset|\\varnothing/g, '∅'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\epsilon|\\varepsilon/g, 'ε'],
  [/\\zeta/g, 'ζ'],
  [/\\eta/g, 'η'],
  [/\\theta/g, 'θ'],
  [/\\iota/g, 'ι'],
  [/\\kappa/g, 'κ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\nu/g, 'ν'],
  [/\\xi/g, 'ξ'],
  [/\\pi/g, 'π'],
  [/\\rho/g, 'ρ'],
  [/\\sigma/g, 'σ'],
  [/\\tau/g, 'τ'],
  [/\\phi|\\varphi/g, 'φ'],
  [/\\chi/g, 'χ'],
  [/\\psi/g, 'ψ'],
  [/\\omega/g, 'ω'],
  [/\\Delta/g, 'Δ'],
  [/\\Gamma/g, 'Γ'],
  [/\\Lambda/g, 'Λ'],
  [/\\Phi/g, 'Φ'],
  [/\\Psi/g, 'Ψ'],
  [/\\Sigma/g, 'Σ'],
  [/\\Omega/g, 'Ω'],
  [/\\\|/g, '‖'],
  [/\\lVert|\\rVert/g, '‖'],
  [/\\left|\\right/g, ''],
  [/\\[,;:!]/g, ' '],
  [/\\quad|\\qquad/g, '  '],
  [/\\(sin|cos|tan|cot|sec|csc|log|ln|exp|lim|sup|inf|max|min|det|dim|ker|arg|deg)\b/g, '$1'],
];

export function latexMathToUnicode(math: string): string {
  let out = math;
  for (const [pattern, replacement] of LATEX_MATH_GLYPHS) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/\\(?:text|mathrm|mathbf|mathit|mathcal|operatorname|boldsymbol)\{([^}]*)\}/g, '$1')
    .replace(/\\(?:hat|bar|vec|tilde|overline)\{([^}]*)\}/g, '$1')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\mathbb\{([A-Z])\}/g, '$1')
    .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\binom\{([^}]*)\}\{([^}]*)\}/g, 'C($1, $2)')
    .replace(/√\{([^{}]{1,2})\}/g, '√$1')
    .replace(/√\{([^}]*)\}/g, '√($1)')
    .replace(/\^([0-9ni])/g, (_, ch) => SUPERSCRIPT_MAP[ch] || `^${ch}`)
    .replace(/_([0-9])/g, (_, ch) => SUBSCRIPT_MAP[ch] || `_${ch}`)
    .replace(/\^\{([^}]*)\}/g, (_, g1) => mapDigitsScript(g1, SUPERSCRIPT_MAP, '^'))
    .replace(/_\{([^}]*)\}/g, (_, g1) => mapDigitsScript(g1, SUBSCRIPT_MAP, '_'))
    .replace(/⟨\s+/g, '⟨')
    .replace(/\s+⟩/g, '⟩')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}
