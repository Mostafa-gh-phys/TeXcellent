import { parseLatexDocument, ParsedInlineSegment } from './latexParser';

export interface MarkdownToLatexOptions {
  includePreamble?: boolean;
  title?: string;
}

function convertInlineMarkdownToLatex(text: string): string {
  const placeholders: string[] = [];
  const stash = (latexValue: string) => {
    const idx = placeholders.length;
    placeholders.push(latexValue);
    return `\uE000TEX${idx}\uE001`;
  };

  // Preserve inline math $...$ before escaping
  let tokenized = text.replace(/\$([^$]+)\$/g, (_m, inner) => stash(`$${inner}$`));

  // Inline code `...`
  tokenized = tokenized.replace(/`([^`]+)`/g, (_m, inner) =>
    stash(`\\texttt{${escapeLatexText(inner)}}`)
  );

  // Links [label](url)
  tokenized = tokenized.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) =>
    stash(`\\href{${url}}{${escapeLatexText(label)}}`)
  );

  // Bold **...** or __...__
  tokenized = tokenized.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) =>
    stash(`\\textbf{${escapeLatexText(a || b)}}`)
  );

  // Italic *...* or _..._
  tokenized = tokenized.replace(/(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g, (_m, a, b) =>
    stash(`\\textit{${escapeLatexText(a || b)}}`)
  );

  // Escape remaining plain text special characters
  tokenized = escapeLatexText(tokenized);

  // Restore stashed LaTeX commands
  return tokenized.replace(/\uE000TEX(\d+)\uE001/g, (_m, i) => placeholders[Number(i)] || '');
}

function escapeLatexText(text: string): string {
  return text.replace(/([&%$#_{}])/g, '\\$1');
}

/**
 * Deterministic Markdown -> LaTeX converter supporting headings, math blocks,
 * bullet/numbered lists, Markdown tables, code blocks, quotes, and inline formatting.
 */
export function markdownToLatex(
  markdown: string,
  options: MarkdownToLatexOptions = {}
): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const bodyOut: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      bodyOut.push(
        `\\begin{lstlisting}${lang ? `[language=${lang}]` : ''}\n${codeLines.join('\n')}\n\\end{lstlisting}`
      );
      continue;
    }

    // Display math block $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        bodyOut.push(`$$\n${trimmed.slice(2, -2).trim()}\n$$`);
        i++;
        continue;
      }
      i++;
      const mathLines: string[] = [];
      while (i < lines.length && !lines[i].trim().endsWith('$$')) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const last = lines[i].trim().slice(0, -2).trim();
        if (last) mathLines.push(last);
        i++;
      }
      bodyOut.push(`\\begin{equation}\n  ${mathLines.join('\n  ').trim()}\n\\end{equation}`);
      continue;
    }

    // Headings #, ##, ###
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cmd = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection';
      bodyOut.push(`\\${cmd}{${convertInlineMarkdownToLatex(headingMatch[2].trim())}}`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      bodyOut.push('\\hrulefill');
      i++;
      continue;
    }

    // Markdown pipe table
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => convertInlineMarkdownToLatex(c.trim()));

      const header = parseRow(lines[i]);
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      const cols = 'l'.repeat(Math.max(1, header.length));
      const tableLines = [
        '\\begin{table}[htbp]',
        '  \\centering',
        `  \\begin{tabular}{${cols}}`,
        '    \\toprule',
        `    ${header.join(' & ')} \\\\`,
        '    \\midrule',
        ...rows.map((r) => `    ${r.join(' & ')} \\\\`),
        '    \\bottomrule',
        '  \\end{tabular}',
        '\\end{table}',
      ];
      bodyOut.push(tableLines.join('\n'));
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`  \\item ${convertInlineMarkdownToLatex(lines[i].trim().replace(/^[-*+]\s+/, ''))}`);
        i++;
      }
      bodyOut.push(`\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`  \\item ${convertInlineMarkdownToLatex(lines[i].trim().replace(/^\d+\.\s+/, ''))}`);
        i++;
      }
      bodyOut.push(`\\begin{enumerate}\n${items.join('\n')}\n\\end{enumerate}`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(convertInlineMarkdownToLatex(lines[i].trim().replace(/^>\s?/, '')));
        i++;
      }
      bodyOut.push(`\\begin{quote}\n  ${quoteLines.join(' ')}\n\\end{quote}`);
      continue;
    }

    // Regular paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s|```|\$\$|[-*+]\s|\d+\.\s|>|\|)/.test(lines[i].trim())
    ) {
      paraLines.push(convertInlineMarkdownToLatex(lines[i].trim()));
      i++;
    }
    if (paraLines.length) {
      bodyOut.push(paraLines.join(' '));
    }
  }

  const body = bodyOut.join('\n\n');
  if (!options.includePreamble) {
    return body;
  }

  const hasRtl = /[\u0600-\u06FF\u0590-\u05FF]/.test(markdown);
  const preamble = [
    '\\documentclass[12pt,a4paper]{article}',
    '\\usepackage{amsmath,amssymb,booktabs,hyperref,listings}',
    ...(hasRtl ? ['\\usepackage{xepersian}', '\\settextfont{Vazirmatn}'] : []),
    options.title ? `\\title{${escapeLatexText(options.title)}}` : '',
    '\\begin{document}',
    options.title ? '\\maketitle' : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${preamble}\n\n${body}\n\n\\end{document}\n`;
}

function unescapeLatexText(text: string): string {
  return text.replace(/\\([&%$#_{}])/g, '$1');
}

function segmentsToMarkdown(segments: ParsedInlineSegment[] = []): string {
  return segments
    .map((seg) => {
      switch (seg.kind) {
        case 'bold':
          return `**${unescapeLatexText(seg.text)}**`;
        case 'italic':
          return `*${unescapeLatexText(seg.text)}*`;
        case 'underline':
          return `<u>${unescapeLatexText(seg.text)}</u>`;
        case 'code':
          return `\`${unescapeLatexText(seg.text)}\``;
        case 'math':
          return `$${seg.text}$`;
        case 'link':
          return `[${unescapeLatexText(seg.text)}](${seg.href || seg.text})`;
        case 'lr':
        case 'rl':
        case 'ref':
        default:
          return unescapeLatexText(seg.text);
      }
    })
    .join('');
}

