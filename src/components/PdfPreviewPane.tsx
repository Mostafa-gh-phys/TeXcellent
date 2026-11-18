import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  FileText,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { CompileResult } from '../types/latex';
import { EditorTheme } from '../utils/themes';
import { PdfBinaryCanvasViewer } from './PdfBinaryCanvasViewer';

interface PdfPreviewPaneProps {
  compileResult: CompileResult | null;
  isCompiling: boolean;
  theme: EditorTheme;
  onOpenExternal: () => void;
  onRecompile?: () => void;
  onOpenLog?: () => void;
  onSwitchToXelatex?: () => void;
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
  isExternalWindow = false,
}) => {
  const [zoom, setZoom] = useState(100);

  const errorMessage =
    compileResult?.diagnostics.find((d) => d.level === 'error')?.message ||
    'Compilation completed with errors.';
  const needsXelatexSwitch =
    Boolean(onSwitchToXelatex) &&
    compileResult?.engineLabel !== 'XELATEX' &&
    /xepersian|fontspec|bidi|xetex|xelatex/i.test(`${errorMessage}\n${compileResult?.rawLog || ''}`);

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
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border whitespace-nowrap"
            style={{
              backgroundColor: theme.ui.bg,
              borderColor: theme.ui.border,
              color: theme.ui.text,
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            Compiled PDF
          </div>

          {compileResult && (
            <span
              className="hidden sm:inline text-xs tabular-nums whitespace-nowrap ml-1 truncate"
              style={{ color: theme.ui.textMuted }}
            >
              {compileResult.engineLabel} · {compileResult.distributionLabel} · {compileResult.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Zoom out preview"
            onClick={() => setZoom((z) => Math.max(60, z - 10))}
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
            onClick={() => setZoom((z) => Math.min(250, z + 10))}
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

      {/* Compiled PDF Output */}
      {isCompiling ? (
        <div
          className="flex-1 flex items-center justify-center text-sm"
          style={{ color: theme.ui.textMuted }}
        >
          Compiling document...
        </div>
      ) : compileResult?.pdfUrl ? (
        <PdfBinaryCanvasViewer
          pdfUrl={compileResult.pdfUrl}
          zoom={zoom}
          theme={theme}
          downloadFilename={downloadFilename}
        />
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
