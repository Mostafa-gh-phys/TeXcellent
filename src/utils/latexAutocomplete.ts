import { ProjectFile } from '../types/latex';
import { SMART_SNIPPETS } from './smartSnippets';

export interface LatexCompletionItem {
  label: string;
  insertText: string;
  detail: string;
  pkg: string;
  kind: 'command' | 'environment' | 'package' | 'reference' | 'citation' | 'snippet';
}

export const PACKAGE_CATALOG: Array<{ name: string; description: string }> = [
  { name: 'amsmath', description: 'AMS mathematical facilities & align environments' },
  { name: 'amssymb', description: 'Extended mathematical symbols & blackboard bold' },
  { name: 'mathtools', description: 'Mathematical tools extending amsmath' },
  { name: 'xepersian', description: 'Persian/Farsi typesetting for XeLaTeX' },
  { name: 'polyglossia', description: 'Modern multilingual typesetting for XeLaTeX/LuaLaTeX' },
  { name: 'fontspec', description: 'OpenType & TrueType font selection' },
  { name: 'graphicx', description: 'Enhanced graphics and \\includegraphics support' },
  { name: 'hyperref', description: 'Hyperlinks, PDF bookmarks & \\href' },
  { name: 'geometry', description: 'Flexible page dimensions and margins' },
  { name: 'booktabs', description: 'Publication-quality horizontal table rules' },
  { name: 'tikz', description: 'PGF/TikZ programmatic vector graphics' },
  { name: 'pgfplots', description: 'High-quality 2D and 3D scientific plots' },
  { name: 'xcolor', description: 'Driver-independent color extensions' },
  { name: 'listings', description: 'Source code listings with syntax highlighting' },
  { name: 'algorithm2e', description: 'Floating algorithm pseudocode environments' },
  { name: 'biblatex', description: 'Sophisticated bibliography management with Biber' },
  { name: 'natbib', description: 'Flexible author-year and numerical citations' },
  { name: 'tcolorbox', description: 'Colored theorem, proof, and callout boxes' },
  { name: 'fancyhdr', description: 'Custom page headers and footers' },
  { name: 'amsthm', description: 'Theorem, lemma, and proof environments' },
];

export const ENVIRONMENT_CATALOG: Array<{ name: string; pkg: string; snippet: string; detail: string }> = [
  { name: 'document', pkg: 'core', snippet: 'document}\n\n\\end{document}', detail: 'Main document body' },
  { name: 'equation', pkg: 'core', snippet: 'equation}\n  \n\\end{equation}', detail: 'Numbered display equation' },
  { name: 'align', pkg: 'amsmath', snippet: 'align}\n  a &= b \\\\\n  c &= d\n\\end{align}', detail: 'Multi-line aligned equations' },
  { name: 'align*', pkg: 'amsmath', snippet: 'align*}\n  \n\\end{align*}', detail: 'Unnumbered aligned equations' },
  { name: 'gather', pkg: 'amsmath', snippet: 'gather}\n  \n\\end{gather}', detail: 'Centered multi-line equations' },
  { name: 'bmatrix', pkg: 'amsmath', snippet: 'bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}', detail: 'Square-bracket matrix' },
  { name: 'cases', pkg: 'amsmath', snippet: 'cases}\n  x & \\text{if } x \\ge 0 \\\\\n  -x & \\text{otherwise}\n\\end{cases}', detail: 'Piecewise function cases' },
  { name: 'itemize', pkg: 'core', snippet: 'itemize}\n  \\item \n\\end{itemize}', detail: 'Bulleted list' },
  { name: 'enumerate', pkg: 'core', snippet: 'enumerate}\n  \\item \n\\end{enumerate}', detail: 'Numbered list' },
  { name: 'figure', pkg: 'graphicx', snippet: 'figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{figure}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}', detail: 'Floating figure' },
  { name: 'table', pkg: 'booktabs', snippet: 'table}[htbp]\n  \\centering\n  \\caption{}\n  \\begin{tabular}{lcc}\n    \\toprule\n    Header 1 & Header 2 & Header 3 \\\\\n    \\midrule\n    A & 1 & 2 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}', detail: 'Floating booktabs table' },
  { name: 'tabular', pkg: 'core', snippet: 'tabular}{lcc}\n  \n\\end{tabular}', detail: 'Inline table alignment' },
  { name: 'tikzpicture', pkg: 'tikz', snippet: 'tikzpicture}\n  \\draw[->] (0,0) -- (2,0);\n\\end{tikzpicture}', detail: 'TikZ vector drawing canvas' },
  { name: 'axis', pkg: 'pgfplots', snippet: 'axis}[\n  xlabel=$x$,\n  ylabel=$y$\n]\n  \\addplot {x^2};\n\\end{axis}', detail: 'PGFPlots coordinate axis' },
  { name: 'latin', pkg: 'xepersian', snippet: 'latin}\n  \n\\end{latin}', detail: 'LTR Latin block inside Persian document' },
  { name: 'persian', pkg: 'xepersian', snippet: 'persian}\n  \n\\end{persian}', detail: 'RTL Persian block' },
  { name: 'theorem', pkg: 'amsthm', snippet: 'theorem}\n  \n\\end{theorem}', detail: 'Numbered theorem block' },
  { name: 'proof', pkg: 'amsthm', snippet: 'proof}\n  \n\\end{proof}', detail: 'Mathematical proof block' },
  { name: 'lstlisting', pkg: 'listings', snippet: 'lstlisting}[language=Python]\n\n\\end{lstlisting}', detail: 'Code listing block' },
  { name: 'tcolorbox', pkg: 'tcolorbox', snippet: 'tcolorbox}[title=Note]\n  \n\\end{tcolorbox}', detail: 'Framed callout box' },
  { name: 'frame', pkg: 'beamer', snippet: 'frame}{Slide Title}\n  \n\\end{frame}', detail: 'Beamer presentation slide' },
];

