import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, AlertTriangle } from 'lucide-react';
import { EditorTheme } from '../utils/themes';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfBinaryCanvasViewerProps {
  pdfUrl: string;
  zoom: number;
  theme: EditorTheme;
}

export const PdfBinaryCanvasViewer: React.FC<PdfBinaryCanvasViewerProps> = ({
  pdfUrl,
  zoom,
  theme,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      const container = containerRef.current;
      if (container) {
        container.innerHTML = '';
      }

      try {
        const res = await fetch(pdfUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`PDF fetch failed (HTTP ${res.status})`);
        }
        const bytes = await res.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        setPageCount(pdfDoc.numPages);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const baseScale = (zoom / 100) * 1.25;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) break;

          const viewport = page.getViewport({ scale: baseScale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className = 'mx-auto bg-white shadow-sm border border-neutral-200 block';
          canvas.setAttribute('aria-label', `PDF page ${pageNum}`);

          if (containerRef.current && !cancelled) {
            containerRef.current.appendChild(canvas);
          }

          await page.render({
            canvasContext: context,
            canvas,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          }).promise;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to render compiled PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfUrl, zoom]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 relative">
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-8 text-xs"
          style={{ color: theme.ui.textMuted }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Rendering compiled PDF...</span>
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto my-8 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && pageCount > 0 && (
        <div
          className="text-center text-[11px] mb-3 tabular-nums"
          style={{ color: theme.ui.textMuted }}
        >
          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
        </div>
      )}

      <div ref={containerRef} data-testid="compiled-pdf-pages" className="space-y-4" />
    </div>
  );
};
