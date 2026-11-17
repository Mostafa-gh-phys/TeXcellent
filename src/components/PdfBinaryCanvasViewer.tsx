import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2, AlertTriangle, Download } from 'lucide-react';
import { EditorTheme } from '../utils/themes';

// Defensive polyfill for Chromium < 140 / Electron 34 main-thread Uint8Array.prototype.toHex
const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
if (typeof proto.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    configurable: true,
    writable: true,
    value: function toHex(this: Uint8Array): string {
      let hex = '';
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    },
  });
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfBinaryCanvasViewerProps {
  pdfUrl: string;
  zoom: number;
  theme: EditorTheme;
  downloadFilename?: string;
}

export const PdfBinaryCanvasViewer: React.FC<PdfBinaryCanvasViewerProps> = ({
  pdfUrl,
  zoom,
  theme,
  downloadFilename = 'document.pdf',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setPaneWidth((prev) => (Math.abs(prev - width) >= 12 ? width : prev));
      });
    });
    observer.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

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
        const availableWidth = Math.max(
          280,
          (scrollContainerRef.current?.clientWidth || paneWidth || 620) - 48
        );

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) break;

          const unscaled = page.getViewport({ scale: 1 });
          const fitScale = Math.min(1.45, Math.max(0.5, availableWidth / unscaled.width));
          const viewport = page.getViewport({ scale: fitScale * (zoom / 100) });
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
  }, [pdfUrl, zoom, paneWidth]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 sm:p-6 relative">
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
        <div className="max-w-md mx-auto my-8 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div>
            <a
              href={pdfUrl}
              download={downloadFilename}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-300 bg-white text-red-800 font-semibold hover:bg-red-100"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          </div>
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
