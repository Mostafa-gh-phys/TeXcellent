import { LatexProject } from '../types/latex';

export interface ProjectTemplate {
  id: string;
  name: string;
  subtitle: string;
  project: Omit<LatexProject, 'id' | 'updatedAt'>;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'bilingual-xepersian',
    name: 'Bilingual Persian & Math Notes',
    subtitle: 'XeLaTeX · XePersian · Mixed RTL/LTR & AMSMath',
    project: {
      name: 'Mathematical Analysis Notes',
      mainFileId: 'main-tex',
      compilerMode: 'xelatex',
      distribution: 'texlive-2025',
      edition: 'full',
      files: [
        {
          id: 'main-tex',
          name: 'main.tex',
          language: 'latex',
          updatedAt: '2026-11-15T12:00:00Z',
          content: `\\documentclass[12pt,a4paper]{article}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{xepersian}

% Safe cross-platform font selection with automatic fallback
\\IfFontExistsTF{Vazirmatn}{\\settextfont{Vazirmatn}}{%
  \\IfFontExistsTF{XB Niloofar}{\\settextfont{XB Niloofar}}{%
    \\IfFontExistsTF{IRLotus}{\\settextfont{IRLotus}}{%
      \\IfFontExistsTF{Noto Naskh Arabic}{\\settextfont{Noto Naskh Arabic}}{%
        \\IfFontExistsTF{Amiri}{\\settextfont{Amiri}}{%
          \\IfFontExistsTF{Tahoma}{\\settextfont{Tahoma}}{\\settextfont{DejaVu Sans}}%
        }%
      }%
    }%
  }%
}
\\IfFontExistsTF{Source Serif 4}{\\setlatintextfont{Source Serif 4}}{%
  \\IfFontExistsTF{Latin Modern Roman}{\\setlatintextfont{Latin Modern Roman}}{%
    \\setlatintextfont{DejaVu Serif}%
  }%
}

\\title{یادداشت‌های آنالیز ریاضی و فضاهای هیلبرت}
\\author{گروه ریاضی کاربردی}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{درس اول: نابرابری کوشی-شوارتز}
\\label{sec:cauchy}

در هر فضای ضرب داخلی حقیقی یا مختلط، برای هر دو بردار $u, v \\in H$ همواره نامساوی بنیادین \\lr{Cauchy-Schwarz} برقرار است:
$$|\\langle u, v \\rangle| \\leqslant \\|u\\| \\cdot \\|v\\|$$

این قضیه یکی از پرکاربردترین ابزارها در \\textbf{آنالیز تابعی} و \\lr{Quantum Mechanics} به شمار می‌رود. برای مثال، انتگرال گاوسی زیر در نظریه احتمالات نقش محوری دارد:
\\begin{equation}
  \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
\\end{equation}

\\subsection{خواص کلیدی ضرب داخلی}
\\begin{itemize}
  \\item خاصیت مثبت معین بودن: $\\langle x, x \\rangle \\geqslant 0$ و تساوی تنها برای $x = 0$ برقرار است.
  \\item خاصیت همگنی خطی در مولفه اول و تقارن مزدوج در فضاهای مختلط.
  \\item کاربرد مستقیم در اثبات نامساوی مثلثی $\\|u + v\\| \\leqslant \\|u\\| + \\|v\\|$.
\\end{itemize}

\\section{جدول مقایسه موتورهای حروف‌چینی}
\\begin{table}[htbp]
  \\centering
  \\caption{مقایسه موتورهای کامپایل در TeXcellent}
  \\begin{tabular}{lcc}
    \\toprule
    Engine & Unicode / RTL & Speed \\\\
    \\midrule
    XeLaTeX & Native OpenType & Fast \\\\
    LuaLaTeX & Lua + OpenType & Moderate \\\\
    PDFLaTeX & 8-bit / Legacy & Very Fast \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

برای اطلاعات بیشتر به بخش \\ref{sec:cauchy} یا مرجع \\cite{rudin1987} مراجعه کنید.
\\end{document}
`,
        },
        {
          id: 'refs-bib',
          name: 'references.bib',
          language: 'bibtex',
          updatedAt: '2026-11-15T12:00:00Z',
          content: `@book{rudin1987,
  author    = {Walter Rudin},
  title     = {Real and Complex Analysis},
  edition   = {3rd},
  publisher = {McGraw-Hill},
  year      = {1987}
}

@article{einstein1905,
  author  = {Albert Einstein},
  title   = {Zur Elektrodynamik bewegter K{\\"o}rper},
  journal = {Annalen der Physik},
  year    = {1905},
  volume  = {322},
  pages   = {891--921}
}
`,
        },
      ],
    },
  },
  {
    id: 'ieee-paper',
    name: 'Academic Research Paper',
    subtitle: 'PDFLaTeX · AMSMath · Booktabs & Theorems',
    project: {
      name: 'Spectral Graph Convergence',
      mainFileId: 'main-tex',
      compilerMode: 'pdflatex',
      distribution: 'texlive-2025',
      edition: 'full',
      files: [
        {
          id: 'main-tex',
          name: 'main.tex',
          language: 'latex',
          updatedAt: '2026-11-15T12:00:00Z',
          content: `\\documentclass[11pt,a4paper]{article}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{booktabs}
\\usepackage{hyperref}

\\title{Spectral Convergence of Discrete Laplacians on Manifolds}
\\author{Elena Rostova \\and Marcus Chen}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
\\label{sec:intro}
We study the asymptotic behavior of normalized graph Laplacians $L_n$ constructed from $n$ i.i.d. samples on a compact Riemannian manifold $\\mathcal{M}$.

\\begin{theorem}
Let $\\lambda_k(L_n)$ denote the $k$-th smallest eigenvalue of the normalized graph Laplacian. With probability at least $1 - O(n^{-2})$,
$$|\\lambda_k(L_n) - \\lambda_k(\\Delta_{\\mathcal{M}})| \\leqslant C \\left(\\frac{\\log n}{n}\\right)^{\\frac{1}{d+4}}$$
\\end{theorem}

\\section{Empirical Benchmarks}
\\begin{table}[htbp]
  \\centering
  \\caption{Eigenvalue Approximation Error Across Sample Sizes}
  \\begin{tabular}{lcc}
    \\toprule
    Samples ($n$) & Relative Error & Runtime (s) \\\\
    \\midrule
    1,000 & 0.0412 & 0.18 \\\\
    10,000 & 0.0158 & 1.42 \\\\
    100,000 & 0.0061 & 11.84 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

As shown in Section \\ref{sec:intro}, convergence aligns with the theoretical rate predicted in \\cite{belkin2008}.
\\end{document}
`,
        },
        {
          id: 'refs-bib',
          name: 'references.bib',
          language: 'bibtex',
          updatedAt: '2026-11-15T12:00:00Z',
          content: `@article{belkin2008,
  author  = {Mikhail Belkin and Partha Niyogi},
  title   = {Towards a theoretical foundation for Laplacian-based manifold methods},
  journal = {Journal of Computer and System Sciences},
  year    = {2008},
  volume  = {74},
  pages   = {1289--1308}
}
`,
        },
      ],
    },
  },
  {
    id: 'beamer-slides',
    name: 'Beamer Presentation Deck',
    subtitle: 'LuaLaTeX · Presentation Frames & Math',
    project: {
      name: 'Transformer Attention Geometry',
      mainFileId: 'main-tex',
      compilerMode: 'lualatex',
      distribution: 'miktex-24',
      edition: 'medium',
      files: [
        {
          id: 'main-tex',
          name: 'slides.tex',
          language: 'latex',
          updatedAt: '2026-11-15T12:00:00Z',
          content: `\\documentclass{beamer}
\\usepackage{amsmath,amssymb}

\\title{Geometry of Multi-Head Attention}
\\author{TeXcellent Research Group}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{frame}{Scaled Dot-Product Attention}
Given queries $Q$, keys $K$, and values $V$, attention weights follow:
$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$
\\end{frame}

\\begin{frame}{Key Takeaways}
\\begin{itemize}
  \\item Variance stabilization via $\\sqrt{d_k}$ scaling prevents softmax saturation.
  \\item Orthogonal head projections span complementary subspaces.
\\end{itemize}
\\end{frame}
\\end{document}
`,
        },
      ],
    },
  },
];

