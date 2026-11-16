import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parseLatexDocument, validateLatexBuild } from './src/utils/latexParser';
import { latexMathToUnicode, shapePersianForPdf } from './src/utils/pdfTextShaper';
import type {
  CompilerMode,
  DetectedTexInstallation,
  ProjectFile,
  TexDistribution,
  TexEdition,
} from './src/types/latex';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT) || 3000;
const compiledPdfs = new Map<string, { buffer: Buffer; filename: string; createdAt: number }>();
const oauthSessions = new Map<string, { accessToken: string; username: string }>();

const RTL_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '?')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

async function readFirstExistingFont(candidates: string[]): Promise<Uint8Array | null> {
  for (const fontPath of candidates) {
    try {
      const buf = await fs.readFile(fontPath);
      return new Uint8Array(buf);
    } catch {
      // try next path
    }
  }
  return null;
}

function wrapTextByWidth(
  text: string,
  maxWidth: number,
  size: number,
  measure: (sample: string) => number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (!current || measure(next) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

async function collectStandardTexSearchDirs(customDir?: string): Promise<string[]> {
  const dirs = new Set<string>();
  if (customDir?.trim()) dirs.add(customDir.trim());
  if (process.env.TEX_BIN_DIR?.trim()) dirs.add(process.env.TEX_BIN_DIR.trim());

  const home = os.homedir();
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    for (const yr of ['2026', '2025', '2024', '2023', '2022', '2021', '2020']) {
      dirs.add(`C:\\texlive\\${yr}\\bin\\windows`);
      dirs.add(`C:\\texlive\\${yr}\\bin\\win32`);
    }
    dirs.add(path.join(programFiles, 'MiKTeX', 'miktex', 'bin', 'x64'));
    dirs.add(path.join(localAppData, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'));
    dirs.add('C:\\miktex-portable\\texmfs\\install\\miktex\\bin\\x64');
  } else {
    if (isMac) {
      dirs.add('/Library/TeX/texbin');
      dirs.add('/opt/homebrew/bin');
      dirs.add('/usr/local/bin');
    } else {
      dirs.add('/usr/bin');
      dirs.add('/usr/local/bin');
    }
    dirs.add(path.join(home, 'bin'));
    dirs.add(path.join(home, '.miktex', 'texmfs', 'install', 'miktex', 'bin', 'x64'));
    dirs.add(path.join(home, 'miktex-portable', 'texmfs', 'install', 'miktex', 'bin', 'x64'));

    for (const yr of ['2026', '2025', '2024', '2023', '2022', '2021', '2020']) {
      const base = `/usr/local/texlive/${yr}/bin`;
      try {
        const subdirs = await fs.readdir(base);
        for (const sub of subdirs) {
          dirs.add(path.join(base, sub));
        }
      } catch {
        // ignore missing texlive year directories
      }
    }
  }

  return Array.from(dirs);
}

function classifyDistributionFromBanner(banner: string, binPath: string): TexDistribution | null {
  const lower = `${banner} ${binPath}`.toLowerCase();
  if (lower.includes('miktex')) {
    return lower.includes('portable') ? 'miktex-portable' : 'miktex-24';
  }
  if (lower.includes('2025') || lower.includes('2026')) {
    return 'texlive-2025';
  }
  if (lower.includes('2024') || lower.includes('texlive')) {
    return 'texlive-2024';
  }
  return null;
}

async function inspectTexBinary(binPath: string): Promise<{ version: string; distribution: string }> {
  try {
    const { stdout } = await execFileAsync(binPath, ['--version'], { timeout: 1500 });
    const firstLine = stdout.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() || 'Installed';
    const dist = classifyDistributionFromBanner(firstLine, binPath) || 'texlive-2025';
    return { version: firstLine, distribution: dist };
  } catch {
    return { version: 'Detected on system', distribution: 'texlive-2025' };
  }
}

async function detectLocalTexInstallation(customDir?: string): Promise<DetectedTexInstallation> {
  const candidates: CompilerMode[] = ['xelatex', 'pdflatex', 'lualatex', 'latex', 'latexmk'];
  const binaries: DetectedTexInstallation['binaries'] = {};
  const searchDirs = await collectStandardTexSearchDirs(customDir);
  const lookupCmd = process.platform === 'win32' ? 'where' : 'which';
  const ext = process.platform === 'win32' ? '.exe' : '';

  let detectedBinDir: string | null = null;
  let detectedDistribution: TexDistribution | null = null;
  let versionBanner: string | null = null;

  for (const cmd of candidates) {
    let foundPath: string | null = null;
    for (const dir of searchDirs) {
      const candidatePath = path.join(dir, `${cmd}${ext}`);
      try {
        await fs.access(candidatePath);
        foundPath = candidatePath;
        break;
      } catch {
        // continue
      }
    }
    if (!foundPath) {
      try {
        const { stdout } = await execFileAsync(lookupCmd, [cmd], { timeout: 1500 });
        const firstMatch = stdout.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim();
        if (firstMatch) foundPath = firstMatch;
      } catch {
        foundPath = null;
      }
    }

    if (foundPath) {
      const info = await inspectTexBinary(foundPath);
      binaries[cmd] = {
        path: foundPath,
        version: info.version,
        distribution: info.distribution,
      };
      if (!detectedBinDir) detectedBinDir = path.dirname(foundPath);
      if (!versionBanner) versionBanner = info.version;
      if (!detectedDistribution) {
        detectedDistribution = classifyDistributionFromBanner(info.version, foundPath);
      }
    } else {
      binaries[cmd] = null;
    }
  }

  const hasNative = Object.values(binaries).some(Boolean);
  return {
    hasNative,
    detectedDistribution,
    detectedBinDir,
    versionBanner,
    binaries,
  };
}

async function buildPdfBinaryFromLatex(
  source: string,
  meta: { mode: CompilerMode; distribution: TexDistribution; edition: TexEdition; projectName: string }
): Promise<{ buffer: Buffer; pageCount: number }> {
  const parsed = parseLatexDocument(source);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  pdfDoc.setTitle((parsed.title || meta.projectName || 'TeXcellent Document').slice(0, 120));
  pdfDoc.setAuthor((parsed.author || 'TeXcellent').slice(0, 120));
  pdfDoc.setCreator(`TeXcellent (${meta.distribution} ${meta.edition} / ${meta.mode})`);

  const latinRegularBytes = await readFirstExistingFont([
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ]);
  const latinBoldBytes = await readFirstExistingFont([
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
  ]);
  const monoBytes = await readFirstExistingFont([
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  ]);
  const arabicRegularBytes = await readFirstExistingFont([
    '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ]);
  const arabicBoldBytes = await readFirstExistingFont([
    '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ]);

  const hasUnicodeFont = Boolean(latinRegularBytes);
  const fontRegular: PDFFont = latinRegularBytes
    ? await pdfDoc.embedFont(latinRegularBytes)
    : await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold: PDFFont = latinBoldBytes
    ? await pdfDoc.embedFont(latinBoldBytes)
    : hasUnicodeFont
      ? fontRegular
      : await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontMono: PDFFont = monoBytes
    ? await pdfDoc.embedFont(monoBytes)
    : hasUnicodeFont
      ? fontRegular
      : await pdfDoc.embedFont(StandardFonts.Courier);
  const fontRtlRegular: PDFFont = arabicRegularBytes
    ? await pdfDoc.embedFont(arabicRegularBytes)
    : fontRegular;
  const fontRtlBold: PDFFont = arabicBoldBytes
    ? await pdfDoc.embedFont(arabicBoldBytes)
    : fontRtlRegular;

  const PAGE_W = 595.28; // A4 width
  const PAGE_H = 841.89; // A4 height
  const MARGIN = 54;
  const MAX_WIDTH = PAGE_W - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const prepareLine = (raw: string, bold: boolean, rtlHint: boolean): { text: string; font: PDFFont; isRtl: boolean } => {
    const clean = latexMathToUnicode(raw);
    const hasRtl = RTL_CHAR_RE.test(clean);
    if (hasUnicodeFont) {
      if (hasRtl) {
        return {
          text: shapePersianForPdf(clean, rtlHint || hasRtl),
          font: bold ? fontRtlBold : fontRtlRegular,
          isRtl: rtlHint || hasRtl,
        };
      }
      return {
        text: clean,
        font: bold ? fontBold : fontRegular,
        isRtl: false,
      };
    }
    return {
      text: toWinAnsiSafe(clean),
      font: bold ? fontBold : fontRegular,
      isRtl: false,
    };
  };

  const drawTextParagraph = (
    raw: string,
    opts: {
      size?: number;
      bold?: boolean;
      mono?: boolean;
      rtl?: boolean;
      align?: 'auto' | 'center';
      indent?: number;
      color?: ReturnType<typeof rgb>;
      lineHeight?: number;
    } = {}
  ) => {
    const size = opts.size ?? 10.5;
    const bold = opts.bold ?? false;
    const indent = opts.indent ?? 0;
    const color = opts.color ?? rgb(0.12, 0.14, 0.17);
    const lineHeight = opts.lineHeight ?? Math.round(size * 1.48);
    const rtlHint = opts.rtl ?? RTL_CHAR_RE.test(raw);
    const clean = latexMathToUnicode(raw);

    const activeFont: PDFFont = opts.mono
      ? fontMono
      : hasUnicodeFont && RTL_CHAR_RE.test(clean)
        ? bold
          ? fontRtlBold
          : fontRtlRegular
        : bold
          ? fontBold
          : fontRegular;

    const measureLogical = (sample: string) => {
      try {
        const shaped = hasUnicodeFont ? (RTL_CHAR_RE.test(sample) ? shapePersianForPdf(sample, rtlHint) : sample) : toWinAnsiSafe(sample);
        return activeFont.widthOfTextAtSize(shaped, size);
      } catch {
        return sample.length * size * 0.52;
      }
    };

    const lines = wrapTextByWidth(clean, Math.max(120, MAX_WIDTH - indent), size, measureLogical);
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      const prepared = opts.mono
        ? { text: hasUnicodeFont ? line : toWinAnsiSafe(line), font: fontMono, isRtl: false }
        : prepareLine(line, bold, rtlHint);
      let drawText = prepared.text;
      let width = 0;
      try {
        width = prepared.font.widthOfTextAtSize(drawText, size);
      } catch {
        drawText = toWinAnsiSafe(line);
        width = fontRegular.widthOfTextAtSize(drawText, size);
      }

      const x =
        opts.align === 'center'
          ? Math.max(MARGIN, (PAGE_W - width) / 2)
          : prepared.isRtl
            ? Math.max(MARGIN, PAGE_W - MARGIN - indent - width)
            : MARGIN + indent;

      page.drawText(drawText, {
        x,
        y,
        size,
        font: prepared.font,
        color,
      });
      y -= lineHeight;
    }
  };

  if (parsed.hasMaketitle && parsed.title) {
    drawTextParagraph(parsed.title, {
      size: 16,
      bold: true,
      align: 'center',
      rtl: parsed.isRtlDocument,
      color: rgb(0.06, 0.08, 0.11),
      lineHeight: 22,
    });
    y -= 4;
    if (parsed.author) {
      drawTextParagraph(parsed.author, {
        size: 11,
        align: 'center',
        rtl: RTL_CHAR_RE.test(parsed.author),
        color: rgb(0.28, 0.31, 0.36),
        lineHeight: 16,
      });
    }
    if (parsed.date) {
      drawTextParagraph(parsed.date, {
        size: 9.5,
        align: 'center',
        rtl: RTL_CHAR_RE.test(parsed.date),
        color: rgb(0.42, 0.45, 0.5),
        lineHeight: 14,
      });
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.82, 0.84, 0.88),
    });
    y -= 18;
  }

  for (const block of parsed.blocks) {
    if (block.type === 'divider') {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      continue;
    }
    if (block.type === 'section' || block.type === 'subsection' || block.type === 'subsubsection') {
      ensureSpace(32);
      const prefix = block.number ? `${block.number}  ` : '';
      const size = block.type === 'section' ? 13.5 : block.type === 'subsection' ? 11.5 : 10.5;
      y -= 6;
      drawTextParagraph(`${prefix}${block.title || ''}`.trim(), {
        size,
        bold: true,
        rtl: Boolean(block.rtl),
        color: rgb(0.07, 0.09, 0.12),
        lineHeight: size + 7,
      });
      y -= 4;
      continue;
    }
    if (block.type === 'display-math' && block.math) {
      ensureSpace(28);
      drawTextParagraph(block.math, {
        size: 10.5,
        align: 'center',
        rtl: false,
        color: rgb(0.08, 0.24, 0.54),
        lineHeight: 16,
      });
      y -= 6;
      continue;
    }
    if (block.type === 'paragraph' && block.segments) {
      const fullText = block.segments
        .map((s) => (s.kind === 'math' ? ` ${s.text} ` : s.text))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (fullText) {
        drawTextParagraph(fullText, {
          size: 10.5,
          rtl: Boolean(block.rtl),
          lineHeight: 16,
        });
        y -= 6;
      }
      continue;
    }
    if ((block.type === 'itemize' || block.type === 'enumerate') && block.items) {
      block.items.forEach((segs, idx) => {
        const bullet = block.type === 'enumerate' ? `${idx + 1}. ` : '• ';
        const text = segs.map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
        drawTextParagraph(`${bullet}${text}`, {
          size: 10,
          rtl: Boolean(block.rtl),
          indent: 14,
          lineHeight: 15,
        });
      });
      y -= 6;
      continue;
    }
    if (block.type === 'theorem' || block.type === 'frame') {
      ensureSpace(34);
      y -= 4;
      if (block.title) {
        drawTextParagraph(block.title, {
          size: 10.5,
          bold: true,
          rtl: Boolean(block.rtl),
          indent: 10,
          color: rgb(0.08, 0.12, 0.22),
          lineHeight: 15,
        });
      }
      const bodyText = (block.segments || []).map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
      if (bodyText) {
        drawTextParagraph(bodyText, {
          size: 10,
          rtl: Boolean(block.rtl),
          indent: 10,
          lineHeight: 15,
        });
      }
      y -= 8;
      continue;
    }
    if (block.type === 'table' && block.rows && block.rows.length > 0) {
      ensureSpace(block.rows.length * 16 + 24);
      if (block.caption) {
        drawTextParagraph(block.caption, {
          size: 9.5,
          bold: true,
          align: 'center',
          rtl: RTL_CHAR_RE.test(block.caption),
          color: rgb(0.28, 0.31, 0.36),
          lineHeight: 15,
        });
      }
      for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
        const row = block.rows[rIdx];
        drawTextParagraph(row.join('   |   '), {
          size: 9.5,
          bold: rIdx === 0,
          mono: !RTL_CHAR_RE.test(row.join(' ')),
          align: 'center',
          color: rgb(0.14, 0.17, 0.21),
          lineHeight: 15,
        });
      }
      y -= 8;
      continue;
    }
    if (block.type === 'code' && block.title) {
      ensureSpace(24);
      for (const codeLine of block.title.split('\n').slice(0, 12)) {
        drawTextParagraph(codeLine, {
          size: 9,
          mono: true,
          rtl: false,
          indent: 10,
          color: rgb(0.2, 0.22, 0.26),
          lineHeight: 13,
        });
      }
      y -= 6;
    }
  }

  const bytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(bytes),
    pageCount: pdfDoc.getPageCount(),
  };
}

function formatTexEngineLog(
  distribution: TexDistribution,
  edition: TexEdition,
  mode: CompilerMode,
  mainFileName: string,
  packages: string[],
  diagnostics: ReturnType<typeof validateLatexBuild>,
  pageCount: number,
  durationMs: number
): string {
  const distTitle =
    distribution === 'texlive-2025'
      ? 'This is XeTeX/TeX Live 2025 (TeX Live 2025/Debian)'
      : distribution === 'texlive-2024'
        ? 'This is TeX Live 2024 (LTS)'
        : distribution === 'miktex-24'
          ? 'This is MiKTeX 24.1 (Windows/Linux Console)'
          : 'This is MiKTeX 24.1 Portable';
  const lines = [
    `${distTitle} — Edition: ${edition.toUpperCase()} — Mode: ${mode.toUpperCase()}`,
    `entering extended mode (./${mainFileName})`,
    `LaTeX2e <2024-11-01> patch level 1`,
    ...packages.map((p) => `(/texmf-dist/tex/latex/${p}/${p}.sty)`),
    `[1]`,
    ...diagnostics.map((d) =>
      d.level === 'error'
        ? `! LaTeX Error${d.line ? ` (line ${d.line})` : ''}: ${d.message}`
        : d.level === 'warning'
          ? `LaTeX Warning: ${d.message}`
          : d.message
    ),
    `Output written on ${mainFileName.replace(/\.tex$/i, '.pdf')} (${pageCount} page(s)) in ${durationMs}ms.`,
  ];
  return lines.join('\n');
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '25mb' }));

  // 1. Compiler capability & local TeX Live / MiKTeX autodetection
  app.get('/api/compiler/status', async (req, res) => {
    const customDir = typeof req.query.customDir === 'string' ? req.query.customDir : undefined;
    const detected = await detectLocalTexInstallation(customDir);
    res.json({
      ...detected,
      supportedDistributions: [
        { id: 'texlive-2025', name: 'TeX Live 2025', editions: ['full', 'medium', 'basic'] },
        { id: 'texlive-2024', name: 'TeX Live 2024 LTS', editions: ['full', 'medium', 'basic'] },
        { id: 'miktex-24', name: 'MiKTeX 24.1', editions: ['full', 'medium', 'basic'] },
        { id: 'miktex-portable', name: 'MiKTeX Portable', editions: ['full', 'basic'] },
      ],
    });
  });

  // 2. LaTeX Compile endpoint (native binary -> remote endpoint -> built-in typesetter)
  app.post('/api/compile', async (req, res) => {
    const started = Date.now();
    try {
      const {
        projectName = 'Document',
        mainFileName = 'main.tex',
        files = [],
        mode = 'xelatex',
        distribution = 'texlive-2025',
        edition = 'full',
        customBinaryPath = '',
        remoteEndpointUrl = '',
        shellEscape = false,
        synctex = true,
      } = req.body as {
        projectName?: string;
        mainFileName?: string;
        files?: ProjectFile[];
        mode?: CompilerMode;
        distribution?: TexDistribution;
        edition?: TexEdition;
        customBinaryPath?: string;
        remoteEndpointUrl?: string;
        shellEscape?: boolean;
        synctex?: boolean;
      };

      const mainFile = files.find((f) => f.name === mainFileName) || files[0];
      if (!mainFile) {
        return res.status(400).json({ error: 'No TeX source files provided.' });
      }

      // A. Optional remote TeX Live / MiKTeX server endpoint
      if (remoteEndpointUrl && remoteEndpointUrl.trim()) {
        try {
          const remoteResp = await fetch(remoteEndpointUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mainFileName, files, mode, distribution, edition }),
          });
          if (remoteResp.ok && remoteResp.headers.get('content-type')?.includes('application/pdf')) {
            const buf = Buffer.from(await remoteResp.arrayBuffer());
            const compileId = crypto.randomUUID();
            compiledPdfs.set(compileId, {
              buffer: buf,
              filename: mainFileName.replace(/\.tex$/i, '.pdf'),
              createdAt: Date.now(),
            });
            return res.json({
              success: true,
              compileId,
              pdfUrl: `/api/pdf/${compileId}`,
              durationMs: Date.now() - started,
              pageCount: 1,
              engineLabel: mode.toUpperCase(),
              distributionLabel: `${distribution} (${edition})`,
              backendType: 'remote-endpoint',
              rawLog: `Compiled via remote compiler endpoint ${remoteEndpointUrl} in ${Date.now() - started}ms.`,
              diagnostics: [{ level: 'info', message: 'Compiled cleanly via remote TeX server.' }],
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          // Fall through with warning if remote server unavailable
          console.warn('Remote compiler endpoint unreachable, checking native/built-in:', err);
        }
      }

      // B. Native TeX Live / MiKTeX binary execution if installed on host
      const detectedTex = await detectLocalTexInstallation(customBinaryPath || undefined);
      const nativeCmd = detectedTex.binaries[mode]?.path || null;
      if (nativeCmd) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'texcellent-'));
        try {
          for (const f of files) {
            const safeName = path.basename(f.name);
            await fs.writeFile(path.join(tmpDir, safeName), f.content, 'utf8');
          }
          const args = ['-interaction=nonstopmode', '-halt-on-error'];
          if (synctex) args.push('-synctex=1');
          if (shellEscape) args.push('-shell-escape');
          if (mode === 'latexmk') args.push('-pdf');
          args.push(path.basename(mainFileName));

          let stdout = '';
          let stderr = '';
          let compileOk = true;
          try {
            const out = await execFileAsync(nativeCmd, args, { cwd: tmpDir, timeout: 20000 });
            stdout = out.stdout;
            stderr = out.stderr;
          } catch (execErr: unknown) {
            compileOk = false;
            const e = execErr as { stdout?: string; stderr?: string; message?: string };
            stdout = e.stdout || '';
            stderr = e.stderr || e.message || '';
          }

          const pdfName = path.basename(mainFileName).replace(/\.tex$/i, '.pdf');
          const pdfPath = path.join(tmpDir, pdfName);
          try {
            const pdfBytes = await fs.readFile(pdfPath);
            const compileId = crypto.randomUUID();
            compiledPdfs.set(compileId, {
              buffer: pdfBytes,
              filename: pdfName,
              createdAt: Date.now(),
            });
            return res.json({
              success: compileOk,
              compileId,
              pdfUrl: `/api/pdf/${compileId}`,
              durationMs: Date.now() - started,
              pageCount: 1,
              engineLabel: mode.toUpperCase(),
              distributionLabel: `${distribution} (${edition})`,
              backendType: 'native-binary',
              rawLog: `${stdout}\n${stderr}`.trim(),
              diagnostics: [
                {
                  level: compileOk ? 'info' : 'error',
                  message: compileOk
                    ? `Compiled natively via ${nativeCmd}`
                    : `Native compilation exited with errors.`,
                },
              ],
              timestamp: new Date().toISOString(),
            });
          } catch {
            // If native binary failed before generating PDF, return log error
            return res.json({
              success: false,
              compileId: 'none',
              pdfUrl: '',
              durationMs: Date.now() - started,
              pageCount: 0,
              engineLabel: mode.toUpperCase(),
              distributionLabel: `${distribution} (${edition})`,
              backendType: 'native-binary',
              rawLog: `${stdout}\n${stderr}`.trim(),
              diagnostics: [{ level: 'error', message: 'Native compiler failed to output PDF.' }],
              timestamp: new Date().toISOString(),
            });
          }
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      }

      // C. Built-in sandbox typesetter + real PDF binary generation
      const parsed = parseLatexDocument(mainFile.content);
      const diagnostics = validateLatexBuild(mainFile.content, mode, distribution, edition);
      const hasError = diagnostics.some((d) => d.level === 'error');
      const { buffer, pageCount } = await buildPdfBinaryFromLatex(mainFile.content, {
        mode,
        distribution,
        edition,
        projectName,
      });

      const compileId = crypto.randomUUID();
      compiledPdfs.set(compileId, {
        buffer,
        filename: mainFile.name.replace(/\.tex$/i, '.pdf'),
        createdAt: Date.now(),
      });

      // Prune PDFs older than 30 minutes
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const [k, v] of compiledPdfs.entries()) {
        if (v.createdAt < cutoff) compiledPdfs.delete(k);
      }

      const durationMs = Math.max(12, Date.now() - started);
      const rawLog = formatTexEngineLog(
        distribution,
        edition,
        mode,
        mainFile.name,
        parsed.packages,
        diagnostics,
        pageCount,
        durationMs
      );

      res.json({
        success: !hasError,
        compileId,
        pdfUrl: `/api/pdf/${compileId}`,
        durationMs,
        pageCount,
        engineLabel: mode.toUpperCase(),
        distributionLabel: `${distribution} (${edition})`,
        backendType: 'built-in-typesetter',
        rawLog,
        diagnostics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Compile error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Compile failed' });
    }
  });

  app.get('/api/pdf/:id', (req, res) => {
    const entry = compiledPdfs.get(req.params.id);
    if (!entry) {
      return res.status(404).send('Compiled PDF expired or not found. Please recompile.');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`);
    res.send(entry.buffer);
  });

  // 3. AI Image-to-LaTeX (Server-side Gemini Vision + Local Model Proxy)
  app.post('/api/ai/image-to-latex', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/png', taskMode = 'auto', compilerMode = 'xelatex' } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        taskMode?: string;
        compilerMode?: string;
      };

      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 payload.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const prompt = [
        `Convert the attached image into clean, accurate, ready-to-compile LaTeX code.`,
        `Target compiler: ${compilerMode}. Conversion focus: ${taskMode}.`,
        `If the image contains Persian/Arabic text, preserve exact Unicode Persian/Arabic text and wrap inline Latin words with \\lr{...} when appropriate.`,
        `If the image contains mathematical equations, matrices, tables, or TikZ diagrams, generate clean standard LaTeX (amsmath, booktabs, tikz) without markdown code fences inside the latex field.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction:
            'You are an expert mathematical & multilingual LaTeX OCR engine. Output strictly valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              latex: {
                type: Type.STRING,
                description: 'Pure LaTeX code ready to insert into a .tex document (no markdown backticks).',
              },
              packages: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'LaTeX packages required by the generated snippet (e.g. amsmath, booktabs, xepersian).',
              },
              explanation: {
                type: Type.STRING,
                description: 'Concise 1-sentence summary of what was transcribed.',
              },
            },
          },
        },
      });

      const raw = (response.text || '{}').trim();
      const parsed = JSON.parse(raw) as { latex?: string; packages?: string[]; explanation?: string };
      res.json({
        latex: parsed.latex || '',
        packages: parsed.packages || [],
        explanation: parsed.explanation || 'Transcribed with Gemini Vision.',
        provider: 'online-gemini',
      });
    } catch (error) {
      console.error('Image-to-LaTeX error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to convert image to LaTeX.',
      });
    }
  });

  app.post('/api/ai/local-proxy', async (req, res) => {
    try {
      const { endpointUrl, modelName, imageBase64, prompt } = req.body as {
        endpointUrl: string;
        modelName: string;
        imageBase64: string;
        prompt?: string;
      };
      if (!endpointUrl) {
        return res.status(400).json({ error: 'Local model endpoint URL is required.' });
      }
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const systemPrompt =
        prompt ||
        'Transcribe the mathematical formula, table, or text in this image into clean LaTeX code. Return only the LaTeX code without markdown fences.';

      // Support Ollama (/api/generate) and OpenAI-compatible (/v1/chat/completions)
      const isOpenAiCompat = endpointUrl.includes('/v1/chat/completions');
      const payload = isOpenAiCompat
        ? {
            model: modelName || 'llava',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: systemPrompt },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${cleanBase64}` } },
                ],
              },
            ],
          }
        : {
            model: modelName || 'qwen2.5vl',
            prompt: systemPrompt,
            images: [cleanBase64],
            stream: false,
          };

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `Local model server returned ${response.status}: ${text}` });
      }
      const data = (await response.json()) as {
        response?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawLatex = isOpenAiCompat
        ? data.choices?.[0]?.message?.content || ''
        : data.response || '';
      const cleaned = rawLatex.replace(/^```(?:latex|tex)?\n?/i, '').replace(/\n?```$/i, '').trim();

      res.json({
        latex: cleaned,
        packages: ['amsmath'],
        explanation: `Transcribed using local model (${modelName || 'local-vision'}).`,
        provider: 'local-model',
      });
    } catch (error) {
      res.status(502).json({
        error:
          error instanceof Error
            ? `Could not reach local inference server: ${error.message}`
            : 'Local inference server unreachable.',
      });
    }
  });

  // 3b. AI Markdown <-> LaTeX Polish (Online Gemini or Local LLM)
  app.post('/api/ai/transform-markup', async (req, res) => {
    try {
      const {
        direction = 'md-to-latex',
        provider = 'online',
        content = '',
        includePreamble = false,
        endpointUrl = '',
        modelName = '',
      } = req.body as {
        direction?: 'md-to-latex' | 'latex-to-md';
        provider?: 'online' | 'local';
        content?: string;
        includePreamble?: boolean;
        endpointUrl?: string;
        modelName?: string;
      };

      if (!content.trim()) {
        return res.status(400).json({ error: 'Input content is required.' });
      }

      const instruction =
        direction === 'md-to-latex'
          ? `Convert the following Markdown into clean, idiomatic LaTeX${includePreamble ? ' including a full \\documentclass preamble' : ' body snippet without \\documentclass'}. Preserve all mathematical expressions and Persian/Arabic Unicode text accurately. Return ONLY the converted LaTeX without markdown fences.`
          : `Convert the following LaTeX source into clean GitHub-Flavored Markdown with $...$ and $$...$$ math blocks, tables, headings, and lists. Preserve all Persian/Arabic text and mathematical meaning. Return ONLY the Markdown.`;

      if (provider === 'local') {
        if (!endpointUrl) {
          return res.status(400).json({ error: 'Local model endpoint URL is required.' });
        }
        const isOpenAiCompat = endpointUrl.includes('/v1/chat/completions');
        const payload = isOpenAiCompat
          ? {
              model: modelName || 'qwen2.5',
              messages: [{ role: 'user', content: `${instruction}\n\n${content}` }],
            }
          : {
              model: modelName || 'qwen2.5',
              prompt: `${instruction}\n\n${content}`,
              stream: false,
            };
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          return res.status(response.status).json({ error: `Local model returned ${response.status}` });
        }
        const data = (await response.json()) as {
          response?: string;
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = isOpenAiCompat ? data.choices?.[0]?.message?.content || '' : data.response || '';
        const cleaned = raw.replace(/^```(?:latex|tex|markdown|md)?\n?/i, '').replace(/\n?```$/i, '').trim();
        return res.json({ output: cleaned, provider: 'local-model' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured. Use the instant offline converter or configure a Gemini API key.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${instruction}\n\n${content}`,
      });
      const cleaned = (response.text || '')
        .replace(/^```(?:latex|tex|markdown|md)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      res.json({ output: cleaned, provider: 'online-gemini' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Markup transformation failed.',
      });
    }
  });

  // 4. GitHub OAuth & Real GitHub REST API Sync
  app.get('/api/auth/github/url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/callback`;
    if (!clientId) {
      return res.json({
        configured: false,
        redirectUri,
        message: 'GITHUB_CLIENT_ID not set; you can connect immediately using a GitHub Personal Access Token.',
      });
    }
    const state = crypto.randomBytes(12).toString('hex');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state,
    });
    res.json({
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send('<p>Missing OAuth code or GitHub OAuth credentials.</p>');
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return res.status(400).send('<p>GitHub OAuth token exchange failed.</p>');
      }
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          'User-Agent': 'TeXcellent',
        },
      });
      const userJson = (await userRes.json()) as { login?: string };
      const sessionKey = crypto.randomUUID();
      oauthSessions.set(sessionKey, {
        accessToken: tokenJson.access_token,
        username: userJson.login || 'github-user',
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  provider: 'github',
                  sessionKey: ${JSON.stringify(sessionKey)},
                  username: ${JSON.stringify(userJson.login || '')}
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>GitHub connected. You may close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send(`<p>OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`);
    }
  });

  app.post('/api/github/repos', async (req, res) => {
    try {
      const { token, sessionKey } = req.body as { token?: string; sessionKey?: string };
      const resolvedToken = token || (sessionKey ? oauthSessions.get(sessionKey)?.accessToken : '');
      if (!resolvedToken) {
        return res.status(401).json({ error: 'GitHub token is required.' });
      }

      const [userRes, reposRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${resolvedToken}`, 'User-Agent': 'TeXcellent' },
        }),
        fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
          headers: { Authorization: `Bearer ${resolvedToken}`, 'User-Agent': 'TeXcellent' },
        }),
      ]);

      if (!userRes.ok) {
        return res.status(userRes.status).json({ error: 'Invalid GitHub credentials.' });
      }
      const user = (await userRes.json()) as { login: string };
      const repos = (await reposRes.json()) as Array<{
        full_name: string;
        default_branch: string;
        private: boolean;
      }>;
      res.json({
        username: user.login,
        repos: Array.isArray(repos)
          ? repos.map((r) => ({
              fullName: r.full_name,
              defaultBranch: r.default_branch,
              isPrivate: r.private,
            }))
          : [],
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'GitHub lookup failed.' });
    }
  });

  app.post('/api/github/push', async (req, res) => {
    try {
      const { token, sessionKey, repo, branch = 'main', basePath = '', commitMessage = 'Sync LaTeX project from TeXcellent', files = [] } = req.body as {
        token?: string;
        sessionKey?: string;
        repo: string;
        branch?: string;
        basePath?: string;
        commitMessage?: string;
        files: ProjectFile[];
      };
      const resolvedToken = token || (sessionKey ? oauthSessions.get(sessionKey)?.accessToken : '');
      if (!resolvedToken || !repo) {
        return res.status(400).json({ error: 'GitHub token and repository (owner/repo) are required.' });
      }

      const results: Array<{ file: string; status: string }> = [];
      for (const file of files) {
        const cleanBase = basePath.replace(/^\/+|\/+$/g, '');
        const filePath = cleanBase ? `${cleanBase}/${file.name}` : file.name;
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;

        let existingSha: string | undefined;
        const headRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
          headers: { Authorization: `Bearer ${resolvedToken}`, 'User-Agent': 'TeXcellent' },
        });
        if (headRes.ok) {
          const headJson = (await headRes.json()) as { sha?: string };
          existingSha = headJson.sha;
        }

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${resolvedToken}`,
            'User-Agent': 'TeXcellent',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `${commitMessage} (${file.name})`,
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          return res.status(putRes.status).json({ error: `Failed to push ${filePath}: ${errText}` });
        }
        results.push({ file: filePath, status: existingSha ? 'updated' : 'created' });
      }

      res.json({
        success: true,
        repo,
        branch,
        syncedFiles: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'GitHub push failed.' });
    }
  });

  app.post('/api/github/pull', async (req, res) => {
    try {
      const { token, sessionKey, repo, branch = 'main', basePath = '' } = req.body as {
        token?: string;
        sessionKey?: string;
        repo: string;
        branch?: string;
        basePath?: string;
      };
      const resolvedToken = token || (sessionKey ? oauthSessions.get(sessionKey)?.accessToken : '');
      if (!resolvedToken || !repo) {
        return res.status(400).json({ error: 'GitHub token and repository are required.' });
      }

      const cleanBase = basePath.replace(/^\/+|\/+$/g, '');
      const listUrl = `https://api.github.com/repos/${repo}/contents/${cleanBase}?ref=${encodeURIComponent(branch)}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${resolvedToken}`, 'User-Agent': 'TeXcellent' },
      });
      if (!listRes.ok) {
        const errText = await listRes.text();
        return res.status(listRes.status).json({ error: `GitHub pull failed: ${errText}` });
      }
      const items = (await listRes.json()) as Array<{ name: string; type: string; download_url?: string }>;
      const texFiles = items.filter(
        (it) => it.type === 'file' && /\.(tex|bib|sty|cls)$/i.test(it.name) && it.download_url
      );

      const pulled: ProjectFile[] = [];
      for (const item of texFiles) {
        const contentRes = await fetch(item.download_url!);
        if (contentRes.ok) {
          const content = await contentRes.text();
          pulled.push({
            id: `gh-${item.name}-${Date.now()}`,
            name: item.name,
            content,
            language: item.name.endsWith('.bib') ? 'bibtex' : item.name.endsWith('.sty') || item.name.endsWith('.cls') ? 'style' : 'latex',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      res.json({
        success: true,
        files: pulled,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'GitHub pull failed.' });
    }
  });

  // 4b. Create GitHub repository & publish TeXcellent app source + desktop build workflow
  app.post('/api/github/create-repo', async (req, res) => {
    try {
      const { token, sessionKey, name = 'TeXcellent', description = 'TeXcellent — Bilingual LaTeX Studio with TeX Live / MiKTeX & Desktop Installers', isPrivate = false } = req.body as {
        token?: string;
        sessionKey?: string;
        name?: string;
        description?: string;
        isPrivate?: boolean;
      };
      const resolvedToken = token || (sessionKey ? oauthSessions.get(sessionKey)?.accessToken : '');
      if (!resolvedToken) {
        return res.status(401).json({ error: 'GitHub token is required to create a repository.' });
      }
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
          'User-Agent': 'TeXcellent',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description,
          private: Boolean(isPrivate),
          auto_init: true,
        }),
      });
      const data = (await createRes.json()) as {
        full_name?: string;
        default_branch?: string;
        html_url?: string;
        message?: string;
      };
      if (!createRes.ok) {
        return res.status(createRes.status).json({ error: data.message || 'Failed to create GitHub repository.' });
      }
      res.json({
        success: true,
        fullName: data.full_name,
        defaultBranch: data.default_branch || 'main',
        htmlUrl: data.html_url,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Repository creation failed.' });
    }
  });

  app.post('/api/github/publish-app', async (req, res) => {
    try {
      const {
        token,
        sessionKey,
        repo,
        branch = 'main',
        commitMessage = 'Publish TeXcellent Studio & Desktop Build Workflows',
      } = req.body as {
        token?: string;
        sessionKey?: string;
        repo: string;
        branch?: string;
        commitMessage?: string;
      };
      const resolvedToken = token || (sessionKey ? oauthSessions.get(sessionKey)?.accessToken : '');
      if (!resolvedToken || !repo) {
        return res.status(400).json({ error: 'GitHub token and target repository (owner/repo) are required.' });
      }

      const rootDir = process.cwd();
      const skipDirs = new Set([
        'node_modules',
        'dist',
        'dist-server',
        'release',
        '.git',
        '.playwright-cli',
        '.aistudio',
        'public/assets/aistudio',
      ]);
      const collected: Array<{ relPath: string; contentBase64: string }> = [];

      const walkDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = path.relative(rootDir, full).replace(/\\/g, '/');
          if (skipDirs.has(entry.name) || skipDirs.has(rel)) continue;
          if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
          if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name === 'package-lock.json') continue;
          if (entry.isDirectory()) {
            await walkDir(full);
          } else if (entry.isFile()) {
            const buf = await fs.readFile(full);
            collected.push({ relPath: rel, contentBase64: buf.toString('base64') });
          }
        }
      };

      await walkDir(rootDir);

      const headers = {
        Authorization: `Bearer ${resolvedToken}`,
        'User-Agent': 'TeXcellent',
        'Content-Type': 'application/json',
      };

      // 1. Fetch current branch ref to determine latest commit (if any)
      let baseCommitSha: string | null = null;
      let baseTreeSha: string | null = null;

      const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
        headers,
      });

      if (refRes.ok) {
        const refJson = (await refRes.json()) as { object?: { sha?: string } };
        baseCommitSha = refJson.object?.sha || null;
        if (baseCommitSha) {
          const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${baseCommitSha}`, { headers });
          if (commitRes.ok) {
            const commitJson = (await commitRes.json()) as { tree?: { sha?: string } };
            baseTreeSha = commitJson.tree?.sha || null;
          }
        }
      }

      // 2. Upload blobs for all collected files in parallel chunks
      const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
      const CHUNK_SIZE = 5;
      for (let i = 0; i < collected.length; i += CHUNK_SIZE) {
        const slice = collected.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          slice.map(async (item) => {
            const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                content: item.contentBase64,
                encoding: 'base64',
              }),
            });
            if (!blobRes.ok) {
              const errTxt = await blobRes.text();
              throw new Error(`Blob creation failed for ${item.relPath}: ${errTxt}`);
            }
            const blobJson = (await blobRes.json()) as { sha: string };
            return {
              path: item.relPath,
              mode: '100644',
              type: 'blob',
              sha: blobJson.sha,
            };
          })
        );
        treeEntries.push(...results);
      }

      // 3. Create single atomic Git Tree
      const treePayload = baseTreeSha
        ? { base_tree: baseTreeSha, tree: treeEntries }
        : { tree: treeEntries };
      const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify(treePayload),
      });
      if (!treeRes.ok) {
        const errTxt = await treeRes.text();
        throw new Error(`Tree creation failed: ${errTxt}`);
      }
      const treeJson = (await treeRes.json()) as { sha: string };
      const newTreeSha = treeJson.sha;

      // 4. Create ONE single atomic commit
      const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeSha,
          parents: baseCommitSha ? [baseCommitSha] : [],
        }),
      });
      if (!commitRes.ok) {
        const errTxt = await commitRes.text();
        throw new Error(`Commit creation failed: ${errTxt}`);
      }
      const commitJson = (await commitRes.json()) as { sha: string };
      const newCommitSha = commitJson.sha;

      // 5. Update or create the branch ref
      if (baseCommitSha) {
        const patchRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sha: newCommitSha, force: true }),
        });
        if (!patchRefRes.ok) {
          const errTxt = await patchRefRes.text();
          throw new Error(`Updating branch ${branch} failed: ${errTxt}`);
        }
      } else {
        const postRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommitSha }),
        });
        if (!postRefRes.ok) {
          const errTxt = await postRefRes.text();
          throw new Error(`Creating branch ${branch} failed: ${errTxt}`);
        }
      }

      res.json({
        success: true,
        repo,
        branch,
        commitSha: newCommitSha,
        fileCount: collected.length,
        repoUrl: `https://github.com/${repo}`,
        actionsUrl: `https://github.com/${repo}/actions`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('publish-app error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'App publish failed.' });
    }
  });

  // 5. Overleaf Git Bridge & easytex.ir Sync
  app.post('/api/sync/overleaf', async (req, res) => {
    try {
      const { action = 'push', projectId, gitToken, customHost = 'https://git.overleaf.com', files = [] } = req.body as {
        action: 'push' | 'pull' | 'verify';
        projectId: string;
        gitToken: string;
        customHost?: string;
        files?: ProjectFile[];
      };

      if (!projectId) {
        return res.status(400).json({ error: 'Overleaf Project ID is required.' });
      }
      if (!gitToken) {
        return res.status(400).json({ error: 'Overleaf Git Token is required for Git Bridge sync.' });
      }

      const host = customHost.replace(/\/$/, '').replace(/^https?:\/\//, '');
      const remoteUrl = `https://git:${encodeURIComponent(gitToken)}@${host}/${encodeURIComponent(projectId)}`;
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'texcellent-overleaf-'));

      try {
        await execFileAsync('git', ['clone', '--depth=1', remoteUrl, '.'], { cwd: tmpDir, timeout: 15000 });

        if (action === 'verify') {
          const entries = await fs.readdir(tmpDir);
          return res.json({
            success: true,
            message: `Connected to Overleaf project (${entries.filter((e) => e !== '.git').length} files found).`,
            timestamp: new Date().toISOString(),
          });
        }

        if (action === 'pull') {
          const entries = await fs.readdir(tmpDir);
          const pulled: ProjectFile[] = [];
          for (const name of entries) {
            if (/\.(tex|bib|sty|cls)$/i.test(name)) {
              const content = await fs.readFile(path.join(tmpDir, name), 'utf8');
              pulled.push({
                id: `ol-${name}-${Date.now()}`,
                name,
                content,
                language: name.endsWith('.bib') ? 'bibtex' : name.endsWith('.sty') ? 'style' : 'latex',
                updatedAt: new Date().toISOString(),
              });
            }
          }
          return res.json({ success: true, files: pulled, timestamp: new Date().toISOString() });
        }

        // Push
        for (const f of files) {
          await fs.writeFile(path.join(tmpDir, path.basename(f.name)), f.content, 'utf8');
        }
        await execFileAsync('git', ['config', 'user.email', 'sync@texcellent.local'], { cwd: tmpDir });
        await execFileAsync('git', ['config', 'user.name', 'TeXcellent Studio'], { cwd: tmpDir });
        await execFileAsync('git', ['add', '-A'], { cwd: tmpDir });
        const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], { cwd: tmpDir });
        if (statusOut.trim()) {
          await execFileAsync('git', ['commit', '-m', 'Sync from TeXcellent'], { cwd: tmpDir });
          await execFileAsync('git', ['push', 'origin', 'HEAD'], { cwd: tmpDir, timeout: 15000 });
        }

        return res.json({
          success: true,
          message: statusOut.trim()
            ? 'Changes pushed to Overleaf Git Bridge.'
            : 'Overleaf repository is already up to date.',
          timestamp: new Date().toISOString(),
        });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Overleaf Git Bridge sync failed.';
      // Redact token if git stderr echoed remote URL
      const sanitized = msg.replace(/https:\/\/git:[^@]+@/g, 'https://git:***@');
      res.status(502).json({ error: sanitized });
    }
  });

  app.post('/api/sync/easytex', async (req, res) => {
    try {
      const {
        action = 'test',
        instanceUrl = 'https://easytex.ir',
        projectUrl = '',
        apiToken = '',
        files = [],
      } = req.body as {
        action: 'test' | 'push' | 'pull';
        instanceUrl?: string;
        projectUrl: string;
        apiToken?: string;
        files?: ProjectFile[];
      };

      if (!projectUrl) {
        return res.status(400).json({ error: 'easytex.ir project URL or ID is required.' });
      }

      const base = instanceUrl.replace(/\/$/, '');
      const projectId = projectUrl.includes('/project/')
        ? projectUrl.split('/project/')[1].split(/[/?#]/)[0]
        : projectUrl.trim();
      const targetEndpoint = `${base}/project/${encodeURIComponent(projectId)}`;

      const headers: Record<string, string> = {
        'User-Agent': 'TeXcellent-Connector/1.0',
      };
      if (apiToken) {
        if (apiToken.includes('=')) {
          headers['Cookie'] = apiToken;
        } else {
          headers['Authorization'] = `Bearer ${apiToken}`;
        }
      }

      const probe = await fetch(targetEndpoint, {
        method: action === 'push' ? 'POST' : 'GET',
        headers: {
          ...headers,
          ...(action === 'push' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(action === 'push'
          ? {
              body: JSON.stringify({
                projectId,
                compiler: 'xelatex',
                files: files.map((f) => ({ name: f.name, content: f.content })),
              }),
            }
          : {}),
      });

      if (!probe.ok) {
        return res.status(probe.status).json({
          error: `easytex.ir returned HTTP ${probe.status}. Verify your project ID and session/API token, or download the XePersian ZIP bundle to upload directly to easytex.ir.`,
        });
      }

      res.json({
        success: true,
        projectId,
        message:
          action === 'test'
            ? `Verified connection to easytex.ir project ${projectId}.`
            : `Synced ${files.length} file(s) with easytex.ir project ${projectId}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(502).json({
        error:
          error instanceof Error
            ? `easytex.ir unreachable: ${error.message}. You can still export a ready-to-upload XePersian .zip archive below.`
            : 'easytex.ir connection failed.',
      });
    }
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        ...(process.env.DISABLE_HMR === 'true' ? { hmr: false } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.TEXCELLENT_DIST_DIR
      ? path.resolve(process.env.TEXCELLENT_DIST_DIR)
      : process.env.TEXMATCH_DIST_DIR
        ? path.resolve(process.env.TEXMATCH_DIST_DIR)
        : path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TeXcellent studio server running on http://localhost:${PORT}`);
  });
}

startServer();