/**
 * Converts a LaTeX document or snippet into clean GitHub-Flavored Markdown.
 */
export function latexToMarkdown(latex: string): string {
  const parsed = parseLatexDocument(latex);
  const out: string[] = [];

  if (parsed.hasMaketitle && parsed.title) {
    out.push(`# ${parsed.title}`);
    const metaParts = [parsed.author, parsed.date].filter(Boolean);
    if (metaParts.length) {
      out.push(`*${metaParts.join(' — ')}*`);
    }
  }

  for (const block of parsed.blocks) {
    if (block.type === 'divider') {
      out.push('---');
    } else if (block.type === 'section') {
      out.push(`# ${block.title || ''}`.trim());
    } else if (block.type === 'subsection') {
      out.push(`## ${block.title || ''}`.trim());
    } else if (block.type === 'subsubsection') {
      out.push(`### ${block.title || ''}`.trim());
    } else if (block.type === 'display-math' && block.math) {
      out.push(`$$\n${block.math}\n$$`);
    } else if (block.type === 'paragraph' && block.segments) {
      const text = segmentsToMarkdown(block.segments).trim();
      if (text) out.push(text);
    } else if (block.type === 'itemize' && block.items) {
      out.push(block.items.map((it) => `- ${segmentsToMarkdown(it).trim()}`).join('\n'));
    } else if (block.type === 'enumerate' && block.items) {
      out.push(block.items.map((it, idx) => `${idx + 1}. ${segmentsToMarkdown(it).trim()}`).join('\n'));
    } else if (block.type === 'table' && block.rows && block.rows.length > 0) {
      const header = block.rows[0];
      const sep = header.map(() => '---');
      const bodyRows = block.rows.slice(1);
      const tableMd = [
        block.caption ? `*${block.caption}*\n` : '',
        `| ${header.join(' | ')} |`,
        `| ${sep.join(' | ')} |`,
        ...bodyRows.map((r) => `| ${r.join(' | ')} |`),
      ]
        .filter(Boolean)
        .join('\n');
      out.push(tableMd);
    } else if (block.type === 'theorem') {
      out.push(`> **${block.title || 'Theorem'}:** ${segmentsToMarkdown(block.segments).trim()}`);
    } else if (block.type === 'frame') {
      out.push(`## ${block.title || 'Slide'}\n\n${segmentsToMarkdown(block.segments).trim()}`);
    } else if (block.type === 'code') {
      out.push(`\`\`\`\n${block.title || ''}\n\`\`\``);
    } else if (block.type === 'figure') {
      out.push(`![${block.caption || block.title || 'Figure'}](${block.title || 'figure'})`);
    }
  }

  return out.join('\n\n').trim() + '\n';
}
