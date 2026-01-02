import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { processPdfPage, DEFAULT_PDF_CONFIG } from '../lib/pdf-processor';
import { error as logError } from '../lib/logger';
import type { PdfProcessingConfig, ProcessedPage } from '../types';

// Configure PDF.js worker from CDN to avoid bundling
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfPreviewProps {
  file: File | null;
  onPagesLoaded?: (pages: ProcessedPage[]) => void;
  paperWidth?: 576 | 384; // 576 for 80mm, 384 for 58mm
  pdfProcessing?: PdfProcessingConfig; // Configurable PDF processing
}

export function PdfPreview({
  file, 
  onPagesLoaded, 
  paperWidth = 576,
  pdfProcessing = DEFAULT_PDF_CONFIG,
}: PdfPreviewProps) {
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Reset state when file changes to null
  useEffect(() => {
    if (file) return;
    
    // Cleanup when file is removed
    return () => {
      setPages([]);
      setCurrentPage(0);
    };
  }, [file]);

  // Load PDF when file is provided
  useEffect(() => {
    if (!file) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (cancelled) return;

        const loadedPages: ProcessedPage[] = [];

        // Merge config with paperWidth
        const processingConfig: PdfProcessingConfig = {
          ...pdfProcessing,
          targetWidth: paperWidth,
        };

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          
          // Use the centralized processor
          const processedPage = await processPdfPage(page, processingConfig);
          loadedPages.push(processedPage);
        }

        if (cancelled) return;

        setPages(loadedPages);
        setCurrentPage(0);

        if (onPagesLoaded) {
          onPagesLoaded(loadedPages);
        }
      } catch (err) {
        if (cancelled) return;
        logError('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar el PDF');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [file, onPagesLoaded, paperWidth, pdfProcessing]);

  if (!file) {
    return (
      <div className="pdf-preview pdf-preview-empty">
        <h3>👁️ Vista Previa</h3>
        <div className="preview-placeholder">
          <span className="placeholder-icon">📄</span>
          <p>Sube un archivo PDF para probar la librería</p>
          <span className="placeholder-hint">El documento se renderizará y podrás imprimirlo en tu impresora Epson</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-preview">
      <h3>👁️ Vista Previa</h3>

      {loading && (
        <div className="preview-loading">
          <div className="spinner"></div>
          <p>Cargando PDF...</p>
        </div>
      )}

      {error && (
        <div className="preview-error">
          <p>❌ {error}</p>
        </div>
      )}

      {!loading && !error && pages.length > 0 && (
        <>
          <div className="preview-navigation">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              ◀ Anterior
            </button>
            <span>
              Página {currentPage + 1} de {pages.length}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
              disabled={currentPage === pages.length - 1}
            >
              Siguiente ▶
            </button>
          </div>

          <div className="preview-container">
            <img
              src={pages[currentPage].base64}
              alt={`Página ${currentPage + 1}`}
              className="preview-image"
            />
            <div className="preview-info">
              {pages[currentPage].width} x {pages[currentPage].height} px
            </div>
          </div>
        </>
      )}
    </div>
  );
}
