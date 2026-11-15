export type SnippetCategory =
  | 'Bilingual & XePersian'
  | 'Math & Proofs'
  | 'Tables & Figures'
  | 'TikZ & Plots'
  | 'Document Scaffolds';

export interface SmartSnippet {
  id: string;
  title: string;
  trigger: string;
  category: SnippetCategory;
  packages: string[];
  description: string;
  snippet: string;
}

export const SMART_SNIPPETS: SmartSnippet[] = [
  {
    id: 'xepersian-callout',
    title: 'Bilingual Definition / Note Box',
    trigger: '\\snip:bilingual-box',
    category: 'Bilingual & XePersian',
    packages: ['xepersian', 'tcolorbox'],
    description: 'Framed Persian RTL callout box with inline Latin term support',
    snippet: `\\begin{tcolorbox}[title={نکته مهم (\\lr{Key Note})}]
  متن فارسی با عبارت لاتین \\lr{Algorithmic Complexity} و رابطه $O(n \\log n)$.
\\end{tcolorbox}`,
  },
  {
    id: 'xepersian-dual-caption',
    title: 'XePersian Font & Margin Setup',
    trigger: '\\snip:xepersian-setup',
    category: 'Bilingual & XePersian',
    packages: ['xepersian', 'geometry'],
    description: 'Standard A4 academic preamble with Vazirmatn & Source Serif fonts',
    snippet: `\\usepackage[margin=2.5cm]{geometry}
\\usepackage{xepersian}
\\settextfont{Vazirmatn}
\\setlatintextfont{Source Serif 4}
\\DefaultMathsDigits`,
  },
  {
    id: 'xepersian-latin-env',
    title: 'Embedded LTR Theorem in Persian',
    trigger: '\\snip:latin-block',
    category: 'Bilingual & XePersian',
    packages: ['xepersian', 'amsthm'],
    description: 'Clean LTR English block inside an RTL XePersian document',
    snippet: `\\begin{latin}
\\begin{theorem}[Spectral Decomposition]
  Every compact self-adjoint operator on a Hilbert space $H$ admits an orthonormal eigenbasis.
\\end{theorem}
\\end{latin}`,
  },
  {
    id: 'math-system-cases',
    title: 'Piecewise Function (Cases)',
    trigger: '\\snip:cases',
    category: 'Math & Proofs',
    packages: ['amsmath'],
    description: 'Piecewise mathematical definition inside numbered equation',
    snippet: `\\begin{equation}
  f(x) = \\begin{cases}
    x^2 \\sin(1/x) & \\text{if } x \\neq 0 \\\\
    0 & \\text{if } x = 0
  \\end{cases}
\\end{equation}`,
  },
  {
    id: 'math-aligned-derivation',
    title: 'Multi-Step Aligned Derivation',
    trigger: '\\snip:align',
    category: 'Math & Proofs',
    packages: ['amsmath', 'amssymb'],
    description: 'Aligned step-by-step algebraic derivation with annotations',
    snippet: `\\begin{align}
  \\|u + v\\|^2 &= \\langle u + v, u + v \\rangle \\\\
  &= \\|u\\|^2 + 2\\operatorname{Re}\\langle u, v \\rangle + \\|v\\|^2 \\\\
  &\\leqslant (\\|u\\| + \\|v\\|)^2
\\end{align}`,
  },
  {
    id: 'math-matrix-3x3',
    title: '3×3 Symmetric Matrix',
    trigger: '\\snip:matrix',
    category: 'Math & Proofs',
    packages: ['amsmath'],
    description: 'Square-bracket 3×3 matrix with determinant equation',
    snippet: `$$A = \\begin{bmatrix}
  \\lambda_1 & 0 & 0 \\\\
  0 & \\lambda_2 & 0 \\\\
  0 & 0 & \\lambda_3
\\end{bmatrix}, \\quad \\det(A) = \\prod_{i=1}^{3} \\lambda_i$$`,
  },
  {
    id: 'math-theorem-proof',
    title: 'Theorem + Proof Pair',
    trigger: '\\snip:theorem',
    category: 'Math & Proofs',
    packages: ['amsthm', 'amsmath'],
    description: 'Paired theorem statement and QED proof environment',
    snippet: `\\begin{theorem}
  Let $(X, d)$ be a complete metric space and $T: X \\to X$ a contraction. Then $T$ has a unique fixed point.
\\end{theorem}
\\begin{proof}
  Pick $x_0 \\in X$ and define $x_{n+1} = T(x_n)$. By induction, $d(x_n, x_{n+1}) \\leqslant k^n d(x_0, x_1)$.
\\end{proof}`,
  },
  {
    id: 'table-booktabs-benchmark',
    title: 'Booktabs Academic Table',
    trigger: '\\snip:table',
    category: 'Tables & Figures',
    packages: ['booktabs'],
    description: 'Clean 3-column scientific comparison table with booktabs rules',
    snippet: `\\begin{table}[htbp]
  \\centering
  \\caption{Comparison of Numerical Solvers}
  \\label{tab:solvers}
  \\begin{tabular}{lccc}
    \\toprule
    Method & Order & Error & Runtime (ms) \\\\
    \\midrule
    Euler & 1 & $4.2 \\times 10^{-2}$ & 1.8 \\\\
    RK4 & 4 & $1.1 \\times 10^{-6}$ & 4.5 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}`,
  },
  {
    id: 'figure-subfigures',
    title: 'Side-by-Side Dual Figure',
    trigger: '\\snip:dual-fig',
    category: 'Tables & Figures',
    packages: ['graphicx'],
    description: 'Two minipage panels sharing one floating figure environment',
    snippet: `\\begin{figure}[htbp]
  \\centering
  \\begin{minipage}{0.46\\textwidth}
    \\centering
    \\includegraphics[width=\\linewidth]{fig-a}
    \\caption{Training loss curve}
  \\end{minipage}
  \\hfill
  \\begin{minipage}{0.46\\textwidth}
    \\centering
    \\includegraphics[width=\\linewidth]{fig-b}
    \\caption{Validation accuracy}
  \\end{minipage}
\\end{figure}`,
  },
  {
    id: 'tikz-flowchart',
    title: 'TikZ Pipeline Flowchart',
    trigger: '\\snip:tikz-flow',
    category: 'TikZ & Plots',
    packages: ['tikz'],
    description: 'Horizontal 3-stage block diagram with arrows',
    snippet: `\\begin{figure}[htbp]
  \\centering
  \\begin{tikzpicture}[node distance=2.6cm, auto]
    \\node[draw, rounded corners, minimum width=2cm, minimum height=0.8cm] (in) {Input};
    \\node[draw, rounded corners, minimum width=2cm, minimum height=0.8cm, right of=in, xshift=1.2cm] (enc) {Encoder};
    \\node[draw, rounded corners, minimum width=2cm, minimum height=0.8cm, right of=enc, xshift=1.2cm] (out) {Output};
    \\draw[->, thick] (in) -- (enc);
    \\draw[->, thick] (enc) -- (out);
  \\end{tikzpicture}
  \\caption{System Architecture}
\\end{figure}`,
  },
  {
    id: 'pgfplots-2d',
    title: 'PGFPlots Smooth Function Plot',
    trigger: '\\snip:pgfplot',
    category: 'TikZ & Plots',
    packages: ['pgfplots'],
    description: '2D coordinate plot comparing two functions',
    snippet: `\\begin{tikzpicture}
  \\begin{axis}[
    xlabel={$x$},
    ylabel={$f(x)$},
    grid=major,
    legend pos=north west
  ]
    \\addplot[blue, thick, domain=-2:2, samples=80] {x^2};
    \\addlegendentry{$x^2$}
    \\addplot[red, dashed, thick, domain=-2:2, samples=80] {exp(x)};
    \\addlegendentry{$e^x$}
  \\end{axis}
\\end{tikzpicture}`,
  },
  {
    id: 'scaffold-abstract-keywords',
    title: 'Abstract & Keywords Section',
    trigger: '\\snip:abstract',
    category: 'Document Scaffolds',
    packages: ['core'],
    description: 'Structured paper abstract with italicized keywords line',
    snippet: `\\begin{abstract}
  Summarize the core problem, methodology, and principal quantitative finding in 3--4 concise sentences.
\\end{abstract}
\\noindent\\textbf{Keywords:} Spectral analysis, Bifurcation, Numerical PDEs`,
  },
];
