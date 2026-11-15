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

function connectsAfter(ch: string): boolean {
  const forms = ARABIC_PERSIAN_FORMS[ch];
  return Boolean(forms?.initial);
}

function connectsBefore(ch: string): boolean {
  return Boolean(ARABIC_PERSIAN_FORMS[ch]);
}

function shapeArabicWord(word: string): string {
  // Strip tashkeel diacritics & normalize ZWNJ as a join breaker
  const chars = Array.from(word).filter((c) => !TASHKEEL_REGEX.test(c));
  const shaped: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\u200C' || ch === '\u200D') {
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
      shaped.push(ch);
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

/**
 * Visually orders a mixed RTL/LTR string left-to-right for `pdf-lib` drawing.
 * Pure RTL spans are shaped + reversed; inline LTR spans (English, formulas, numbers)
 * stay left-to-right while positioned in proper RTL sentence order when `baseRtl` is true.
 */
export function shapePersianForPdf(text: string, baseRtl = RTL_CHAR_REGEX.test(text)): string {
  if (!text) return '';
  if (!RTL_CHAR_REGEX.test(text)) return text;

  // Tokenize into RTL runs (including RTL punctuation/spaces) and LTR runs (Latin/numbers/math)
  const segments: Array<{ isRtl: boolean; value: string }> = [];
  let current = '';
  let currentRtl: boolean | null = null;

  for (const ch of Array.from(text)) {
    const chIsRtl = RTL_CHAR_REGEX.test(ch) || ch === '\u200C';
    const chIsLtr = /[A-Za-z0-9\\${}[\]()+\-=<>*/^_|]/.test(ch);

    if (ch === ' ') {
      if (currentRtl === null) {
        currentRtl = baseRtl;
      }
      current += ch;
      continue;
    }

    const nextIsRtl: boolean = chIsRtl ? true : chIsLtr ? false : (currentRtl ?? baseRtl);
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

  const renderedSegments = segments.map((seg) => {
    if (!seg.isRtl) return seg.value;
    // Shape each Persian/Arabic word individually then reverse token order inside the RTL segment
    const parts = seg.value.split(/( +)/);
    const shapedParts = parts.map((p) => (RTL_CHAR_REGEX.test(p) ? shapeArabicWord(p) : p));
    return shapedParts.reverse().join('');
  });

  if (baseRtl) {
    return renderedSegments.reverse().join('');
  }
  return renderedSegments.join('');
}

const LATEX_MATH_GLYPHS: Array<[RegExp, string]> = [
  [/\\leqslant/g, '≤'],
  [/\\geqslant/g, '≥'],
  [/\\leq/g, '≤'],
  [/\\geq/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\equiv/g, '≡'],
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
  [/\\pm/g, '±'],
  [/\\to\b|\\rightarrow/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\Rightarrow/g, '⇒'],
  [/\\in\b/g, '∈'],
  [/\\notin\b/g, '∉'],
  [/\\subset/g, '⊂'],
  [/\\subseteq/g, '⊆'],
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\epsilon|\\varepsilon/g, 'ε'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\pi/g, 'π'],
  [/\\sigma/g, 'σ'],
  [/\\phi|\\varphi/g, 'φ'],
  [/\\omega/g, 'ω'],
  [/\\Delta/g, 'Δ'],
  [/\\Sigma/g, 'Σ'],
  [/\\Omega/g, 'Ω'],
  [/\\\|/g, '‖'],
  [/\\left|\\right/g, ''],
  [/\\,/g, ' '],
];

export function latexMathToUnicode(math: string): string {
  let out = math;
  for (const [pattern, replacement] of LATEX_MATH_GLYPHS) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathcal\{([^}]*)\}/g, '$1')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/⟨\s+/g, '⟨')
    .replace(/\s+⟩/g, '⟩')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}