export const COMMAND_CATALOG: Array<{ cmd: string; insert: string; pkg: string; detail: string }> = [
  // Core structure
  { cmd: '\\documentclass', insert: '\\documentclass[12pt,a4paper]{article}', pkg: 'core', detail: 'Document class declaration' },
  { cmd: '\\usepackage', insert: '\\usepackage{}', pkg: 'core', detail: 'Load a LaTeX package' },
  { cmd: '\\title', insert: '\\title{}', pkg: 'core', detail: 'Document title' },
  { cmd: '\\author', insert: '\\author{}', pkg: 'core', detail: 'Document author' },
  { cmd: '\\date', insert: '\\date{\\today}', pkg: 'core', detail: 'Document date' },
  { cmd: '\\maketitle', insert: '\\maketitle', pkg: 'core', detail: 'Render title header' },
  { cmd: '\\tableofcontents', insert: '\\tableofcontents', pkg: 'core', detail: 'Insert table of contents' },
  { cmd: '\\section', insert: '\\section{}', pkg: 'core', detail: 'Top-level numbered section' },
  { cmd: '\\subsection', insert: '\\subsection{}', pkg: 'core', detail: 'Subsection heading' },
  { cmd: '\\subsubsection', insert: '\\subsubsection{}', pkg: 'core', detail: 'Sub-subsection heading' },
  { cmd: '\\paragraph', insert: '\\paragraph{}', pkg: 'core', detail: 'Run-in paragraph heading' },
  { cmd: '\\begin', insert: '\\begin{}\n\n\\end{}', pkg: 'core', detail: 'Begin environment block' },
  { cmd: '\\textbf', insert: '\\textbf{}', pkg: 'core', detail: 'Bold text' },
  { cmd: '\\textit', insert: '\\textit{}', pkg: 'core', detail: 'Italic text' },
  { cmd: '\\emph', insert: '\\emph{}', pkg: 'core', detail: 'Emphasized text' },
  { cmd: '\\texttt', insert: '\\texttt{}', pkg: 'core', detail: 'Monospace typewriter text' },
  { cmd: '\\underline', insert: '\\underline{}', pkg: 'core', detail: 'Underlined text' },
  { cmd: '\\item', insert: '\\item ', pkg: 'core', detail: 'List item' },
  { cmd: '\\label', insert: '\\label{}', pkg: 'core', detail: 'Cross-reference label' },
  { cmd: '\\ref', insert: '\\ref{}', pkg: 'core', detail: 'Reference a label' },
  { cmd: '\\footnote', insert: '\\footnote{}', pkg: 'core', detail: 'Page footnote' },
  { cmd: '\\centering', insert: '\\centering', pkg: 'core', detail: 'Center alignment' },
  { cmd: '\\newpage', insert: '\\newpage', pkg: 'core', detail: 'Start a new page' },
  // amsmath / amssymb / mathtools
  { cmd: '\\frac', insert: '\\frac{}{}', pkg: 'amsmath', detail: 'Fraction numerator/denominator' },
  { cmd: '\\dfrac', insert: '\\dfrac{}{}', pkg: 'amsmath', detail: 'Display-style fraction' },
  { cmd: '\\sqrt', insert: '\\sqrt{}', pkg: 'amsmath', detail: 'Square root' },
  { cmd: '\\sum', insert: '\\sum_{i=1}^{n}', pkg: 'amsmath', detail: 'Summation operator' },
  { cmd: '\\int', insert: '\\int_{a}^{b}', pkg: 'amsmath', detail: 'Definite integral' },
  { cmd: '\\lim', insert: '\\lim_{x \\to \\infty}', pkg: 'amsmath', detail: 'Limit expression' },
  { cmd: '\\text', insert: '\\text{}', pkg: 'amsmath', detail: 'Upright text inside math mode' },
  { cmd: '\\eqref', insert: '\\eqref{}', pkg: 'amsmath', detail: 'Parenthesized equation reference' },
  { cmd: '\\mathbb', insert: '\\mathbb{R}', pkg: 'amssymb', detail: 'Blackboard bold symbol (R, N, Z, C)' },
  { cmd: '\\mathcal', insert: '\\mathcal{}', pkg: 'amssymb', detail: 'Calligraphic math letter' },
  { cmd: '\\leqslant', insert: '\\leqslant', pkg: 'amssymb', detail: 'Slanted less-than-or-equal' },
  { cmd: '\\geqslant', insert: '\\geqslant', pkg: 'amssymb', detail: 'Slanted greater-than-or-equal' },
  { cmd: '\\DeclarePairedDelimiter', insert: '\\DeclarePairedDelimiter{\\norm}{\\lVert}{\\rVert}', pkg: 'mathtools', detail: 'Paired delimiter macro' },
  // xepersian / fontspec / polyglossia
  { cmd: '\\settextfont', insert: '\\settextfont{Vazirmatn}', pkg: 'xepersian', detail: 'Set main Persian body font' },
  { cmd: '\\setlatintextfont', insert: '\\setlatintextfont{Source Serif 4}', pkg: 'xepersian', detail: 'Set Latin script font in XePersian' },
  { cmd: '\\lr', insert: '\\lr{}', pkg: 'xepersian', detail: 'Inline left-to-right English/Latin span' },
  { cmd: '\\rl', insert: '\\rl{}', pkg: 'xepersian', detail: 'Inline right-to-left Persian span' },
  { cmd: '\\KashidaOn', insert: '\\KashidaOn', pkg: 'xepersian', detail: 'Enable Persian Kashida justification' },
  { cmd: '\\DefaultMathsDigits', insert: '\\DefaultMathsDigits', pkg: 'xepersian', detail: 'Use default Persian math digits' },
  { cmd: '\\setmainfont', insert: '\\setmainfont{}', pkg: 'fontspec', detail: 'Select main OpenType font' },
  { cmd: '\\setdefaultlanguage', insert: '\\setdefaultlanguage{persian}', pkg: 'polyglossia', detail: 'Primary document language' },
  // graphicx / hyperref / booktabs / tikz / biblatex
  { cmd: '\\includegraphics', insert: '\\includegraphics[width=0.8\\textwidth]{}', pkg: 'graphicx', detail: 'Insert external image' },
  { cmd: '\\href', insert: '\\href{https://}{}', pkg: 'hyperref', detail: 'Clickable hyperlink with label' },
  { cmd: '\\url', insert: '\\url{https://}', pkg: 'hyperref', detail: 'Formatted URL link' },
  { cmd: '\\hypersetup', insert: '\\hypersetup{colorlinks=true, linkcolor=blue}', pkg: 'hyperref', detail: 'Configure PDF link colors' },
  { cmd: '\\toprule', insert: '\\toprule', pkg: 'booktabs', detail: 'Top horizontal rule in table' },
  { cmd: '\\midrule', insert: '\\midrule', pkg: 'booktabs', detail: 'Mid horizontal rule in table' },
  { cmd: '\\bottomrule', insert: '\\bottomrule', pkg: 'booktabs', detail: 'Bottom horizontal rule in table' },
  { cmd: '\\draw', insert: '\\draw[thick, ->] (0,0) -- (2,1);', pkg: 'tikz', detail: 'Draw TikZ path' },
  { cmd: '\\node', insert: '\\node at (0,0) {};', pkg: 'tikz', detail: 'Place TikZ labeled node' },
  { cmd: '\\addplot', insert: '\\addplot[smooth, blue] {x^2};', pkg: 'pgfplots', detail: 'Plot mathematical function or data' },
  { cmd: '\\textcolor', insert: '\\textcolor{blue}{}', pkg: 'xcolor', detail: 'Color inline text' },
  { cmd: '\\cite', insert: '\\cite{}', pkg: 'core', detail: 'Cite bibliography entry' },
  { cmd: '\\parencite', insert: '\\parencite{}', pkg: 'biblatex', detail: 'Parenthetical citation' },
  { cmd: '\\textcite', insert: '\\textcite{}', pkg: 'biblatex', detail: 'In-text author citation' },
  { cmd: '\\printbibliography', insert: '\\printbibliography', pkg: 'biblatex', detail: 'Render bibliography section' },
  { cmd: '\\lstset', insert: '\\lstset{basicstyle=\\ttfamily\\small, breaklines=true}', pkg: 'listings', detail: 'Configure code listing styles' },
];

