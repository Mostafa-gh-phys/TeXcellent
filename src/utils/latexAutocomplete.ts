import { ProjectFile } from '../types/latex';
import { SMART_SNIPPETS } from './smartSnippets';

export interface LatexCompletionItem {
  label: string;
  insertText: string;
  detail: string;
  pkg: string;
  kind: 'command' | 'environment' | 'package' | 'option' | 'reference' | 'citation' | 'snippet';
}

export const PACKAGE_CATALOG: Array<{ name: string; description: string }> = [
  { name: 'amsmath', description: 'AMS mathematical facilities & align environments' },
  { name: 'amssymb', description: 'Extended mathematical symbols & blackboard bold' },
  { name: 'mathtools', description: 'Mathematical tools extending amsmath' },
  { name: 'xepersian', description: 'Persian/Farsi typesetting for XeLaTeX' },
  { name: 'polyglossia', description: 'Modern multilingual typesetting for XeLaTeX/LuaLaTeX' },
  { name: 'fontspec', description: 'OpenType & TrueType font selection' },
  { name: 'babel', description: 'Multilingual hyphenation & localization support' },
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
  { name: 'enumitem', description: 'Custom itemize, enumerate & description spacing' },
  { name: 'microtype', description: 'Subliminal typographic protrusion & expansion' },
  { name: 'siunitx', description: 'SI units, scientific notation & number alignment' },
  { name: 'caption', description: 'Customize figure and table caption styling' },
  { name: 'subcaption', description: 'Subfigures and subtables with captions' },
  { name: 'float', description: 'Exact [H] float placement specifier' },
  { name: 'setspace', description: 'Single, one-and-a-half & double line spacing' },
  { name: 'parskip', description: 'Zero paragraph indent with vertical spacing' },
  { name: 'multicol', description: 'Balanced multi-column layouts' },
  { name: 'inputenc', description: 'Input character encoding (for PDFLaTeX)' },
  { name: 'fontenc', description: 'Output font encoding (T1/OT1)' },
];

export interface PackageOptionSpec {
  option: string;
  insert?: string;
  detail: string;
}

