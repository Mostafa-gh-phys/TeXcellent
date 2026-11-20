import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2, AlertTriangle, Download, Eye } from 'lucide-react';
import { EditorTheme } from '../utils/themes';
import { createPolyfilledWorkerSrc, installMainThreadPdfPolyfills } from '../utils/pdfWorkerSetup';
import {
  clampPageNumber,
  computeFitWidthScale,
  computeNextZoom,
  computeOptimalDprScale,
  normalizeSyncText,
} from '../utils/pdfSync';

installMainThreadPdfPolyfills();
pdfjsLib.GlobalWorkerOptions.workerSrc = createPolyfilledWorkerSrc(pdfWorkerUrl);

export interface PdfJumpRequest {
  page: number;
  nonce: number;
}

export interface PdfForwardSyncRequest {
  text: string;
  nonce: number;
}

interface PdfBinaryCanvasViewerProps {
  pdfUrl: string;
  zoom: number;
  fitMode?: 'width' | 'page';
  theme: EditorTheme;
  downloadFilename?: string;
  searchQuery?: string;
  jumpRequest?: PdfJumpRequest | null;
  forwardSyncRequest?: PdfForwardSyncRequest | null;
  onPageMetricsChange?: (metrics: { currentPage: number; pageCount: number }) => void;
  onZoomChange?: (nextZoom: number) => void;
  onSearchMatchesChange?: (matchCount: number) => void;
  onInverseSync?: (clickedText: string) => void;
  onSwitchToNative?: () => void;
}

interface PageEntry {
  pageNum: number;
  wrapper: HTMLDivElement;
  textLayerDiv: HTMLDivElement;
  rendered: boolean;
  rendering: boolean;
  plainText: string;
  normText: string;
}