export function extractUsedPackages(doc: string): Set<string> {
  const pkgs = new Set<string>(['core']);
  const regex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(doc)) !== null) {
    const names = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      pkgs.add(name);
    }
  }
  if (/\\documentclass(?:\[[^\]]*\])?\{beamer\}/.test(doc)) {
    pkgs.add('beamer');
  }
  return pkgs;
}

export function extractDocumentLabels(files: ProjectFile[], currentDoc?: string): string[] {
  const labels = new Set<string>();
  const sources = currentDoc ? [currentDoc, ...files.map((f) => f.content)] : files.map((f) => f.content);
  const regex = /\\label\{([^}]+)\}/g;
  for (const src of sources) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(src)) !== null) {
      if (m[1].trim()) labels.add(m[1].trim());
    }
  }
  return Array.from(labels);
}

export function extractBibKeys(files: ProjectFile[]): string[] {
  const keys = new Set<string>();
  const regex = /@[a-zA-Z]+\s*\{\s*([^,\s}]+)/g;
  for (const f of files) {
    if (f.language === 'bibtex' || f.name.endsWith('.bib')) {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(f.content)) !== null) {
        if (m[1].trim()) keys.add(m[1].trim());
      }
    }
  }
  return Array.from(keys);
}

export interface AutocompleteContext {
  from: number;
  to: number;
  items: LatexCompletionItem[];
}