export const PACKAGE_OPTIONS_CATALOG: Record<string, PackageOptionSpec[]> = {
  geometry: [
    { option: 'a4paper', detail: 'ISO A4 page dimensions (210mm x 297mm)' },
    { option: 'letterpaper', detail: 'US Letter page dimensions (8.5in x 11in)' },
    { option: 'a5paper', detail: 'ISO A5 page dimensions' },
    { option: 'b5paper', detail: 'ISO B5 page dimensions' },
    { option: 'margin=1in', detail: 'Equal 1-inch margins on all sides' },
    { option: 'margin=2.5cm', detail: 'Equal 2.5cm margins on all sides' },
    { option: 'top=2.5cm', detail: 'Top page margin' },
    { option: 'bottom=2.5cm', detail: 'Bottom page margin' },
    { option: 'left=2.5cm', detail: 'Left page margin' },
    { option: 'right=2.5cm', detail: 'Right page margin' },
    { option: 'inner=3cm', detail: 'Inner binding margin (twoside)' },
    { option: 'outer=2cm', detail: 'Outer margin (twoside)' },
    { option: 'landscape', detail: 'Rotate page to landscape orientation' },
    { option: 'portrait', detail: 'Standard portrait orientation' },
    { option: 'twoside', detail: 'Alternating inner/outer margins for printing' },
    { option: 'includehead', detail: 'Include header height inside margin' },
    { option: 'includefoot', detail: 'Include footer height inside margin' },
    { option: 'headheight=14pt', detail: 'Header box height (useful with fancyhdr)' },
    { option: 'footskip=24pt', detail: 'Distance from text body to footer baseline' },
    { option: 'showframe', detail: 'Draw visible layout guides around margins' },
    { option: 'pass', detail: 'Disable geometry layout overrides' },
  ],
  hyperref: [
    { option: 'colorlinks=true', detail: 'Color link text instead of drawing boxes' },
    { option: 'colorlinks=false', detail: 'Draw boxes around links (default)' },
    { option: 'hidelinks', detail: 'Hide both link colors and border boxes' },
    { option: 'linkcolor=blue', detail: 'Color for internal cross-reference links' },
    { option: 'citecolor=teal', detail: 'Color for bibliography citations' },
    { option: 'urlcolor=blue', detail: 'Color for external URLs' },
    { option: 'filecolor=magenta', detail: 'Color for local file links' },
    { option: 'bookmarks=true', detail: 'Generate PDF outline bookmarks' },
    { option: 'bookmarksopen=true', detail: 'Expand PDF bookmark tree by default' },
    { option: 'bookmarksnumbered=true', detail: 'Include section numbers in PDF bookmarks' },
    { option: 'breaklinks=true', detail: 'Allow long URLs/links to wrap across lines' },
    { option: 'unicode=true', detail: 'Enable Unicode PDF bookmarks (XePersian/UTF-8)' },
    { option: 'pdftitle={}', detail: 'Embed PDF document title metadata' },
    { option: 'pdfauthor={}', detail: 'Embed PDF document author metadata' },
    { option: 'pdfsubject={}', detail: 'Embed PDF subject metadata' },
    { option: 'draft', detail: 'Disable hyperlinking during draft builds' },
  ],
  xepersian: [
    { option: 'KashidaOn', detail: 'Enable Persian Kashida text justification' },
    { option: 'KashidaOff', detail: 'Disable Kashida justification' },
    { option: 'extrafootnotefeatures', detail: 'Enable RTL/LTR multi-column footnote helpers' },
    { option: 'localise=on', detail: 'Localize captions, dates & section strings to Persian' },
    { option: 'localise=off', detail: 'Keep standard English localization strings' },
    { option: 'quickindex', detail: 'Faster Persian index sorting support' },
    { option: 'compute', detail: 'Enable built-in Persian arithmetic/date helpers' },
    { option: 'displaymathdigits=persian', detail: 'Render display math numerals with Persian digits' },
    { option: 'displaymathdigits=default', detail: 'Keep Western/default digits in display math' },
  ],
  xcolor: [
    { option: 'dvipsnames', detail: 'Load 68 standard named dvips colors (NavyBlue, OliveGreen...)' },
    { option: 'svgnames', detail: 'Load 151 SVG 1.1 named colors' },
    { option: 'x11names', detail: 'Load 317 X11 named colors' },
    { option: 'table', detail: 'Enable \\rowcolor, \\columncolor & \\cellcolor in tables' },
    { option: 'HTML', detail: 'Define colors using 6-digit hex codes' },
    { option: 'rgb', detail: 'Default RGB color model' },
    { option: 'cmyk', detail: 'CMYK print color model' },
    { option: 'gray', detail: 'Grayscale monochrome output' },
    { option: 'hyperref', detail: 'Enable xcolor integration with hyperref' },
  ],
  graphicx: [
    { option: 'final', detail: 'Render full images (overrides document draft)' },
    { option: 'draft', detail: 'Draw framed bounding boxes instead of images' },
    { option: 'demo', detail: 'Replace missing/all images with black rectangles' },
    { option: 'hiresbb', detail: 'Read HiResBoundingBox from EPS/PDF files' },
    { option: 'pdftex', detail: 'Explicit PDFTeX graphics driver' },
    { option: 'xetex', detail: 'Explicit XeTeX graphics driver' },
    { option: 'luatex', detail: 'Explicit LuaTeX graphics driver' },
  ],
  babel: [
    { option: 'english', detail: 'English hyphenation and labels' },
    { option: 'persian', detail: 'Persian language rules' },
    { option: 'arabic', detail: 'Arabic language rules' },
    { option: 'french', detail: 'French typography & spacing' },
    { option: 'ngerman', detail: 'New German orthography' },
    { option: 'spanish', detail: 'Spanish labels & hyphenation' },
    { option: 'main=english', detail: 'Set English as primary document language' },
    { option: 'provide=*', detail: 'Auto-load INI definitions for languages' },
  ],
  fontspec: [
    { option: 'no-math', detail: 'Leave TeX math fonts untouched' },
    { option: 'quiet', detail: 'Suppress font warning messages in log' },
    { option: 'silent', detail: 'Suppress font warnings and info messages' },
    { option: 'cm-default', detail: 'Keep Computer Modern math font defaults' },
    { option: 'lm-default', detail: 'Use Latin Modern defaults' },
  ],
  polyglossia: [
    { option: 'xetex', detail: 'XeTeX engine mode' },
    { option: 'luatex', detail: 'LuaTeX engine mode' },
  ],
  biblatex: [
    { option: 'backend=biber', detail: 'Use modern Unicode Biber backend (recommended)' },
    { option: 'backend=bibtex', detail: 'Use legacy BibTeX backend' },
    { option: 'style=numeric', detail: 'Numeric citation style [1], [2]' },
    { option: 'style=ieee', detail: 'IEEE citation & bibliography style' },
    { option: 'style=apa', detail: 'APA author-year bibliography style' },
    { option: 'style=authoryear', detail: 'Author-year citation style' },
    { option: 'style=alphabetic', detail: 'Alphabetic citation labels [Rud87]' },
    { option: 'sorting=none', detail: 'Sort bibliography in order of citation' },
    { option: 'sorting=nyt', detail: 'Sort by name, year, title' },
    { option: 'sortcites=true', detail: 'Sort multiple keys inside \\cite{...}' },
    { option: 'natbib=true', detail: 'Enable \\citep / \\citet compatibility aliases' },
    { option: 'hyperref=true', detail: 'Turn citations into clickable links' },
    { option: 'backref=true', detail: 'Show back-reference pages in bibliography' },
    { option: 'giveninits=true', detail: 'Abbreviate author first names to initials' },
  ],
  natbib: [
    { option: 'numbers', detail: 'Use numeric citations [1]' },
    { option: 'authoryear', detail: 'Use author-year citations (default)' },
    { option: 'super', detail: 'Superscript citation numbers' },
    { option: 'round', detail: 'Round parentheses (Author, 2026)' },
    { option: 'square', detail: 'Square brackets [Author, 2026]' },
    { option: 'sort', detail: 'Sort multiple citations' },
    { option: 'sort&compress', detail: 'Sort and compress consecutive numbers [1-4]' },
    { option: 'comma', detail: 'Separate multiple citations with commas' },
    { option: 'sectionbib', detail: 'Format bibliography as \\section* instead of chapter' },
  ],
  amsmath: [
    { option: 'fleqn', detail: 'Flush display equations left instead of centered' },
    { option: 'leqno', detail: 'Place equation numbers on the left' },
    { option: 'reqno', detail: 'Place equation numbers on the right (default)' },
    { option: 'intlimits', detail: 'Place integral limits above/below \\int' },
    { option: 'nointlimits', detail: 'Place integral limits beside \\int' },
    { option: 'sumlimits', detail: 'Place summation limits above/below \\sum' },
    { option: 'centertags', detail: 'Center equation number in split equations' },
    { option: 'tbtags', detail: 'Align equation number with top/bottom line of split' },
  ],
  mathtools: [
    { option: 'showonlyrefs', detail: 'Number only equations actually referenced by \\eqref' },
    { option: 'fleqn', detail: 'Flush equations left' },
    { option: 'tbtags', detail: 'Top-or-bottom equation tag alignment' },
  ],
  tcolorbox: [
    { option: 'most', detail: 'Load commonly used libraries (skins, breakable, theorems...)' },
    { option: 'all', detail: 'Load all tcolorbox libraries' },
    { option: 'skins', detail: 'Enable enhanced vector skins & shadows' },
    { option: 'breakable', detail: 'Allow colored boxes to break across pages' },
    { option: 'theorems', detail: 'Enable numbered theorem box helpers' },
    { option: 'listings', detail: 'Integrate code listings inside tcolorbox' },
  ],
  algorithm2e: [
    { option: 'ruled', detail: 'Draw horizontal rules at top & bottom of algorithm' },
    { option: 'vlined', detail: 'Draw vertical block-ending L-lines' },
    { option: 'boxed', detail: 'Enclose algorithm inside a frame box' },
    { option: 'linesnumbered', detail: 'Print line numbers on each step' },
    { option: 'commentsnumbered', detail: 'Number comment lines too' },
    { option: 'longend', detail: 'Show explicit end-if / end-for statements' },
  ],
  inputenc: [
    { option: 'utf8', detail: 'UTF-8 Unicode input encoding' },
    { option: 'latin1', detail: 'ISO-8859-1 Western encoding' },
  ],
  fontenc: [
    { option: 'T1', detail: 'Modern 8-bit Cork font encoding (PDFLaTeX)' },
    { option: 'OT1', detail: 'Original 7-bit TeX font encoding' },
    { option: 'TU', detail: 'Unicode encoding for XeLaTeX/LuaLaTeX' },
  ],
  enumitem: [
    { option: 'inline', detail: 'Provide enumerate*, itemize*, description* inline lists' },
    { option: 'shortlabels', detail: 'Support short label syntax like [a)] or [1.]' },
  ],
  microtype: [
    { option: 'final', detail: 'Enable microtypography in final mode' },
    { option: 'draft', detail: 'Disable microtype during draft builds' },
    { option: 'expansion=true', detail: 'Enable font expansion for cleaner justification' },
    { option: 'protrusion=true', detail: 'Enable hanging punctuation margin protrusion' },
    { option: 'babel=true', detail: 'Automatically adapt settings to active language' },
  ],
  siunitx: [
    { option: 'per-mode=symbol', detail: 'Display units with slash (m/s)' },
    { option: 'per-mode=fraction', detail: 'Display units as fractions' },
    { option: 'separate-uncertainty=true', detail: 'Format errors with ± symbol' },
    { option: 'detect-all', detail: 'Match surrounding text weight and font family' },
    { option: 'locale=US', detail: 'Use dot decimal marker' },
  ],
  caption: [
    { option: 'font=small', detail: 'Use smaller font size for captions' },
    { option: 'labelfont=bf', detail: 'Make Figure/Table label bold' },
    { option: 'format=hang', detail: 'Indent wrapped caption lines past label' },
    { option: 'justification=centering', detail: 'Center caption text' },
    { option: 'labelsep=colon', detail: 'Use colon after Figure/Table number' },
  ],
  subcaption: [
    { option: 'labelformat=parens', detail: 'Format subfigure labels as (a), (b)' },
    { option: 'labelfont=rm', detail: 'Use upright label font' },
  ],
  setspace: [
    { option: 'singlespacing', detail: 'Standard single line spacing' },
    { option: 'onehalfspacing', detail: '1.5x line spacing' },
    { option: 'doublespacing', detail: '2x double line spacing' },
    { option: 'nodisplayskipstretch', detail: 'Keep math display vertical spacing compact' },
  ],
  parskip: [
    { option: 'parfill', detail: 'Ensure last line of paragraph ends cleanly' },
    { option: 'skip=0.5\\baselineskip', detail: 'Custom vertical space between paragraphs' },
    { option: 'indent=0pt', detail: 'Set paragraph first-line indentation' },
  ],
  pgfplots: [
    { option: 'compat=1.18', detail: 'Enable modern PGFPlots 1.18 axis/label placement' },
    { option: 'compat=newest', detail: 'Use newest installed PGFPlots features' },
  ],
  tikz: [
    { option: 'babel', detail: 'Protect active characters inside TikZ nodes when using babel' },
  ],
  listings: [
    { option: 'final', detail: 'Render code listings in final mode' },
    { option: 'draft', detail: 'Skip rendering listings in draft mode' },
  ],
  fancyhdr: [
    { option: 'nocheck', detail: 'Suppress headheight checks' },
  ],
  multicol: [
    { option: 'colaction', detail: 'Enable column-aware action hooks' },
  ],
};