export function createInitialProject(): LatexProject {
  const tpl = PROJECT_TEMPLATES[0].project;
  return {
    id: 'proj-default',
    ...tpl,
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialProjects(): LatexProject[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'proj-default',
      ...PROJECT_TEMPLATES[0].project,
      updatedAt: now,
    },
    {
      id: 'proj-research-paper',
      ...PROJECT_TEMPLATES[1].project,
      updatedAt: now,
    },
  ];
}

const LEGACY_BROKEN_FONTS = `\\settextfont{Vazirmatn}\n\\setlatintextfont{Source Serif 4}`;
const SAFE_FONT_BLOCK = `% Safe cross-platform font selection with automatic fallback
\\IfFontExistsTF{Vazirmatn}{\\settextfont{Vazirmatn}}{%
  \\IfFontExistsTF{XB Niloofar}{\\settextfont{XB Niloofar}}{%
    \\IfFontExistsTF{IRLotus}{\\settextfont{IRLotus}}{%
      \\IfFontExistsTF{Noto Naskh Arabic}{\\settextfont{Noto Naskh Arabic}}{%
        \\IfFontExistsTF{Amiri}{\\settextfont{Amiri}}{%
          \\IfFontExistsTF{Tahoma}{\\settextfont{Tahoma}}{\\settextfont{DejaVu Sans}}%
        }%
      }%
    }%
  }%
}
\\IfFontExistsTF{Source Serif 4}{\\setlatintextfont{Source Serif 4}}{%
  \\IfFontExistsTF{Latin Modern Roman}{\\setlatintextfont{Latin Modern Roman}}{%
    \\setlatintextfont{DejaVu Serif}%
  }%
}`;

export function migrateLegacyDefaultProject(project: LatexProject): LatexProject {
  let changed = false;
  const nextFiles = project.files.map((file) => {
    if (file.name.endsWith('.tex') && file.content.includes(LEGACY_BROKEN_FONTS)) {
      changed = true;
      return {
        ...file,
        content: file.content.replace(LEGACY_BROKEN_FONTS, SAFE_FONT_BLOCK),
      };
    }
    return file;
  });
  return changed ? { ...project, files: nextFiles } : project;
}