export const PdfBinaryCanvasViewer: React.FC<PdfBinaryCanvasViewerProps> = ({
  pdfUrl,
  zoom,
  fitMode = 'width',
  theme,
  downloadFilename = 'document.pdf',
  searchQuery = '',
  jumpRequest = null,
  forwardSyncRequest = null,
  onPageMetricsChange,
  onZoomChange,
  onSearchMatchesChange,
  onInverseSync,
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
  const lastRenderedSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const pageEntriesRef = useRef<PageEntry[]>([]);
  const scrollRatioRef = useRef<number>(0);

  const latestCallbacksRef = useRef({
    zoom,
    onPageMetricsChange,
    onZoomChange,
    onSearchMatchesChange,
    onInverseSync,
  });
  latestCallbacksRef.current = {
    zoom,
    onPageMetricsChange,
    onZoomChange,
    onSearchMatchesChange,
    onInverseSync,
  };

  const [isRendering, setIsRendering] = useState(true);
  const [hasPages, setHasPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [paneMetrics, setPaneMetrics] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Measure outer non-scrolling wrapper so scrollbar changes never cause ResizeObserver loops
  useEffect(() => {
    const el = outerWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const width = Math.round(rect?.width || 0);
      const height = Math.round(rect?.height || 0);
      if (width <= 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const base = lastRenderedSizeRef.current;
        if (
          base.width === 0 ||
          Math.abs(base.width - width) >= 12 ||
          (fitMode === 'page' && Math.abs(base.height - height) >= 16)
        ) {
          setPaneMetrics({ width, height });
        }
      }, 140);
    });
    observer.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitMode]);

  // TeXstudio-like Ctrl/Cmd + Mouse Wheel zoom directly over the PDF canvas
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 10 : -10;
      const next = computeNextZoom(latestCallbacksRef.current.zoom, step);
      if (next !== latestCallbacksRef.current.zoom) {
        latestCallbacksRef.current.onZoomChange?.(next);
      }
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  // Track visible page & scroll ratio cleanly without layout thrashing
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    let rafId = 0;

    const updateVisiblePage = () => {
      rafId = 0;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scrollRatioRef.current = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;

      const entries = pageEntriesRef.current;
      if (entries.length === 0) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const probeY = scrollerRect.top + scrollerRect.height * 0.35;
      let activePage = 1;
      let bestDist = Infinity;

      for (const entry of entries) {
        const rect = entry.wrapper.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) {
          activePage = entry.pageNum;
          break;
        }
        const mid = (rect.top + rect.bottom) / 2;
        const dist = Math.abs(mid - probeY);
        if (dist < bestDist) {
          bestDist = dist;
          activePage = entry.pageNum;
        }
      }

      latestCallbacksRef.current.onPageMetricsChange?.({
        currentPage: activePage,
        pageCount: entries.length,
      });
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateVisiblePage);
      }
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
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

  // Primary double-buffered PDF load & render pipeline
  useEffect(() => {
    const mySeq = ++renderSeqRef.current;
    const activeTasks = new Set<pdfjsLib.RenderTask>();
    let intersectionObserver: IntersectionObserver | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const renderSinglePage = async (
      pdfDoc: pdfjsLib.PDFDocumentProxy,
      entry: PageEntry,
      displayScale: number,
      outputScale: number
    ) => {
      if (entry.rendered || entry.rendering || renderSeqRef.current !== mySeq) return;
      entry.rendering = true;
      try {
        const page = await pdfDoc.getPage(entry.pageNum);
        if (renderSeqRef.current !== mySeq) return;

        const cssViewport = page.getViewport({ scale: displayScale });
        const cssWidth = Math.max(1, Math.round(cssViewport.width));
        const cssHeight = Math.max(1, Math.round(cssViewport.height));

        const clampedOutputScale = computeOptimalDprScale(outputScale, cssWidth, cssHeight);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.max(1, Math.round(cssWidth * clampedOutputScale));
        canvas.height = Math.max(1, Math.round(cssHeight * clampedOutputScale));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.style.setProperty('image-rendering', 'high-quality');
        canvas.dataset.supersample = clampedOutputScale.toFixed(2);
        canvas.dataset.testid = 'pdf-page-canvas';
        canvas.className = 'block';
        canvas.setAttribute('aria-label', `PDF page ${entry.pageNum}`);

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport: cssViewport,
          transform: [clampedOutputScale, 0, 0, clampedOutputScale, 0, 0],
          intent: 'display',
        });
        activeTasks.add(renderTask);
        await renderTask.promise;
        activeTasks.delete(renderTask);

        if (renderSeqRef.current !== mySeq) return;

        entry.wrapper.style.width = `${cssWidth}px`;
        entry.wrapper.style.height = `${cssHeight}px`;
        entry.textLayerDiv.style.setProperty('--total-scale-factor', String(cssViewport.scale));
        entry.textLayerDiv.replaceChildren();

        // Mount canvas first, then attach selectable PDF.js TextLayer
        const existingCanvas = entry.wrapper.querySelector('canvas');
        if (existingCanvas) {
          existingCanvas.replaceWith(canvas);
        } else {
          entry.wrapper.prepend(canvas);
        }

        const textContent = await page.getTextContent();
        if (renderSeqRef.current !== mySeq) return;

        const textItems = (textContent.items as Array<{ str?: string }>)
          .map((item) => item.str || '')
          .filter(Boolean);
        entry.plainText = textItems.join(' ');
        entry.normText = normalizeSyncText(entry.plainText);

        try {
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: entry.textLayerDiv,
            viewport: cssViewport,
          });
          await textLayer.render();
        } catch {
          // Non-fatal: canvas bitmap stays sharp even if TextLayer fails for a glyph
        }

        entry.rendered = true;
      } finally {
        entry.rendering = false;
      }
    };

    const renderPdf = async () => {
      setIsRendering(true);
      setError(null);

      // Preserve current scroll position ratio across recompile/zoom
      const scroller = scrollContainerRef.current;
      const savedRatio =
        scroller && scroller.scrollHeight > scroller.clientHeight
          ? scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)
          : scrollRatioRef.current;

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
        const numPages = pdfDoc.numPages;
        setPageCount(numPages);

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const measuredOuterWidth =
          outerWrapperRef.current?.clientWidth ||
          scrollContainerRef.current?.clientWidth ||
          paneMetrics.width ||
          620;
        const measuredOuterHeight =
          outerWrapperRef.current?.clientHeight ||
          scrollContainerRef.current?.clientHeight ||
          paneMetrics.height ||
          780;
        lastRenderedSizeRef.current = {
          width: measuredOuterWidth,
          height: measuredOuterHeight,
        };

        const firstPage = await pdfDoc.getPage(1);
        if (renderSeqRef.current !== mySeq) return;
        const unscaled = firstPage.getViewport({ scale: 1 });
        const fitWidthScale = computeFitWidthScale(measuredOuterWidth, unscaled.width, 32);
        const fitPageScale = Math.min(
          fitWidthScale,
          Math.max(0.4, (measuredOuterHeight - 48) / Math.max(1, unscaled.height))
        );
        const baseScale = fitMode === 'page' ? fitPageScale : fitWidthScale;
        const displayScale = baseScale * (zoom / 100);
        const baseViewport = firstPage.getViewport({ scale: displayScale });
        const estWidth = Math.max(1, Math.round(baseViewport.width));
        const estHeight = Math.max(1, Math.round(baseViewport.height));

        const nextEntries: PageEntry[] = [];
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const wrapper = document.createElement('div');
          wrapper.className = 'texcellent-pdf-page shadow-sm border border-neutral-200';
          wrapper.dataset.pageNumber = String(pageNum);
          wrapper.style.width = `${estWidth}px`;
          wrapper.style.height = `${estHeight}px`;

          const textLayerDiv = document.createElement('div');
          textLayerDiv.className = 'textLayer';
          wrapper.appendChild(textLayerDiv);

          nextEntries.push({
            pageNum,
            wrapper,
            textLayerDiv,
            rendered: false,
            rendering: false,
            plainText: '',
            normText: '',
          });
        }

        // Render priority pages into detached wrappers BEFORE swapping DOM (zero flicker!)
        const estimatedFocusPage = clampPageNumber(
          Math.round(savedRatio * Math.max(1, numPages - 1)) + 1,
          numPages
        );
        const eagerPages = new Set<number>();
        if (numPages <= 4) {
          for (let p = 1; p <= numPages; p++) eagerPages.add(p);
        } else {
          eagerPages.add(1);
          eagerPages.add(estimatedFocusPage);
          if (estimatedFocusPage > 1) eagerPages.add(estimatedFocusPage - 1);
          if (estimatedFocusPage < numPages) eagerPages.add(estimatedFocusPage + 1);
        }

        await Promise.all(
          Array.from(eagerPages).map((p) =>
            renderSinglePage(pdfDoc, nextEntries[p - 1], displayScale, dpr)
          )
        );

        if (renderSeqRef.current !== mySeq) return;

        pageEntriesRef.current = nextEntries;
        if (containerRef.current) {
          containerRef.current.replaceChildren(...nextEntries.map((e) => e.wrapper));
          setHasPages(nextEntries.length > 0);
        }

        // Restore scroll position seamlessly after atomic swap
        if (scroller && savedRatio > 0) {
          requestAnimationFrame(() => {
            if (renderSeqRef.current !== mySeq || !scrollContainerRef.current) return;
            const maxScroll = Math.max(
              0,
              scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight
            );
            scrollContainerRef.current.scrollTop = Math.round(savedRatio * maxScroll);
          });
        }

        latestCallbacksRef.current.onPageMetricsChange?.({
          currentPage: estimatedFocusPage,
          pageCount: numPages,
        });

        // Lazy-render remaining pages for multi-page documents via IntersectionObserver + idle queue
        if (numPages > eagerPages.size) {
          if (typeof IntersectionObserver !== 'undefined' && scroller) {
            intersectionObserver = new IntersectionObserver(
              (entries) => {
                for (const ioEntry of entries) {
                  if (!ioEntry.isIntersecting) continue;
                  const pNum = Number((ioEntry.target as HTMLElement).dataset.pageNumber || 0);
                  const target = nextEntries[pNum - 1];
                  if (target && !target.rendered && !target.rendering) {
                    renderSinglePage(pdfDoc, target, displayScale, dpr).catch(() => {});
                  }
                }
              },
              { root: scroller, rootMargin: '400px 0px' }
            );
            for (const item of nextEntries) {
              if (!item.rendered) intersectionObserver.observe(item.wrapper);
            }
          }

          // Background warm-render so search & quick scroll find all pages ready
          const pumpRemaining = async () => {
            for (const item of nextEntries) {
              if (renderSeqRef.current !== mySeq) return;
              if (!item.rendered && !item.rendering) {
                await renderSinglePage(pdfDoc, item, displayScale, dpr).catch(() => {});
              }
            }
          };
          idleTimer = setTimeout(() => {
            pumpRemaining().catch(() => {});
          }, 80);
        }
      } catch (err) {
        const isCancel =
          err instanceof Error &&
          (err.name === 'RenderingCancelledException' || /Rendering cancelled/i.test(err.message));
        if (renderSeqRef.current === mySeq && !isCancel) {
          pageEntriesRef.current = [];
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
      if (idleTimer) clearTimeout(idleTimer);
      intersectionObserver?.disconnect();
      for (const task of activeTasks) {
        try {
          task.cancel();
        } catch {
          // ignore cancellation noise
        }
      }
    };
  }, [pdfUrl, zoom, fitMode, paneMetrics.width, paneMetrics.height]);

  // Jump to requested page number
  useEffect(() => {
    if (!jumpRequest || pageEntriesRef.current.length === 0) return;
    const clamped = clampPageNumber(jumpRequest.page, pageEntriesRef.current.length);
    const target = pageEntriesRef.current[clamped - 1];
    if (target) {
      target.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      latestCallbacksRef.current.onPageMetricsChange?.({
        currentPage: clamped,
        pageCount: pageEntriesRef.current.length,
      });
    }
  }, [jumpRequest]);

  // Forward Sync: scroll PDF smoothly to the page containing the source line excerpt
  useEffect(() => {
    if (!forwardSyncRequest || !forwardSyncRequest.text.trim()) return;
    const normTarget = normalizeSyncText(forwardSyncRequest.text);
    if (!normTarget) return;
    const tokens = normTarget.split(' ').filter((t) => t.length >= 2);
    if (tokens.length === 0) return;

    let bestPage: PageEntry | null = null;
    let bestScore = 0;

    for (const entry of pageEntriesRef.current) {
      if (!entry.normText) continue;
      let score = 0;
      if (entry.normText.includes(normTarget)) score += 100;
      for (const tok of tokens) {
        if (entry.normText.includes(tok)) score += 12;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPage = entry;
      }
    }

    if (bestPage && bestScore >= 12) {
      bestPage.wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      latestCallbacksRef.current.onPageMetricsChange?.({
        currentPage: bestPage.pageNum,
        pageCount: pageEntriesRef.current.length,
      });
    }
  }, [forwardSyncRequest]);

  // Highlight search matches across TextLayer spans
  useEffect(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();
    let totalMatches = 0;
    let firstMatchEl: HTMLElement | null = null;

    for (const entry of pageEntriesRef.current) {
      const spans = entry.textLayerDiv.querySelectorAll('span');
      spans.forEach((span) => {
        span.classList.remove('texcellent-pdf-match');
        if (!cleanQuery) return;
        const text = (span.textContent || '').toLowerCase();
        if (text.includes(cleanQuery)) {
          span.classList.add('texcellent-pdf-match');
          totalMatches += 1;
          if (!firstMatchEl) firstMatchEl = span as HTMLElement;
        }
      });
    }

    latestCallbacksRef.current.onSearchMatchesChange?.(totalMatches);
    if (firstMatchEl) {
      (firstMatchEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchQuery, hasPages, pageCount]);

  // Inverse Sync: Ctrl/Cmd+Click or Double-Click PDF text -> jump to matching LaTeX source line
  const handleContainerInteraction = (e: React.MouseEvent<HTMLDivElement>, isDoubleClick: boolean) => {
    if (!onInverseSync) return;
    if (!isDoubleClick && !(e.ctrlKey || e.metaKey)) return;

    const target = e.target as HTMLElement | null;
    const textLayer = target?.closest('.textLayer');
    if (!textLayer) return;

    const selectionText = window.getSelection()?.toString().trim() || '';
    const spanText = target?.tagName === 'SPAN' ? (target.textContent || '').trim() : '';

    let snippet = selectionText.length >= 3 ? selectionText : spanText;
    if (snippet.length < 14 && target?.tagName === 'SPAN') {
      const siblingTexts: string[] = [];
      let prev = target.previousElementSibling;
      let count = 0;
      while (prev && count < 2) {
        if (prev.textContent?.trim()) siblingTexts.unshift(prev.textContent.trim());
        prev = prev.previousElementSibling;
        count++;
      }
      siblingTexts.push(snippet);
      let next = target.nextElementSibling;
      count = 0;
      while (next && count < 2) {
        if (next.textContent?.trim()) siblingTexts.push(next.textContent.trim());
        next = next.nextElementSibling;
        count++;
      }
      snippet = siblingTexts.join(' ').trim();
    }

    if (snippet.length >= 2) {
      onInverseSync(snippet);
    }
  };

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

        <div
          ref={containerRef}
          data-testid="compiled-pdf-pages"
          onClick={(e) => handleContainerInteraction(e, false)}
          onDoubleClick={(e) => handleContainerInteraction(e, true)}
          className="space-y-4 pb-6"
        />
      </div>
    </div>
  );
};
