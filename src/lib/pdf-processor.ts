/**
 * PDF Processing utilities for Epson thermal printers
 * Handles margin trimming, scaling, and monochrome conversion
 * 
 * @remarks
 * PDF processing requires the optional `pdfjs-dist` dependency.
 * If you want to use PDF features, install it:
 * 
 * ```bash
 * npm install pdfjs-dist
 * ```
 * 
 * The library uses dynamic imports, so `pdfjs-dist` is only loaded
 * when you call PDF processing functions. If you don't use PDF features,
 * you don't need to install it.
 */

import type { PDFPageProxy } from 'pdfjs-dist';

/** Cached pdfjs-dist module */
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/** Custom worker source (if configured before loading) */
let customWorkerSrc: string | null = null;

/** Default CDN URL for PDF.js worker (version appended after loading) */
export const PDFJS_CDN_WORKER_BASE = 'https://unpkg.com/pdfjs-dist@';

/** Full CDN URL (populated after loading pdfjs-dist) */
export let PDFJS_CDN_WORKER_URL = '';

/**
 * Error thrown when pdfjs-dist is not installed
 */
export class PdfJsNotInstalledError extends Error {
  constructor() {
    super(
      'pdfjs-dist is not installed.\n\n' +
      'PDF processing features require the pdfjs-dist package.\n' +
      'Install it with:\n\n' +
      '  npm install pdfjs-dist\n\n' +
      'Or with yarn:\n\n' +
      '  yarn add pdfjs-dist\n\n' +
      'This dependency is optional and only required for PDF processing features.'
    );
    this.name = 'PdfJsNotInstalledError';
  }
}

/**
 * Lazily load pdfjs-dist module.
 * Uses dynamic import so the library only loads when PDF functions are called.
 * 
 * @throws {PdfJsNotInstalledError} If pdfjs-dist is not installed
 * @internal
 */