export function getLatexSuggestions(
  doc: string,
  cursorPos: number,
  files: ProjectFile[] = []
): AutocompleteContext | null {
  const before = doc.slice(0, cursorPos);
  const usedPackages = extractUsedPackages(doc);

  // 1. Inside \usepackage{...}
  const pkgMatch = before.match(/\\usepackage(?:\[[^\]]*\])?\{(?:[^}]*,)?([a-zA-Z0-9_-]*)$/);
  if (pkgMatch) {
    const query = pkgMatch[1].toLowerCase();
    const from = cursorPos - pkgMatch[1].length;
    const items: LatexCompletionItem[] = PACKAGE_CATALOG.filter((p) =>
      p.name.toLowerCase().includes(query)
    ).map((p) => ({
      label: p.name,
      insertText: p.name,
      detail: p.description,
      pkg: 'package',
      kind: 'package',
    }));
    return items.length ? { from, to: cursorPos, items } : null;
  }

  // 2. Inside \begin{...} or \end{...}
  const envMatch = before.match(/\\(begin|end)\{([a-zA-Z0-9_*]*)$/);
  if (envMatch) {
    const isBegin = envMatch[1] === 'begin';
    const query = envMatch[2].toLowerCase();
    const from = cursorPos - envMatch[2].length;
    const items: LatexCompletionItem[] = ENVIRONMENT_CATALOG.filter((e) =>
      e.name.toLowerCase().includes(query)
    )
      .sort((a, b) => {
        const aActive = usedPackages.has(a.pkg) ? 0 : 1;
        const bActive = usedPackages.has(b.pkg) ? 0 : 1;
        return aActive - bActive;
      })
      .map((e) => ({
        label: e.name,
        insertText: isBegin ? e.snippet : `${e.name}}`,
        detail: `${e.detail} (${e.pkg})`,
        pkg: e.pkg,
        kind: 'environment',
      }));
    return items.length ? { from, to: cursorPos, items } : null;
  }

  // 3. Inside \ref{...} or \eqref{...}
  const refMatch = before.match(/\\(?:eq)?ref\{([^}]*)$/);
  if (refMatch) {
    const query = refMatch[1].toLowerCase();
    const from = cursorPos - refMatch[1].length;
    const labels = extractDocumentLabels(files, doc);
    const items: LatexCompletionItem[] = labels
      .filter((l) => l.toLowerCase().includes(query))
      .map((l) => ({
        label: l,
        insertText: l,
        detail: 'Document label target',
        pkg: 'ref',
        kind: 'reference',
      }));
    return items.length ? { from, to: cursorPos, items } : null;
  }

  // 4. Inside \cite{...} / \parencite{...} / \textcite{...}
  const citeMatch = before.match(/\\(?:paren|text)?cite(?:\[[^\]]*\])?\{(?:[^}]*,)?([^},]*)$/);
  if (citeMatch) {
    const query = citeMatch[1].toLowerCase();
    const from = cursorPos - citeMatch[1].length;
    const keys = extractBibKeys(files);
    const items: LatexCompletionItem[] = keys
      .filter((k) => k.toLowerCase().includes(query))
      .map((k) => ({
        label: k,
        insertText: k,
        detail: 'Bibliography entry',
        pkg: 'bib',
        kind: 'citation',
      }));
    return items.length ? { from, to: cursorPos, items } : null;
  }

  // 5. Command or Smart Snippet starting with backslash (\... or \snip:...)
  const cmdMatch = before.match(/(\\[a-zA-Z0-9:@*_-]*)$/);
  if (cmdMatch) {
    const query = cmdMatch[1].toLowerCase();
    const rawQuery = query.slice(1);
    const from = cursorPos - cmdMatch[1].length;

    const commandItems: LatexCompletionItem[] = COMMAND_CATALOG.filter((c) =>
      c.cmd.toLowerCase().startsWith(query)
    )
      .sort((a, b) => {
        const aLoaded = usedPackages.has(a.pkg) ? 0 : 1;
        const bLoaded = usedPackages.has(b.pkg) ? 0 : 1;
        if (aLoaded !== bLoaded) return aLoaded - bLoaded;
        return a.cmd.localeCompare(b.cmd);
      })
      .map((c) => ({
        label: c.cmd,
        insertText: c.insert,
        detail: usedPackages.has(c.pkg)
          ? `${c.detail} · ${c.pkg}`
          : `${c.detail} · requires ${c.pkg}`,
        pkg: c.pkg,
        kind: 'command',
      }));

    const snippetItems: LatexCompletionItem[] = SMART_SNIPPETS.filter((s) => {
      if (!rawQuery) return true;
      return (
        s.trigger.toLowerCase().includes(rawQuery) ||
        s.title.toLowerCase().includes(rawQuery) ||
        s.category.toLowerCase().includes(rawQuery)
      );
    })
      .sort((a, b) => {
        const aLoaded = a.packages.every((p) => usedPackages.has(p)) ? 0 : 1;
        const bLoaded = b.packages.every((p) => usedPackages.has(p)) ? 0 : 1;
        if (aLoaded !== bLoaded) return aLoaded - bLoaded;
        return a.trigger.localeCompare(b.trigger);
      })
      .map((s) => ({
        label: s.trigger,
        insertText: s.snippet,
        detail: `Snippet: ${s.title} (${s.packages.join(', ')})`,
        pkg: s.packages.join(', '),
        kind: 'snippet',
      }));

    const items = query.startsWith('\\snip')
      ? [...snippetItems, ...commandItems]
      : [...commandItems, ...snippetItems];

    return items.length ? { from, to: cursorPos, items } : null;
  }

  return null;
}