export const DOCUMENTCLASS_OPTIONS: PackageOptionSpec[] = [
  { option: '10pt', detail: '10pt base document font size' },
  { option: '11pt', detail: '11pt base document font size' },
  { option: '12pt', detail: '12pt base document font size' },
  { option: 'a4paper', detail: 'A4 paper format' },
  { option: 'letterpaper', detail: 'US Letter paper format' },
  { option: 'a5paper', detail: 'A5 paper format' },
  { option: 'twocolumn', detail: 'Two-column layout' },
  { option: 'onecolumn', detail: 'Single-column layout' },
  { option: 'twoside', detail: 'Two-sided book/report layout' },
  { option: 'oneside', detail: 'One-sided layout' },
  { option: 'landscape', detail: 'Landscape page orientation' },
  { option: 'fleqn', detail: 'Left-aligned display equations' },
  { option: 'leqno', detail: 'Equation numbers on the left' },
  { option: 'openright', detail: 'Start chapters on odd/right pages' },
  { option: 'openany', detail: 'Start chapters on any page' },
  { option: 'titlepage', detail: 'Place title/author on dedicated page' },
  { option: 'draft', detail: 'Mark overfull boxes & placeholder images' },
  { option: 'final', detail: 'Final production mode' },
];

export const COMMAND_OPTION_CATALOG: Record<string, PackageOptionSpec[]> = {
  includegraphics: [
    { option: 'width=0.8\\textwidth', detail: 'Scale graphic relative to text width' },
    { option: 'width=\\linewidth', detail: 'Fit graphic to current line width' },
    { option: 'height=6cm', detail: 'Set explicit graphic height' },
    { option: 'scale=0.75', detail: 'Scale graphic proportionally' },
    { option: 'keepaspectratio', detail: 'Preserve aspect ratio when setting width & height' },
    { option: 'angle=90', detail: 'Rotate graphic counterclockwise in degrees' },
    { option: 'page=1', detail: 'Select page number from multi-page PDF' },
    { option: 'trim=0 0 0 0,clip', detail: 'Crop left bottom right top margins' },
  ],
  figure: [
    { option: 'htbp', detail: 'Place here, top, bottom, or float page' },
    { option: 'H', detail: 'Exact placement here (requires float package)' },
    { option: '!htbp', detail: 'Force placement ignoring strict float limits' },
    { option: 't', detail: 'Top of page' },
    { option: 'b', detail: 'Bottom of page' },
    { option: 'p', detail: 'Dedicated float page' },
  ],
  table: [
    { option: 'htbp', detail: 'Place here, top, bottom, or float page' },
    { option: 'H', detail: 'Exact placement here (requires float package)' },
    { option: '!htbp', detail: 'Force placement ignoring strict float limits' },
  ],
  lstlisting: [
    { option: 'language=Python', detail: 'Python syntax highlighting' },
    { option: 'language=C++', detail: 'C++ syntax highlighting' },
    { option: 'language=TeX', detail: 'LaTeX syntax highlighting' },
    { option: 'basicstyle=\\ttfamily\\small', detail: 'Monospace font size & family' },
    { option: 'breaklines=true', detail: 'Wrap long code lines automatically' },
    { option: 'frame=single', detail: 'Draw single border box around listing' },
    { option: 'numbers=left', detail: 'Show line numbers on the left' },
    { option: 'caption={}', detail: 'Listing caption title' },
    { option: 'label={lst:}', detail: 'Cross-reference label' },
  ],
  tcolorbox: [
    { option: 'title={}', detail: 'Title bar text for box' },
    { option: 'colback=blue!5!white', detail: 'Box background color' },
    { option: 'colframe=blue!60!black', detail: 'Box border & title bar color' },
    { option: 'breakable', detail: 'Allow box to split across page breaks' },
    { option: 'enhanced', detail: 'Enable advanced skin styling' },
  ],
  draw: [
    { option: '->', detail: 'Forward arrow tip' },
    { option: '<->', detail: 'Double-headed arrow' },
    { option: 'thick', detail: 'Thicker stroke width' },
    { option: 'dashed', detail: 'Dashed stroke style' },
    { option: 'dotted', detail: 'Dotted stroke style' },
    { option: 'blue', detail: 'Blue stroke color' },
    { option: 'rounded corners', detail: 'Round path vertices' },
  ],
};

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

