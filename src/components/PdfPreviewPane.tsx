import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  FileText,
  Terminal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Maximize2,
  X,
  Loader2,
} from 'lucide-react';
import { CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { clampPageNumber, computeNextZoom } from '../utils/pdfSync';
import {
  PdfBinaryCanvasViewer,
  PdfForwardSyncRequest,
  PdfJumpRequest,
} from './PdfBinaryCanvasViewer';

interface PdfPreviewPaneProps {
  compileResult: CompileResult | null;
  isCompiling: boolean;
  theme: EditorTheme;
  onOpenExternal: () => void;
  onRecompile?: () => void;
  onOpenLog?: () => void;
  onSwitchToXelatex?: () => void;
  onInverseSync?: (clickedText: string, clickedWord?: string) => void;
  forwardSyncRequest?: PdfForwardSyncRequest | null;
  isExternalWindow?: boolean;
}

export const PdfPreviewPane: React.FC<PdfPreviewPaneProps> = ({
  compileResult,
  isCompiling,
  theme,
  onOpenExternal,
  onRecompile,
  onOpenLog,
  onSwitchToXelatex,
  onInverseSync,
  forwardSyncRequest = null,
  isExternalWindow = false,
}) => {
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<'width' | 'page'>('width');
  const [viewerEngine, setViewerEngine] = useState<'canvas' | 'native'>('canvas');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [jumpRequest, setJumpRequest] = useState<PdfJumpRequest | null>(null);

  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatchCount, setFindMatchCount] = useState(0);

  useEffect(() => {
    if (compileResult?.pageCount) {
      setPageCount(compileResult.pageCount);
      setCurrentPage((prev) => clampPageNumber(prev, compileResult.pageCount));
    }
  }, [compileResult?.pageCount]);

  const errorMessage =
    compileResult?.diagnostics.find((d) => d.level === 'error')?.message ||
    'Compilation completed with errors.';
  const needsXelatexSwitch =
    Boolean(onSwitchToXelatex) &&
    compileResult?.engineLabel !== 'XELATEX' &&
    /xepersian|fontspec|bidi|xetex|xelatex/i.test(`${errorMessage}\n${compileResult?.rawLog || ''}`);

  const downloadFilename =
    compileResult?.generatedFiles?.find((f) => /\.pdf$/i.test(f.name))?.name || 'document.pdf';

  const jumpToPage = (nextPage: number) => {
    const clamped = clampPageNumber(nextPage, Math.max(1, pageCount));
    setCurrentPage(clamped);
    setJumpRequest({ page: clamped, nonce: Date.now() });
  };

  return (
    <div
      data-testid="pdf-preview-pane"
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: theme.ui.surfaceAlt,
        color: theme.ui.text,
      }}
    >
      {/* Preview Toolbar — matches TeXcellent minimalistic style */}
      <div
        className="flex items-center justify-between gap-1 px-2 py-1.5 border-b shrink-0 overflow-x-auto"
        style={{
          backgroundColor: theme.ui.surface,
          borderColor: theme.ui.border,
        }}
      >
        <div className="flex items-center gap-1 shrink-0">
          <div
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0"
            title={
              compileResult
                ? `${compileResult.engineLabel} · ${compileResult.distributionLabel} · ${compileResult.durationMs}ms`
                : 'Compiled PDF Preview'
            }
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: theme.ui.text,
            }}
          >
            {isCompiling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: theme.ui.accent }} />
            ) : (
              <FileText className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{isCompiling && compileResult?.pdfUrl ? 'Updating' : 'Preview'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Page Navigation when Canvas viewer has rendered pages */}
          {viewerEngine === 'canvas' && compileResult?.pdfUrl && pageCount > 0 && (
            <div
              className="hidden sm:flex items-center gap-0.5 px-1 py-0.5 rounded border text-[11px] tabular-nums"
              style={{ backgroundColor: theme.ui.bg, borderColor: theme.ui.border }}
              aria-label="PDF page navigation"
            >
              <button
                type="button"
                aria-label="Previous PDF page"
                disabled={currentPage <= 1}
                onClick={() => jumpToPage(currentPage - 1)}
                className="p-0.5 rounded disabled:opacity-35 hover:opacity-80"
                style={{ color: theme.ui.textMuted }}
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="px-0.5 select-none" style={{ color: theme.ui.text }}>
                {currentPage}/{pageCount}
              </span>
              <button
                type="button"
                aria-label="Next PDF page"
                disabled={currentPage >= pageCount}
                onClick={() => jumpToPage(currentPage + 1)}
                className="p-0.5 rounded disabled:opacity-35 hover:opacity-80"
                style={{ color: theme.ui.textMuted }}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Canvas vs Native Chromium PDFium Switch */}
          <div
            role="group"
            aria-label="PDF viewer engine"
            className="flex items-center p-0.5 rounded border"
            style={{ backgroundColor: theme.ui.surfaceAlt, borderColor: theme.ui.border }}
          >
            <button
              type="button"
              onClick={() => setViewerEngine('canvas')}
              aria-pressed={viewerEngine === 'canvas'}
              title="Embedded PDF.js Canvas + Selectable Text + SyncTeX Viewer"
              className="px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors"
              style={{
                backgroundColor: viewerEngine === 'canvas' ? theme.ui.bg : 'transparent',
                color: viewerEngine === 'canvas' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => setViewerEngine('native')}
              aria-pressed={viewerEngine === 'native'}
              title="Native Browser / Chromium PDFium Viewer"
              className="px-1.5 py-0.5 text-[11px] font-semibold rounded transition-colors"
              style={{
                backgroundColor: viewerEngine === 'native' ? theme.ui.bg : 'transparent',
                color: viewerEngine === 'native' ? theme.ui.text : theme.ui.textMuted,
              }}
            >
              Native
            </button>
          </div>

          {viewerEngine === 'canvas' && (
            <>
              <button
                type="button"
                aria-label="Toggle fit width or fit full page"
                aria-pressed={fitMode === 'page'}
                onClick={() => {
                  setFitMode((m) => (m === 'width' ? 'page' : 'width'));
                  setZoom(100);
                }}
                title={fitMode === 'width' ? 'Switch to Fit Full Page' : 'Switch to Fit Width'}
                className="p-1 rounded hover:opacity-80 transition-opacity"
                style={{ color: fitMode === 'page' ? theme.ui.accent : theme.ui.textMuted }}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Zoom out preview"
                onClick={() => setZoom((z) => computeNextZoom(z, -10))}
                className="p-1 rounded hover:opacity-80 transition-opacity"
                style={{ color: theme.ui.textMuted }}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFitMode('width');
                  setZoom(100);
                }}
                title="Reset zoom to 100% Fit Width"
                className="text-[11px] tabular-nums w-8 text-center select-none hover:opacity-80"
                style={{ color: theme.ui.textMuted }}
              >
                {zoom}%
              </button>
              <button
                type="button"
                aria-label="Zoom in preview"
                onClick={() => setZoom((z) => computeNextZoom(z, 10))}
                className="p-1 rounded hover:opacity-80 transition-opacity"
                style={{ color: theme.ui.textMuted }}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {compileResult?.pdfUrl && (
                <button
                  type="button"
                  aria-label="Find in PDF"
                  aria-pressed={showFindBar}
                  onClick={() => setShowFindBar((v) => !v)}
                  title="Find text inside compiled PDF"
                  className="p-1 rounded hover:opacity-80 transition-opacity"
                  style={{ color: showFindBar ? theme.ui.accent : theme.ui.textMuted }}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          {compileResult?.pdfUrl && (
            <a
              href={compileResult.pdfUrl}
              download={downloadFilename}
              aria-label="Download compiled PDF"
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap transition-colors"
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
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded border whitespace-nowrap transition-colors"
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

      {/* Minimal inline PDF search bar (when toggled) */}
      {showFindBar && viewerEngine === 'canvas' && compileResult?.pdfUrl && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-b text-xs shrink-0"
          style={{
            backgroundColor: theme.ui.surface,
            borderColor: theme.ui.border,
          }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: theme.ui.textMuted }} />
          <input
            type="search"
            autoFocus
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowFindBar(false);
                setFindQuery('');
              }
            }}
            placeholder="Find text in PDF (double-click or Ctrl+Click text to jump to LaTeX source)..."
            aria-label="Find text in PDF"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: theme.ui.text }}
          />
          {findQuery.trim() && (
            <span className="text-[11px] tabular-nums shrink-0" style={{ color: theme.ui.textMuted }}>
              {findMatchCount} {findMatchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            type="button"
            aria-label="Close PDF search"
            onClick={() => {
              setShowFindBar(false);
              setFindQuery('');
            }}
            className="p-0.5 rounded hover:opacity-80"
            style={{ color: theme.ui.textMuted }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Compiled PDF Output — stays mounted seamlessly during recompiles to prevent blinking */}
      {compileResult?.pdfUrl ? (
        viewerEngine === 'native' ? (
          <iframe
            key={compileResult.pdfUrl}
            title="Native PDF Preview"
            data-testid="native-pdf-iframe"
            src={`${compileResult.pdfUrl}#navpanes=0&view=FitH`}
            className="flex-1 w-full h-full border-0 bg-neutral-700"
          />
        ) : (
          <PdfBinaryCanvasViewer
            pdfUrl={compileResult.pdfUrl}
            zoom={zoom}
            fitMode={fitMode}
            theme={theme}
            downloadFilename={downloadFilename}
            searchQuery={findQuery}
            jumpRequest={jumpRequest}
            forwardSyncRequest={forwardSyncRequest}
            onPageMetricsChange={({ currentPage: nextCur, pageCount: nextTotal }) => {
              setCurrentPage(nextCur);
              setPageCount(nextTotal);
            }}
            onZoomChange={setZoom}
            onSearchMatchesChange={setFindMatchCount}
            onInverseSync={onInverseSync}
            onSwitchToNative={() => setViewerEngine('native')}
          />
        )
      ) : isCompiling ? (
        <div
          className="flex-1 flex items-center justify-center gap-2 text-sm"
          style={{ color: theme.ui.textMuted }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Compiling document...</span>
        </div>
      ) : compileResult && !compileResult.success ? (
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
              <h3 className="text-sm font-semibold">Compilation Failed — No PDF Produced</h3>
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
              {onRecompile && (
                <button
                  type="button"
                  onClick={onRecompile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border"
                  style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.surface }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recompile
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
          </div>
        </div>
      ) : (
        <div
          className="flex-1 flex items-center justify-center p-6 text-center text-sm"
          style={{ color: theme.ui.textMuted }}
        >
          Click Compile PDF to generate the PDF output.
        </div>
      )}
    </div>
  );
};
