import React, { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import {
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  BookOpen,
  AlertTriangle,
  FileText,
  Terminal,
} from 'lucide-react';
import { CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { ParsedBlock, ParsedInlineSegment, parseLatexDocument } from '../utils/latexParser';
import { PdfBinaryCanvasViewer } from './PdfBinaryCanvasViewer';

interface PdfPreviewPaneProps {
  source: string;
  compileResult: CompileResult | null;
  isCompiling: boolean;
  theme: EditorTheme;
  onOpenExternal: () => void;
  onRecompile?: () => void;
  onOpenLog?: () => void;
  onSwitchToXelatex?: () => void;
  isExternalWindow?: boolean;
}

function renderMathHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return tex;
  }
}

const InlineSegmentList: React.FC<{ segments: ParsedInlineSegment[] }> = ({ segments }) => {
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === 'bold') {
          return (
            <strong key={idx} className="font-semibold">
              {seg.text}
            </strong>
          );
        }
        if (seg.kind === 'italic') {
          return (
            <em key={idx} className="italic">
              {seg.text}
            </em>
          );
        }
        if (seg.kind === 'underline') {
          return (
            <span key={idx} className="underline underline-offset-2">
              {seg.text}
            </span>
          );
        }
        if (seg.kind === 'code') {
          return (
            <code
              key={idx}
              dir="ltr"
              className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-800 font-mono text-[0.88em]"
              style={{ unicodeBidi: 'isolate' }}
            >
              {seg.text}
            </code>
          );
        }
        if (seg.kind === 'math') {
          return (
            <span
              key={idx}
              dir="ltr"
              className="inline-block align-middle mx-0.5"
              style={{ unicodeBidi: 'isolate' }}
              dangerouslySetInnerHTML={{ __html: renderMathHtml(seg.text, false) }}
            />
          );
        }
        if (seg.kind === 'lr') {
          return (
            <bdi
              key={idx}
              dir="ltr"
              className="font-serif mx-0.5"
              style={{ unicodeBidi: 'isolate', fontFamily: 'var(--font-serif)' }}
            >
              {seg.text}
            </bdi>
          );
        }
        if (seg.kind === 'rl') {
          return (
            <bdi
              key={idx}
              dir="rtl"
              className="mx-0.5"
              style={{ unicodeBidi: 'isolate', fontFamily: 'var(--font-rtl)' }}
            >
              {seg.text}
            </bdi>
          );
        }
        if (seg.kind === 'ref') {
          return (
            <span key={idx} className="text-blue-700 font-medium">
              {seg.text}
            </span>
          );
        }
        if (seg.kind === 'link') {
          return (
            <a
              key={idx}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline underline-offset-2"
            >
              {seg.text}
            </a>
          );
        }
        return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
      })}
    </>
  );
};