async function getPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  try {
    pdfjsLib = await import('pdfjs-dist');
    
    // Set the CDN URL with actual version
    PDFJS_CDN_WORKER_URL = `${PDFJS_CDN_WORKER_BASE}${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    
    // Configure worker (custom or CDN)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = customWorkerSrc || PDFJS_CDN_WORKER_URL;
    }
    
    return pdfjsLib;
  } catch {
    throw new PdfJsNotInstalledError();
  }
}

/**
 * Check if pdfjs-dist is available (installed).
 * Useful to check before calling PDF functions.
 * 
 * @returns Promise that resolves to true if pdfjs-dist is available
 * 
 * @example
 * ```typescript
 * if (await isPdfJsAvailable()) {
 *   const pages = await processPdfFile(file);
 * } else {
 *   console.log('PDF processing not available. Install pdfjs-dist to enable.');
 * }
 * ```
 */
export async function isPdfJsAvailable(): Promise<boolean> {
  try {
    await getPdfJs();
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure PDF.js worker source.
 * Call this BEFORE using any PDF processing functions.
 * If not called, the worker will be loaded from CDN automatically.
 * 
 * @param workerSrc - URL to the PDF.js worker.
 * 
 * @example
 * ```typescript
 * // Use your own worker instead of CDN
 * configurePdfWorker('/assets/pdf.worker.min.mjs');
 * ```
 */
export function configurePdfWorker(workerSrc: string): void {
  customWorkerSrc = workerSrc;
  if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }
}

/**
 * Check if PDF.js worker is configured
 */
export function isPdfWorkerConfigured(): boolean {
  return !!(customWorkerSrc || pdfjsLib?.GlobalWorkerOptions.workerSrc);
}

export interface PdfProcessingConfig {
  /** Enable PDF processing (trimming, scaling) */
  enabled: boolean;
  /** Margin settings for trimming white space */
  trimMargins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  /** Target width for printer paper (576 for 80mm, 384 for 58mm) */
  targetWidth?: number;
  /** Rendering scale for quality (higher = better quality) */
  scale?: number;
  /** Threshold for monochrome conversion (0-255, lower = darker) */
  monochromeThreshold?: number;
}

export interface ProcessedPage {
  base64: string;
  width: number;
  height: number;
  rasterBase64: string;
  canvas: HTMLCanvasElement;
}

/**
 * Default configuration for PDF processing
 */
export const DEFAULT_PDF_CONFIG: Required<PdfProcessingConfig> = {
  enabled: true,
  trimMargins: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  targetWidth: 576, // 80mm paper
  scale: 3,
  monochromeThreshold: 160,
};

/**
 * Trim white margins from a canvas
 */
function trimCanvasMargins(
  canvas: HTMLCanvasElement,
  margins: { top: number; bottom: number; left: number; right: number }
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // Threshold to consider a pixel "white"
  const whiteThreshold = 250;
  
  // Find content boundaries
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  
  // Find top margin
  topLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx] < whiteThreshold || pixels[idx + 1] < whiteThreshold || pixels[idx + 2] < whiteThreshold) {
        top = y;
        break topLoop;
      }
    }
  }
  
  // Find bottom margin
  bottomLoop: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx] < whiteThreshold || pixels[idx + 1] < whiteThreshold || pixels[idx + 2] < whiteThreshold) {
        bottom = y;
        break bottomLoop;
      }
    }
  }
  
  // Find left margin
  leftLoop: for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx] < whiteThreshold || pixels[idx + 1] < whiteThreshold || pixels[idx + 2] < whiteThreshold) {
        left = x;
        break leftLoop;
      }
    }
  }
  
  // Find right margin
  rightLoop: for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx] < whiteThreshold || pixels[idx + 1] < whiteThreshold || pixels[idx + 2] < whiteThreshold) {
        right = x;
        break rightLoop;
      }
    }
  }
  
  // Apply configured margins
  top = Math.max(0, top - margins.top);
  bottom = Math.min(height - 1, bottom + margins.bottom);
  left = Math.max(0, left - margins.left);
  right = Math.min(width - 1, right + margins.right);
  
  const newWidth = right - left + 1;
  const newHeight = bottom - top + 1;
  
  // If margins are minimal, return original
  if (newWidth >= width - 10 && newHeight >= height - 10) {
    return canvas;
  }
  
  // Create cropped canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = newWidth;
  croppedCanvas.height = newHeight;
  
  const croppedCtx = croppedCanvas.getContext('2d')!;
  croppedCtx.fillStyle = 'white';
  croppedCtx.fillRect(0, 0, newWidth, newHeight);
  croppedCtx.drawImage(canvas, left, top, newWidth, newHeight, 0, 0, newWidth, newHeight);
  
  return croppedCanvas;
}

/**
 * Convert canvas to monochrome raster data for ePOS Print
 */
function canvasToRasterData(canvas: HTMLCanvasElement, threshold: number): string {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  
  // Width must be multiple of 8 for mono printing
  const width = Math.ceil(canvas.width / 8) * 8;
  const height = canvas.height;
  
  // Create binary array (1 bit per pixel, 8 pixels per byte)
  const bytesPerLine = width / 8;
  const rasterData = new Uint8Array(bytesPerLine * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(x, canvas.width - 1);
      const pixelIndex = (y * canvas.width + srcX) * 4;
      
      // Get grayscale value using luminance formula
      const r = pixels[pixelIndex];
      const g = pixels[pixelIndex + 1];
      const b = pixels[pixelIndex + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Convert to 1-bit (1 = black/print, 0 = white/no print)
      const isBlack = gray < threshold ? 1 : 0;
      
      // Set bit in byte (MSB first)
      const byteIndex = y * bytesPerLine + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      
      if (isBlack) {
        rasterData[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < rasterData.length; i++) {
    binary += String.fromCharCode(rasterData[i]);
  }
  return btoa(binary);
}

/**
 * Process a PDF page to canvas with optional trimming and scaling
 */
export async function processPdfPage(
  page: PDFPageProxy,
  config: PdfProcessingConfig = DEFAULT_PDF_CONFIG
): Promise<ProcessedPage> {
  const mergedConfig = {
    ...DEFAULT_PDF_CONFIG,
    ...config,
    trimMargins: {
      ...DEFAULT_PDF_CONFIG.trimMargins,
      ...config.trimMargins,
    },
  };

  // Render at high resolution first
  const renderScale = mergedConfig.scale;
  const highResViewport = page.getViewport({ scale: renderScale });
  
  const highResCanvas = document.createElement('canvas');
  highResCanvas.width = highResViewport.width;
  highResCanvas.height = highResViewport.height;
  
  const highResContext = highResCanvas.getContext('2d')!;
  highResContext.fillStyle = 'white';
  highResContext.fillRect(0, 0, highResCanvas.width, highResCanvas.height);
  
  await page.render({
    canvasContext: highResContext,
    viewport: highResViewport,
    canvas: highResCanvas,
  }).promise;

  let processedCanvas = highResCanvas;

  // Apply trimming if enabled
  if (mergedConfig.enabled) {
    const margins = {
      top: mergedConfig.trimMargins.top ?? 8,
      bottom: mergedConfig.trimMargins.bottom ?? 8,
      left: mergedConfig.trimMargins.left ?? 8,
      right: mergedConfig.trimMargins.right ?? 8,
    };
    processedCanvas = trimCanvasMargins(processedCanvas, margins);
  }

  // Scale to target width if enabled
  let finalCanvas = processedCanvas;
  if (mergedConfig.enabled && mergedConfig.targetWidth) {
    const targetWidth = mergedConfig.targetWidth;
    const aspectRatio = processedCanvas.height / processedCanvas.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetWidth;
    scaledCanvas.height = targetHeight;

    const scaledContext = scaledCanvas.getContext('2d')!;
    scaledContext.fillStyle = 'white';
    scaledContext.fillRect(0, 0, targetWidth, targetHeight);
    scaledContext.drawImage(processedCanvas, 0, 0, targetWidth, targetHeight);

    finalCanvas = scaledCanvas;
  }

  // Generate base64 for preview
  const base64 = finalCanvas.toDataURL('image/png');
  
  // Generate raster data for printing
  const rasterBase64 = canvasToRasterData(finalCanvas, mergedConfig.monochromeThreshold);

  return {
    base64,
    width: finalCanvas.width,
    height: finalCanvas.height,
    rasterBase64,
    canvas: finalCanvas,
  };
}

/**
 * Process all pages of a PDF file.
 * 
 * @remarks
 * Requires `pdfjs-dist` to be installed:
 * ```bash
 * npm install pdfjs-dist
 * ```
 * 
 * @param file - PDF file to process
 * @param config - Processing configuration
 * @returns Promise with array of processed pages
 * @throws {PdfJsNotInstalledError} If pdfjs-dist is not installed
 * 
 * @example
 * ```typescript
 * const pages = await processPdfFile(file, {
 *   enabled: true,
 *   targetWidth: 576, // 80mm paper
 *   trimMargins: { top: 10, bottom: 10, left: 5, right: 5 },
 * });
 * ```
 */
export async function processPdfFile(
  file: File,
  config: PdfProcessingConfig = DEFAULT_PDF_CONFIG
): Promise<ProcessedPage[]> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: ProcessedPage[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const processedPage = await processPdfPage(page, config);
    pages.push(processedPage);
  }

  return pages;
}
