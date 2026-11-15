import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  FileText,
  BookOpen,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { ParsedBlock, ParsedInlineSegment, parseLatexDocument } from '../utils/latexParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfPreviewPaneProps {
  source: string;
  compileResult: CompileResult | null;
  isCompiling: boolean;
  theme: EditorTheme;
  onOpenExternal: () => void;
  onRecompile?: () => void;
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
  onRecompile,
  isExternalWindow = false,
}) => {
  const [zoom, setZoom] = useState(100);
  const [viewKind, setViewKind] = useState<'typeset' | 'native-pdf'>('typeset');
  const [pdfRenderState, setPdfRenderState] = useState<{
    loading: boolean;
    error: string;
    pageCount: number;
    byteSize: number;
  }>({ loading: false, error: '', pageCount: 0, byteSize: 0 });

  const pdfPagesHostRef = useRef<HTMLDivElement | null>(null);
  const parsed = useMemo(() => parseLatexDocument(source), [source]);

  const showNativePdf = viewKind === 'native-pdf';

  useEffect(() => {
    if (!showNativePdf || !compileResult?.pdfUrl) return;
    let cancelled = false;
    const renderTasks: Array<{ cancel: () => void }> = [];
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    const renderPdfBinary = async () => {
      setPdfRenderState({ loading: true, error: '', pageCount: 0, byteSize: 0 });
      const host = pdfPagesHostRef.current;
      if (host) host.innerHTML = '';

      try {
        const res = await fetch(compileResult.pdfUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? 'Compiled PDF binary expired on the server. Click Recompile PDF to generate a fresh binary.'
              : `PDF binary request failed (${res.status}).`
          );
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy().catch(() => {});
          return;
        }

        const currentHost = pdfPagesHostRef.current;
        if (!currentHost) return;
        currentHost.innerHTML = '';

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssScale = (zoom / 100) * 1.12;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) break;

          const viewport = page.getViewport({ scale: cssScale });
          const wrapper = document.createElement('div');
          wrapper.className = 'mx-auto bg-white shadow-sm border border-neutral-200 overflow-hidden';
          wrapper.style.width = `${Math.floor(viewport.width)}px`;

          const canvas = document.createElement('canvas');
          canvas.setAttribute('aria-label', `PDF page ${pageNum}`);
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.display = 'block';

          wrapper.appendChild(canvas);
          currentHost.appendChild(wrapper);

          const task = page.render({
            canvas,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          });
          renderTasks.push(task);
          await task.promise;
        }

        if (!cancelled) {
          setPdfRenderState({
            loading: false,
            error: '',
            pageCount: pdfDoc.numPages,
            byteSize: buf.byteLength,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setPdfRenderState({
          loading: false,
          error: err instanceof Error ? err.message : 'Unable to render PDF binary.',
          pageCount: 0,
          byteSize: 0,
        });
      }
    };

    renderPdfBinary();

    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        try {
          task.cancel();
        } catch {
          // ignore
        }
      }
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [showNativePdf, compileResult?.pdfUrl, zoom]);

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
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center p-0.5 rounded-md border"
            style={{
              backgroundColor: theme.ui.surfaceAlt,
              borderColor: theme.ui.border,
            }}
          >
            <button
              type="button"
              onClick={() => setViewKind('typeset')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors"
              style={{
                backgroundColor: viewKind === 'typeset' ? theme.ui.bg : 'transparent',
                color: viewKind === 'typeset' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Typeset
            </button>
            <button
              type="button"
              onClick={() => setViewKind('native-pdf')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors"
              style={{
                backgroundColor: viewKind === 'native-pdf' ? theme.ui.bg : 'transparent',
                color: viewKind === 'native-pdf' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF Binary
            </button>
          </div>

          {compileResult && (
            <span
              className="hidden sm:inline text-xs tabular-nums whitespace-nowrap ml-1"
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
              download="document.pdf"
              aria-label="Download compiled PDF"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap transition-colors"
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
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap transition-colors"
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
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-red-800 text-xs flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {compileResult.diagnostics.find((d) => d.level === 'error')?.message ||
              'Compilation completed with errors.'}
          </span>
        </div>
      )}

      {/* Preview Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isCompiling ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: theme.ui.textMuted }}>
            Compiling document...
          </div>
        ) : showNativePdf ? (
          <div data-testid="pdf-binary-viewer" className="space-y-4">
            {!compileResult?.pdfUrl ? (
              <div
                className="mx-auto max-w-md my-12 p-6 rounded-xl border text-center space-y-3"
                style={{
                  backgroundColor: theme.ui.surface,
                  borderColor: theme.ui.border,
                }}
              >
                <p className="text-sm font-medium">No compiled PDF binary yet</p>
                <p className="text-xs" style={{ color: theme.ui.textMuted }}>
                  Compile your document to generate and render the downloadable PDF binary.
                </p>
                {onRecompile && (
                  <button
                    type="button"
                    onClick={onRecompile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md"
                    style={{ backgroundColor: theme.ui.accent, color: theme.ui.accentFg }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Compile PDF Now
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between max-w-[740px] mx-auto text-xs" style={{ color: theme.ui.textMuted }}>
                  <span>
                    {pdfRenderState.loading
                      ? 'Rendering PDF binary...'
                      : pdfRenderState.pageCount > 0
                        ? `${pdfRenderState.pageCount} page(s) · ${(pdfRenderState.byteSize / 1024).toFixed(1)} KB`
                        : 'PDF Binary Preview'}
                  </span>
                  {onRecompile && (
                    <button
                      type="button"
                      onClick={onRecompile}
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: theme.ui.text }}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Recompile
                    </button>
                  )}
                </div>

                {pdfRenderState.error && (
                  <div className="mx-auto max-w-md my-8 p-5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-center space-y-3">
                    <p className="text-xs">{pdfRenderState.error}</p>
                    {onRecompile && (
                      <button
                        type="button"
                        onClick={onRecompile}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-red-700 text-white"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Recompile PDF
                      </button>
                    )}
                  </div>
                )}

                <div ref={pdfPagesHostRef} className="space-y-4 pb-6" />
              </>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