function buildOptionSuggestions(
  specs: Array<PackageOptionSpec & { pkgName?: string }>,
  existingSegment: string,
  cursorPos: number,
  fallbackPkgLabel: string
): AutocompleteContext | null {
  const parts = existingSegment.split(',');
  const rawToken = parts[parts.length - 1] ?? '';
  const leadingSpaces = rawToken.length - rawToken.trimStart().length;
  const query = rawToken.trim().toLowerCase();
  const from = cursorPos - (rawToken.length - leadingSpaces);

  const alreadyUsed = new Set(
    parts
      .slice(0, -1)
      .map((p) => p.trim().toLowerCase().split('=')[0])
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const items: LatexCompletionItem[] = [];
  for (const spec of specs) {
    const key = spec.option.toLowerCase();
    const baseKey = key.split('=')[0];
    if (alreadyUsed.has(baseKey) || seen.has(key)) continue;
    if (query && !key.includes(query) && !spec.detail.toLowerCase().includes(query)) continue;
    seen.add(key);
    const pkgTag = spec.pkgName || fallbackPkgLabel;
    items.push({
      label: spec.option,
      insertText: spec.insert || spec.option,
      detail: spec.pkgName ? `${spec.detail} (${spec.pkgName})` : spec.detail,
      pkg: pkgTag,
      kind: 'option',
    });
  }
  return items.length ? { from, to: cursorPos, items } : null;
}

export function getLatexSuggestions(
  doc: string,
  cursorPos: number,
  files: ProjectFile[] = []
): AutocompleteContext | null {
  const before = doc.slice(0, cursorPos);
  const after = doc.slice(cursorPos);
  const usedPackages = extractUsedPackages(doc);

  // 1a. Inside \usepackage[...]{pkg} or \usepackage[...] (package options)
  const pkgOptMatch = before.match(/\\usepackage\[([^\[\]{}\n]*)$/);
  if (pkgOptMatch) {
    const afterPkgMatch = after.match(/^[^\[\]{}\n]*\]\s*\{([^}]*)\}/);
    const targetPackages = afterPkgMatch
      ? afterPkgMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (targetPackages.length > 0) {
      const targetSpecs: Array<PackageOptionSpec & { pkgName?: string }> = [];
      for (const pkgName of targetPackages) {
        const pkgSpecs = PACKAGE_OPTIONS_CATALOG[pkgName] || [];
        for (const spec of pkgSpecs) {
          targetSpecs.push({ ...spec, pkgName });
        }
      }
      if (targetSpecs.length > 0) {
        return buildOptionSuggestions(targetSpecs, pkgOptMatch[1], cursorPos, targetPackages[0]);
      }
    }

    // Package name not typed yet after ]: suggest options across known packages (prioritizing active packages)
    const allSpecs: Array<PackageOptionSpec & { pkgName?: string }> = [];
    const sortedPkgNames = Object.keys(PACKAGE_OPTIONS_CATALOG).sort((a, b) => {
      const aUsed = usedPackages.has(a) ? 0 : 1;
      const bUsed = usedPackages.has(b) ? 0 : 1;
      return aUsed - bUsed || a.localeCompare(b);
    });
    for (const pkgName of sortedPkgNames) {
      for (const spec of PACKAGE_OPTIONS_CATALOG[pkgName]) {
        allSpecs.push({ ...spec, pkgName });
      }
    }
    return buildOptionSuggestions(allSpecs, pkgOptMatch[1], cursorPos, 'option');
  }

  // 1b. Inside \PassOptionsToPackage{...}{pkg}
  const passOptMatch = before.match(/\\PassOptionsToPackage\{([^{}\n]*)$/);
  if (passOptMatch) {
    const afterPassPkg = after.match(/^[^{}\n]*\}\s*\{([^}]*)\}/);
    const pkgName = afterPassPkg?.[1]?.trim();
    if (pkgName && PACKAGE_OPTIONS_CATALOG[pkgName]) {
      return buildOptionSuggestions(
        PACKAGE_OPTIONS_CATALOG[pkgName].map((s) => ({ ...s, pkgName })),
        passOptMatch[1],
        cursorPos,
        pkgName
      );
    }
  }

  // 1c. Inside \documentclass[...]{...}
  const docClassOptMatch = before.match(/\\documentclass\[([^\[\]{}\n]*)$/);
  if (docClassOptMatch) {
    return buildOptionSuggestions(DOCUMENTCLASS_OPTIONS, docClassOptMatch[1], cursorPos, 'documentclass');
  }

  // 1d. Inside \hypersetup{...}, \geometry{...}, \lstset{...}
  const setupMatch = before.match(/\\(hypersetup|geometry|lstset)\{([^{}\n]*)$/);
  if (setupMatch) {
    const setupCmd = setupMatch[1];
    const specs =
      setupCmd === 'hypersetup'
        ? PACKAGE_OPTIONS_CATALOG.hyperref
        : setupCmd === 'geometry'
          ? PACKAGE_OPTIONS_CATALOG.geometry
          : COMMAND_OPTION_CATALOG.lstlisting;
    if (specs) {
      return buildOptionSuggestions(
        specs.map((s) => ({ ...s, pkgName: setupCmd })),
        setupMatch[2],
        cursorPos,
        setupCmd
      );
    }
  }

  // 1e. Inside \includegraphics[...], \draw[...], or \begin{env}[...]
  const cmdBracketMatch = before.match(/\\(includegraphics|draw)\[([^\[\]{}\n]*)$/);
  if (cmdBracketMatch) {
    const cmdName = cmdBracketMatch[1];
    const specs = COMMAND_OPTION_CATALOG[cmdName];
    if (specs) {
      return buildOptionSuggestions(specs, cmdBracketMatch[2], cursorPos, cmdName);
    }
  }
  const envBracketMatch = before.match(/\\begin\{([a-zA-Z0-9_*]+)\}\[([^\[\]{}\n]*)$/);
  if (envBracketMatch) {
    const envName = envBracketMatch[1];
    const specs = COMMAND_OPTION_CATALOG[envName];
    if (specs) {
      return buildOptionSuggestions(specs, envBracketMatch[2], cursorPos, envName);
    }
  }

  // 1f. Inside \usepackage{...} (package names)
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
