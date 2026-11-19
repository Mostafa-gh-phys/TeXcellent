import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2, AlertTriangle, Download, Eye } from 'lucide-react';
import { EditorTheme } from '../utils/themes';
import { createPolyfilledWorkerSrc, installMainThreadPdfPolyfills } from '../utils/pdfWorkerSetup';

installMainThreadPdfPolyfills();
pdfjsLib.GlobalWorkerOptions.workerSrc = createPolyfilledWorkerSrc(pdfWorkerUrl);

interface PdfBinaryCanvasViewerProps {
  pdfUrl: string;
  zoom: number;
  theme: EditorTheme;
  downloadFilename?: string;
  onSwitchToNative?: () => void;
}

export const PdfBinaryCanvasViewer: React.FC<PdfBinaryCanvasViewerProps> = ({
  pdfUrl,
  zoom,
  theme,
  downloadFilename = 'document.pdf',
  onSwitchToNative,
}) => {
  const outerWrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadedDocRef = useRef<{
    url: string;
    loadingTask: pdfjsLib.PDFDocumentLoadingTask;
    doc: pdfjsLib.PDFDocumentProxy;
  } | null>(null);
  const renderSeqRef = useRef(0);
  const lastRenderedWidthRef = useRef(0);

  const [isRendering, setIsRendering] = useState(true);
  const [hasPages, setHasPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);

  // Measure the outer non-scrolling wrapper so scrollbar appearance inside scrollContainerRef
  // can never trigger a ResizeObserver oscillation/blinking loop.
  useEffect(() => {
    const el = outerWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width || 0);
      if (width <= 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const baseline = lastRenderedWidthRef.current;
        if (baseline === 0 || Math.abs(baseline - width) >= 12) {
          setPaneWidth(width);
        }
      }, 140);
    });
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // Cleanup cached PDFDocumentProxy on unmount
  useEffect(() => {
    return () => {
      renderSeqRef.current += 1;
      if (loadedDocRef.current) {
        loadedDocRef.current.loadingTask.destroy().catch(() => {});
        loadedDocRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mySeq = ++renderSeqRef.current;
    let activeRenderTask: pdfjsLib.RenderTask | null = null;

    const renderPdf = async () => {
      setIsRendering(true);
      setError(null);

      try {
        let pdfDoc: pdfjsLib.PDFDocumentProxy;

        if (loadedDocRef.current && loadedDocRef.current.url === pdfUrl) {
          pdfDoc = loadedDocRef.current.doc;
        } else {
          if (loadedDocRef.current) {
            const old = loadedDocRef.current;
            loadedDocRef.current = null;
            await old.loadingTask.destroy().catch(() => {});
            if (renderSeqRef.current !== mySeq) return;
          }

          const res = await fetch(pdfUrl, { cache: 'no-store' });
          if (!res.ok) {
            throw new Error(`PDF fetch failed (HTTP ${res.status})`);
          }
          const bytes = await res.arrayBuffer();
          if (renderSeqRef.current !== mySeq) return;

          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(bytes),
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/',
            useSystemFonts: true,
            verbosity: pdfjsLib.VerbosityLevel.ERRORS,
          });
          pdfDoc = await loadingTask.promise;
          if (renderSeqRef.current !== mySeq) {
            await loadingTask.destroy().catch(() => {});
            return;
          }
          loadedDocRef.current = { url: pdfUrl, loadingTask, doc: pdfDoc };
        }

        if (renderSeqRef.current !== mySeq) return;
        setPageCount(pdfDoc.numPages);

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const desiredOutputScale = Math.min(4, Math.max(3, Math.round(dpr * 2)));
        const measuredOuterWidth =
          outerWrapperRef.current?.clientWidth ||
          scrollContainerRef.current?.clientWidth ||
          paneWidth ||
          620;
        lastRenderedWidthRef.current = measuredOuterWidth;
        const availableWidth = Math.max(280, measuredOuterWidth - 36);

        const nextCanvases: HTMLCanvasElement[] = [];

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (renderSeqRef.current !== mySeq) return;
          const page = await pdfDoc.getPage(pageNum);
          if (renderSeqRef.current !== mySeq) return;

          const unscaled = page.getViewport({ scale: 1 });
          const fitScale = Math.min(2.0, Math.max(0.5, availableWidth / unscaled.width));
          const displayScale = fitScale * (zoom / 100);
          const cssViewport = page.getViewport({ scale: displayScale });

          const cssWidth = Math.max(1, Math.round(cssViewport.width));
          const cssHeight = Math.max(1, Math.round(cssViewport.height));

          // Guard against Chromium canvas memory limits at extreme zoom levels
          const maxDimension = 4096;
          const maxPixels = 16_000_000;
          let outputScale = desiredOutputScale;
          if (cssWidth * outputScale > maxDimension || cssHeight * outputScale > maxDimension) {
            outputScale = Math.min(outputScale, maxDimension / Math.max(cssWidth, cssHeight));
          }
          if (cssWidth * cssHeight * outputScale * outputScale > maxPixels) {
            outputScale = Math.min(outputScale, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
          }
          outputScale = Math.max(1, Number(outputScale.toFixed(2)));

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) continue;

          canvas.width = Math.max(1, Math.round(cssWidth * outputScale));
          canvas.height = Math.max(1, Math.round(cssHeight * outputScale));
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
          canvas.style.setProperty('image-rendering', 'high-quality');
          canvas.dataset.supersample = outputScale.toFixed(2);
          canvas.dataset.testid = 'pdf-page-canvas';
          canvas.className = 'mx-auto bg-white shadow-sm border border-neutral-200 block';
          canvas.setAttribute('aria-label', `PDF page ${pageNum}`);

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);

          const task = page.render({
            canvasContext: context,
            canvas,
            viewport: cssViewport,
            transform: [outputScale, 0, 0, outputScale, 0, 0],
            intent: 'display',
          });
          activeRenderTask = task;
          await task.promise;
          activeRenderTask = null;

          if (renderSeqRef.current !== mySeq) return;
          nextCanvases.push(canvas);
        }

        if (renderSeqRef.current !== mySeq) return;

        if (containerRef.current) {
          containerRef.current.replaceChildren(...nextCanvases);
          setHasPages(nextCanvases.length > 0);
        }
      } catch (err) {
        const isCancel =
          err instanceof Error &&
          (err.name === 'RenderingCancelledException' ||
            /Rendering cancelled/i.test(err.message));
        if (renderSeqRef.current === mySeq && !isCancel) {
          containerRef.current?.replaceChildren();
          setHasPages(false);
          setError(err instanceof Error ? err.message : 'Unable to render compiled PDF.');
        }
      } finally {
        if (renderSeqRef.current === mySeq) {
          setIsRendering(false);
        }
      }
    };

    renderPdf();

    return () => {
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfUrl, zoom, paneWidth]);

  return (
    <div ref={outerWrapperRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-2.5 sm:p-3 relative"
        style={{ scrollbarGutter: 'stable' }}
      >
        {isRendering && !hasPages && (
          <div
            className="flex items-center justify-center gap-2 py-8 text-xs"
            style={{ color: theme.ui.textMuted }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Rendering compiled PDF...</span>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto my-8 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onSwitchToNative && (
                <button
                  type="button"
                  onClick={onSwitchToNative}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-300 bg-white text-red-900 font-semibold hover:bg-red-100"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Use Native PDF Viewer
                </button>
              )}
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

        {!error && pageCount > 0 && hasPages && (
          <div
            className="text-center text-[11px] mb-3 tabular-nums flex items-center justify-center gap-1.5"
            style={{ color: theme.ui.textMuted }}
          >
            <span>
              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            </span>
            {isRendering && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
        )}

        <div
          ref={containerRef}
          data-testid="compiled-pdf-pages"
          className={`space-y-4 transition-opacity duration-150 ${
            isRendering && hasPages ? 'opacity-70' : 'opacity-100'
          }`}
        />
      </div>
    </div>
  );
};