const BlockRenderer: React.FC<{ block: ParsedBlock }> = ({ block }) => {
  const dirAttr = block.rtl ? 'rtl' : 'ltr';
  const fontClass = block.rtl ? 'latex-paper-rtl' : 'latex-paper-prose';

  if (block.type === 'divider') {
    return <hr className="my-6 border-dashed border-neutral-300" />;
  }

  if (block.type === 'section') {
    return (
      <h2
        dir={dirAttr}
        className={`mt-7 mb-3 text-xl font-bold text-neutral-900 tracking-tight ${fontClass}`}
      >
        {block.number && (
          <span className="tabular-nums opacity-75 me-2.5">{block.number}</span>
        )}
        <span>{block.title}</span>
      </h2>
    );
  }

  if (block.type === 'subsection') {
    return (
      <h3
        dir={dirAttr}
        className={`mt-5 mb-2 text-base font-semibold text-neutral-900 ${fontClass}`}
      >
        {block.number && (
          <span className="tabular-nums opacity-75 me-2">{block.number}</span>
        )}
        <span>{block.title}</span>
      </h3>
    );
  }

  if (block.type === 'subsubsection') {
    return (
      <h4
        dir={dirAttr}
        className={`mt-4 mb-1.5 text-sm font-semibold text-neutral-800 ${fontClass}`}
      >
        {block.number && (
          <span className="tabular-nums opacity-75 me-2">{block.number}</span>
        )}
        <span>{block.title}</span>
      </h4>
    );
  }

  if (block.type === 'display-math' && block.math) {
    return (
      <div
        dir="ltr"
        className="my-4 py-2 overflow-x-auto text-center text-neutral-900"
        dangerouslySetInnerHTML={{ __html: renderMathHtml(block.math, true) }}
      />
    );
  }

  if (block.type === 'paragraph' && block.segments) {
    return (
      <p
        dir={dirAttr}
        className={`my-3 text-[15px] leading-[1.8] text-neutral-800 ${fontClass}`}
      >
        <InlineSegmentList segments={block.segments} />
      </p>
    );
  }

  if ((block.type === 'itemize' || block.type === 'enumerate') && block.items) {
    const ListTag = block.type === 'enumerate' ? 'ol' : 'ul';
    return (
      <ListTag
        dir={dirAttr}
        className={`my-3 ps-6 space-y-1.5 text-[14.5px] leading-[1.75] text-neutral-800 ${
          block.type === 'enumerate' ? 'list-decimal' : 'list-disc'
        } ${fontClass}`}
      >
        {block.items.map((segs, i) => (
          <li key={i}>
            <InlineSegmentList segments={segs} />
          </li>
        ))}
      </ListTag>
    );
  }

  if (block.type === 'table' && block.rows) {
    return (
      <div className="my-5">
        {block.caption && (
          <p
            dir={block.rtl ? 'rtl' : 'ltr'}
            className={`text-xs font-medium text-neutral-600 mb-2 text-center ${fontClass}`}
          >
            {block.caption}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm text-neutral-900 border-t-2 border-b-2 border-neutral-800">
            <thead>
              {block.rows[0] && (
                <tr className="border-b border-neutral-400">
                  {block.rows[0].map((cell, ci) => (
                    <th key={ci} className="py-2 px-3 text-left font-semibold">
                      {cell}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {block.rows.slice(1).map((row, ri) => (
                <tr key={ri} className="border-b border-neutral-200 last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1.5 px-3 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.type === 'theorem') {
    return (
      <div
        dir={dirAttr}
        className={`my-4 p-4 rounded-md border border-neutral-300 bg-neutral-50/70 text-neutral-900 ${fontClass}`}
      >
        <div className="text-sm font-bold mb-1">{block.title}</div>
        <div className="text-[14.5px] leading-relaxed italic">
          {block.segments && <InlineSegmentList segments={block.segments} />}
        </div>
      </div>
    );
  }

  if (block.type === 'frame') {
    return (
      <div
        dir={dirAttr}
        className={`my-5 p-6 rounded-lg border border-neutral-300 bg-neutral-50/50 ${fontClass}`}
      >
        <div className="text-base font-bold text-neutral-900 pb-2 mb-3 border-b border-neutral-200">
          {block.title}
        </div>
        <div className="text-[14.5px] leading-relaxed text-neutral-800">
          {block.segments && <InlineSegmentList segments={block.segments} />}
        </div>
      </div>
    );
  }

  if (block.type === 'figure') {
    return (
      <div className="my-5 p-4 border border-neutral-200 rounded bg-neutral-50 text-center">
        <div className="text-xs font-mono text-neutral-500 py-6">
          [Graphic: {block.title}]
        </div>
        {block.caption && (
          <p
            dir={block.rtl ? 'rtl' : 'ltr'}
            className={`text-xs text-neutral-600 mt-2 ${fontClass}`}
          >
            {block.caption}
          </p>
        )}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <pre
        dir="ltr"
        className="my-4 p-3 rounded bg-neutral-100 text-neutral-800 font-mono text-xs overflow-x-auto"
      >
        {block.title}
      </pre>
    );
  }

  return null;
};

export const PdfPreviewPane: React.FC<PdfPreviewPaneProps> = ({
  source,
  compileResult,
  isCompiling,
  theme,
  onOpenExternal,
  onOpenLog,
  onSwitchToXelatex,
  isExternalWindow = false,
}) => {
  const [zoom, setZoom] = useState(100);
  const hasRealNativePdf = Boolean(
    compileResult?.pdfUrl &&
      (compileResult.backendType === 'native-binary' ||
        compileResult.backendType === 'remote-endpoint')
  );
  const isNativeHaltedWithoutPdf = Boolean(
    compileResult &&
      !compileResult.success &&
      !compileResult.pdfUrl &&
      compileResult.backendType === 'native-binary'
  );
  const [viewMode, setViewMode] = useState<'pdf' | 'typeset'>(() =>
    hasRealNativePdf ? 'pdf' : 'typeset'
  );
  const [showDraftDespiteError, setShowDraftDespiteError] = useState(false);

  useEffect(() => {
    setShowDraftDespiteError(false);
    if (hasRealNativePdf) {
      setViewMode('pdf');
    } else if (!compileResult?.pdfUrl) {
      setViewMode('typeset');
    }
  }, [compileResult?.compileId, hasRealNativePdf, compileResult?.pdfUrl]);

  const parsed = useMemo(() => parseLatexDocument(source), [source]);
  const errorMessage =
    compileResult?.diagnostics.find((d) => d.level === 'error')?.message ||
    'Compilation completed with errors.';
  const needsXelatexSwitch =
    Boolean(onSwitchToXelatex) &&
    compileResult?.engineLabel !== 'XELATEX' &&
    /xepersian|xetex/i.test(`${errorMessage}\n${compileResult?.rawLog || ''}`);

  const downloadFilename =
    compileResult?.generatedFiles?.find((f) => /\.pdf$/i.test(f.name))?.name || 'document.pdf';

  return (
    <div
      data-testid="pdf-preview-pane"
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: theme.ui.surfaceAlt,
        color: theme.ui.text,
      }}
    >
      {/* Preview Toolbar */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0"
        style={{
          backgroundColor: theme.ui.surface,
          borderColor: theme.ui.border,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {compileResult?.pdfUrl ? (
            <div
              className="inline-flex items-center p-0.5 rounded-md border"
              style={{
                backgroundColor: theme.ui.surfaceAlt,
                borderColor: theme.ui.border,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
                style={{
                  backgroundColor: viewMode === 'pdf' ? theme.ui.bg : 'transparent',
                  color: viewMode === 'pdf' ? theme.ui.text : theme.ui.textMuted,
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => setViewMode('typeset')}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
                style={{
                  backgroundColor: viewMode === 'typeset' ? theme.ui.bg : 'transparent',
                  color: viewMode === 'typeset' ? theme.ui.text : theme.ui.textMuted,
                }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Typeset
              </button>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap"
              style={{
                backgroundColor: theme.ui.bg,
                borderColor: theme.ui.border,
                color: theme.ui.text,
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Typeset
            </div>
          )}

          {compileResult && (
            <span
              className="hidden sm:inline text-xs tabular-nums whitespace-nowrap ml-1 truncate"
              style={{ color: theme.ui.textMuted }}
            >
              {compileResult.engineLabel} · {compileResult.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Zoom out preview"
            onClick={() => setZoom((z) => Math.max(70, z - 10))}
            className="p-1.5 rounded hover:opacity-80 transition-opacity"
            style={{ color: theme.ui.textMuted }}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span
            className="text-xs tabular-nums w-10 text-center select-none"
            style={{ color: theme.ui.textMuted }}
          >
            {zoom}%
          </span>
          <button
            type="button"
            aria-label="Zoom in preview"
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            className="p-1.5 rounded hover:opacity-80 transition-opacity"
            style={{ color: theme.ui.textMuted }}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {compileResult?.pdfUrl && (
            <a
              href={compileResult.pdfUrl}
              download={downloadFilename}
              aria-label="Download compiled PDF"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border whitespace-nowrap transition-colors"
              style={{
                borderColor: theme.ui.border,
                backgroundColor: theme.ui.bg,
                color: theme.ui.text,
              }}
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </a>
          )}

          {!isExternalWindow && (
            <button
              type="button"
              onClick={onOpenExternal}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border whitespace-nowrap transition-colors"
              style={{
                borderColor: theme.ui.border,
                backgroundColor: theme.ui.bg,
                color: theme.ui.text,
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              External
            </button>
          )}
        </div>
      </div>

      {/* Diagnostic banner when compiler reports errors */}
      {compileResult && !compileResult.success && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-red-800 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          {needsXelatexSwitch && (
            <button
              type="button"
              onClick={onSwitchToXelatex}
              className="px-2 py-0.5 text-[11px] font-semibold rounded bg-red-700 text-white hover:bg-red-800 whitespace-nowrap shrink-0"
            >
              Use XeLaTeX
            </button>
          )}
        </div>
      )}

      {/* Preview Canvas */}
      {isCompiling ? (
        <div
          className="flex-1 flex items-center justify-center text-sm"
          style={{ color: theme.ui.textMuted }}
        >
          Compiling document...
        </div>
      ) : viewMode === 'pdf' && compileResult?.pdfUrl ? (
        <PdfBinaryCanvasViewer
          pdfUrl={compileResult.pdfUrl}
          zoom={zoom}
          theme={theme}
        />
      ) : isNativeHaltedWithoutPdf && !showDraftDespiteError ? (
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div
            className="max-w-md w-full rounded-xl border p-6 space-y-4 text-center shadow-sm"
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: theme.ui.text,
            }}
          >
            <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold">Compilation Halted — No PDF Produced</h3>
              <p className="text-xs leading-relaxed" style={{ color: theme.ui.textMuted }}>
                {errorMessage}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {needsXelatexSwitch && (
                <button
                  type="button"
                  onClick={onSwitchToXelatex}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md"
                  style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                >
                  Switch to XeLaTeX &amp; Compile
                </button>
              )}
              {onOpenLog && (
                <button
                  type="button"
                  onClick={onOpenLog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border"
                  style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  View Compiler Log
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDraftDespiteError(true)}
              className="text-[11px] underline underline-offset-2 opacity-75 hover:opacity-100"
              style={{ color: theme.ui.textMuted }}
            >
              Show live source preview anyway
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div
            className="mx-auto bg-white text-neutral-900 shadow-sm border border-neutral-200 transition-transform origin-top"
            style={{
              width: 'min(100%, 740px)',
              minHeight: '940px',
              padding: '56px 52px',
              transform: `scale(${zoom / 100})`,
              marginBottom: zoom > 100 ? `${(zoom - 100) * 8}px` : undefined,
            }}
          >
            {parsed.hasMaketitle && parsed.title && (
              <header
                dir={parsed.isRtlDocument ? 'rtl' : 'ltr'}
                className={`mb-8 pb-5 border-b border-neutral-200 text-center ${
                  parsed.isRtlDocument ? 'latex-paper-rtl text-center' : 'latex-paper-prose'
                }`}
              >
                <h1 className="text-2xl font-bold text-neutral-950 leading-snug mb-2">
                  {parsed.title}
                </h1>
                {parsed.author && (
                  <p className="text-sm text-neutral-700">{parsed.author}</p>
                )}
                {parsed.date && (
                  <p className="text-xs text-neutral-500 mt-1">{parsed.date}</p>
                )}
              </header>
            )}

            {parsed.blocks.length === 0 ? (
              <div className="py-16 text-center text-sm text-neutral-400">
                Write LaTeX content inside \begin&#123;document&#125; ... \end&#123;document&#125; and click Compile PDF.
              </div>
            ) : (
              parsed.blocks.map((block, index) => <BlockRenderer key={index} block={block} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
};
