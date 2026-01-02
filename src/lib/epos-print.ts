/**
 * ePOS Print SDK Wrapper
 * Uses the official Epson ePOS SDK (epos-2.27.0.js) with dynamic loading
 */

import type { epson } from './epson-sdk';
import { 
  loadEpsonSDK, 
  isEpsonSDKLoaded, 
  getEpsonSDK,
  getLoaderState,
  initializeEpsonSDK,
} from './epson-sdk-loader';
import { debug, error } from './logger';

// Re-export types from central types file
export type { EpsonPrinterConfig, PrintResult, PrintOptions } from '../types';

// Import types for internal use
import type { EpsonPrinterConfig, PrintResult, PrintOptions } from '../types';

// Re-export SDK loader functions
export { 
  loadEpsonSDK, 
  isEpsonSDKLoaded, 
  initializeEpsonSDK,
  getLoaderState,
};

/**
 * Check SDK status - useful for debugging
 */
export function checkEpsonSDKStatus(): { 
  loaded: boolean; 
  loading: boolean;
  error: Error | null;
  classes: string[] 
} {
  const loaderState = getLoaderState();
  const epson = window.epson;
  const classes: string[] = [];
  
  if (epson) {
    if (epson.ePOSBuilder) classes.push('ePOSBuilder');
    if (epson.ePOSPrint) classes.push('ePOSPrint');
    if (epson.CanvasPrint) classes.push('CanvasPrint');
    if (epson.ePOSDevice) classes.push('ePOSDevice');
  }
  
  return {
    loaded: loaderState.loaded || isEpsonSDKLoaded(),
    loading: loaderState.loading,
    error: loaderState.error,
    classes,
  };
}

/**
 * ePOS Print Service using official SDK
 */
export class EposPrintService {
  private config: Required<EpsonPrinterConfig>;
  private printOptions: PrintOptions;
  private initPromise: Promise<boolean> | null = null;

  constructor(config: EpsonPrinterConfig, options: PrintOptions = {}) {
    this.config = {
      printerIP: config.printerIP,
      printerPort: config.printerPort ?? 80,
      deviceId: config.deviceId ?? 'local_printer',
      timeout: config.timeout ?? 60000,
    };
    this.printOptions = {
      halftone: options.halftone ?? 1,
      brightness: options.brightness ?? 1.0,
      mode: options.mode ?? 'mono',
      cut: options.cut ?? true,
      align: options.align ?? 'center',
    };
  }

  /**
   * Ensure SDK is loaded before any print operation (lazy loading)
   */
  private async ensureSDKLoaded(): Promise<boolean> {
    // Already loaded
    if (isEpsonSDKLoaded()) {
      return true;
    }

    // Loading in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start loading
    debug('EposPrintService: Loading Epson SDK...');
    this.initPromise = loadEpsonSDK();
    const result = await this.initPromise;
    this.initPromise = null;
    
    if (!result) {
      error('EposPrintService: Failed to load SDK');
    }
    
    return result;
  }

  /**
   * Get the printer URL for ePOS Print
   */
  private getPrinterUrl(): string {
    const { printerIP, printerPort, deviceId, timeout } = this.config;
    return `http://${printerIP}:${printerPort}/cgi-bin/epos/service.cgi?devid=${deviceId}&timeout=${timeout}`;
  }

  /**
   * Print a canvas element using ePOSBuilder
   * 
   * IMPORTANT: We don't use CanvasPrint.print() directly due to an SDK bug.
   * The SDK's prototypal inheritance causes CanvasPrint.print() to call
   * this.send(printjobid) which internally creates a new empty ePOSBuilder,
   * ignoring all the commands built in 'this'.
   * 
   * Instead, we use ePOSBuilder to construct the print commands manually,
   * get the XML, and send it via ePOSPrint.send(xml).
   */
  async printCanvas(canvas: HTMLCanvasElement): Promise<PrintResult> {
    // Ensure SDK is loaded first
    const sdkLoaded = await this.ensureSDKLoaded();
    if (!sdkLoaded) {
      return {
        success: false,
        code: 'SDK_NOT_LOADED',
        message: 'Failed to load Epson ePOS SDK. Check console for details.',
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      const doResolve = (result: PrintResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Timeout in case printer doesn't respond
      const timeoutId = setTimeout(() => {
        error('printCanvas: timeout reached');
        doResolve({
          success: false,
          code: 'TIMEOUT',
          message: `Sin respuesta de la impresora después de ${this.config.timeout}ms. Verifica la IP y puerto.`,
        });
      }, this.config.timeout + 5000);

      try {
        const epson = getEpsonSDK();
        const printerUrl = this.getPrinterUrl();
        
        // Use separate ePOSBuilder to construct the message
        // This avoids the SDK inheritance bug where send() creates a new empty builder
        const builder = new epson.ePOSBuilder();
        builder.halftone = this.printOptions.halftone ?? 1;
        builder.brightness = this.printOptions.brightness ?? 1.0;
        
        // Get canvas context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timeoutId);
          doResolve({
            success: false,
            code: 'CANVAS_ERROR',
            message: 'No se pudo obtener el contexto 2D del canvas',
          });
          return;
        }
        
        // Build print commands using builder
        debug('printCanvas: Building commands for canvas:', canvas.width, 'x', canvas.height);
        // Access alignment constants from the builder instance (they are instance properties, not static)
        const alignValue = this.getAlignValue(this.printOptions.align);
        builder.addTextAlign(alignValue);
        builder.addImage(ctx, 0, 0, canvas.width, canvas.height);
        
        if (this.printOptions.cut) {
          builder.addCut(builder.CUT_FEED);
        }
        
        // Get the XML from builder
        const xml = builder.toString();
        debug('printCanvas: XML length:', xml.length);
        
        // Create printer for sending
        const printer = new epson.ePOSPrint(printerUrl);
        printer.timeout = this.config.timeout;

        // Set callbacks BEFORE sending
        printer.onreceive = (res) => {
          debug('printCanvas onreceive:', res);
          clearTimeout(timeoutId);
          doResolve({
            success: res.success,
            code: res.code,
            status: res.status,
            message: res.success ? 'Impresión exitosa' : `Error: ${res.code}`,
            printjobid: res.printjobid,
          });
        };

        printer.onerror = (err) => {
          error('printCanvas onerror:', err);
          clearTimeout(timeoutId);
          doResolve({
            success: false,
            code: 'NETWORK_ERROR',
            status: err?.status,
            message: `Error de red: ${err?.responseText || 'Sin conexión'}`,
          });
        };

        // Send the XML directly
        debug('printCanvas: Sending XML to printer...');
        printer.send(xml);
      } catch (err) {
        error('printCanvas error:', err);
        clearTimeout(timeoutId);
        doResolve({
          success: false,
          code: 'SDK_ERROR',
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    });
  }
  
  /**
   * Get alignment value for SDK (instance property values are strings)
   */
  private getAlignValue(align?: string): 'left' | 'center' | 'right' {
    switch (align) {
      case 'left':
        return 'left';
      case 'right':
        return 'right';
      case 'center':
      default:
        return 'center';
    }
  }

  /**
   * Print using ePOSPrint with builder pattern
   */
  async printWithBuilder(buildFn: (builder: epson.ePOSBuilder) => void): Promise<PrintResult> {
    // Ensure SDK is loaded first
    const sdkLoaded = await this.ensureSDKLoaded();
    if (!sdkLoaded) {
      return {
        success: false,
        code: 'SDK_NOT_LOADED',
        message: 'Failed to load Epson ePOS SDK',
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      const doResolve = (result: PrintResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Timeout in case printer doesn't respond
      const timeoutId = setTimeout(() => {
        error('printWithBuilder: timeout reached');
        doResolve({
          success: false,
          code: 'TIMEOUT',
          message: `Sin respuesta de la impresora después de ${this.config.timeout}ms. Verifica la IP y puerto.`,
        });
      }, this.config.timeout + 5000);

      try {
        const epson = getEpsonSDK();
        const printerUrl = this.getPrinterUrl();
        debug('printWithBuilder: Creating ePOSPrint with URL:', printerUrl);
        
        // Use separate ePOSBuilder to construct the message
        const builder = new epson.ePOSBuilder();
        builder.halftone = this.printOptions.halftone ?? 1;
        builder.brightness = this.printOptions.brightness ?? 1.0;
        
        // Build commands using the builder
        debug('printWithBuilder: Building commands...');
        buildFn(builder);
        
        // Get the XML from builder
        const xml = builder.toString();
        debug('printWithBuilder: XML to send:', xml);
        
        // Create printer for sending
        const printer = new epson.ePOSPrint(printerUrl);
        printer.timeout = this.config.timeout;

        // Set callbacks BEFORE sending
        printer.onreceive = (res) => {
          debug('ePOSPrint onreceive:', res);
          clearTimeout(timeoutId);
          doResolve({
            success: res.success,
            code: res.code,
            status: res.status,
            message: res.success ? 'Impresión exitosa' : `Error: ${res.code}`,
            printjobid: res.printjobid,
          });
        };

        printer.onerror = (err) => {
          error('ePOSPrint onerror:', err);
          clearTimeout(timeoutId);
          doResolve({
            success: false,
            code: 'NETWORK_ERROR',
            status: err?.status,
            message: `Error de red: ${err?.responseText || 'Sin conexión'}`,
          });
        };

        // Send XML to printer
        debug('printWithBuilder: Calling printer.send(xml)');
        printer.send(xml);
      } catch (err) {
        error('printWithBuilder error:', err);
        resolve({
          success: false,
          code: 'SDK_ERROR',
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    });
  }

  /**
   * Print multiple canvases (pages) with optional header/footer
   */
  async printPages(
    canvases: HTMLCanvasElement[],
    options?: {
      header?: string;
      footer?: string;
      pageSeparator?: boolean;
    }
  ): Promise<PrintResult> {
    // Ensure SDK is loaded first
    const sdkLoaded = await this.ensureSDKLoaded();
    if (!sdkLoaded) {
      return {
        success: false,
        code: 'SDK_NOT_LOADED',
        message: 'Failed to load Epson ePOS SDK',
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      const doResolve = (result: PrintResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Timeout in case printer doesn't respond
      const timeoutId = setTimeout(() => {
        error('printPages: timeout reached');
        doResolve({
          success: false,
          code: 'TIMEOUT',
          message: `Sin respuesta de la impresora después de ${this.config.timeout}ms`,
        });
      }, this.config.timeout + 10000); // Extra time for multiple pages

      try {
        const epson = getEpsonSDK();
        
        // Use separate ePOSBuilder to construct the message
        const builder = new epson.ePOSBuilder();
        builder.halftone = this.printOptions.halftone ?? 1;
        builder.brightness = this.printOptions.brightness ?? 1.0;

        // Add header if provided
        if (options?.header) {
          builder.addTextAlign('center');
          builder.addTextStyle(false, false, true); // Bold
          builder.addTextSize(2, 2);
          builder.addText(options.header + '\n');
          builder.addTextSize(1, 1);
          builder.addTextStyle(false, false, false);
          builder.addFeedLine(1);
        }

        // Add each page
        canvases.forEach((canvas, index) => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            builder.addTextAlign(this.printOptions.align ?? 'center');
            builder.addImage(
              ctx,
              0, 0,
              canvas.width,
              canvas.height,
              'color_1',
              this.printOptions.mode ?? 'mono'
            );
          }

          // Add separator between pages
          if (options?.pageSeparator && index < canvases.length - 1) {
            builder.addFeedLine(2);
            builder.addTextAlign('center');
            builder.addText('- - - - - - - - - -\n');
            builder.addFeedLine(2);
          }
        });

        // Add footer if provided
        if (options?.footer) {
          builder.addFeedLine(1);
          builder.addTextAlign('center');
          builder.addText(options.footer + '\n');
        }

        // Final feed and cut
        builder.addFeedLine(3);
        if (this.printOptions.cut) {
          builder.addCut('feed');
        }

        // Get the XML from builder
        const xml = builder.toString();
        debug('printPages: XML to send (first 500 chars):', xml.substring(0, 500));

        // Create printer for sending
        const printer = new epson.ePOSPrint(this.getPrinterUrl());
        printer.timeout = this.config.timeout;

        // Set callbacks
        printer.onreceive = (res) => {
          debug('printPages onreceive:', res);
          clearTimeout(timeoutId);
          doResolve({
            success: res.success,
            code: res.code,
            status: res.status,
            message: res.success ? 'Impresión exitosa' : `Error: ${res.code}`,
            printjobid: res.printjobid,
          });
        };

        printer.onerror = (err) => {
          error('printPages onerror:', err);
          clearTimeout(timeoutId);
          doResolve({
            success: false,
            code: 'NETWORK_ERROR',
            status: err?.status,
            message: `Error de red: ${err?.responseText || 'Sin conexión'}`,
          });
        };

        // Send XML to printer
        debug('printPages: sending to printer, pages:', canvases.length);
        printer.send(xml);
      } catch (err) {
        error('printPages error:', err);
        clearTimeout(timeoutId);
        doResolve({
          success: false,
          code: 'SDK_ERROR',
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    });
  }

  /**
   * Check printer connection without printing anything.
   * Sends a status request to verify the printer is online and responding.
   * 
   * @returns Promise with connection result
   * 
   * @example
   * ```typescript
   * const service = new EposPrintService(config);
   * const result = await service.checkConnection();
   * 
   * if (result.success) {
   *   console.log('Printer is online!');
   * } else {
   *   console.log('Printer offline:', result.message);
   * }
   * ```
   */
  async checkConnection(): Promise<PrintResult> {
    debug('checkConnection: starting...');
    
    // Ensure SDK is loaded first
    const sdkLoaded = await this.ensureSDKLoaded();
    if (!sdkLoaded) {
      return {
        success: false,
        code: 'SDK_NOT_LOADED',
        message: 'Failed to load Epson ePOS SDK',
      };
    }

    return new Promise((resolve) => {
      let resolved = false;
      
      const doResolve = (result: PrintResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Shorter timeout for connection check
      const connectionTimeout = Math.min(this.config.timeout, 10000);
      
      const timeoutId = setTimeout(() => {
        error('checkConnection: timeout reached');
        doResolve({
          success: false,
          code: 'TIMEOUT',
          message: `La impresora no responde. Verifica la IP (${this.config.printerIP}) y que esté encendida.`,
        });
      }, connectionTimeout);

      try {
        const epson = getEpsonSDK();
        const printerUrl = this.getPrinterUrl();
        debug('checkConnection: Creating ePOSPrint with URL:', printerUrl);
        
        // Create an empty builder - just to get a valid XML request
        const builder = new epson.ePOSBuilder();
        // Don't add any print commands, just get the empty request
        const xml = builder.toString();
        
        debug('checkConnection: Sending empty request to check status...');
        
        // Create printer for sending
        const printer = new epson.ePOSPrint(printerUrl);
        printer.timeout = connectionTimeout;

        // Set callbacks BEFORE sending
        printer.onreceive = (res) => {
          debug('checkConnection onreceive:', res);
          clearTimeout(timeoutId);
          
          // Even an empty request should get a response if printer is online
          doResolve({
            success: res.success,
            code: res.code,
            status: res.status,
            message: res.success 
              ? 'Impresora conectada y lista' 
              : this.getStatusMessage(res.status),
          });
        };

        printer.onerror = (err) => {
          error('checkConnection onerror:', err);
          clearTimeout(timeoutId);
          doResolve({
            success: false,
            code: 'CONNECTION_ERROR',
            status: err?.status,
            message: `No se puede conectar a la impresora: ${err?.responseText || 'Sin respuesta'}`,
          });
        };

        // Send empty request
        printer.send(xml);
      } catch (err) {
        error('checkConnection error:', err);
        clearTimeout(timeoutId);
        doResolve({
          success: false,
          code: 'SDK_ERROR',
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    });
  }

  /**
   * Get human-readable message for printer status code
   */
  private getStatusMessage(status?: number): string {
    if (!status) return 'Estado desconocido';
    
    const messages: string[] = [];
    
    // Check common status flags
    if (status & 8) messages.push('Impresora offline');
    if (status & 32) messages.push('Tapa abierta');
    if (status & 524288) messages.push('Sin papel');
    if (status & 131072) messages.push('Papel por acabarse');
    if (status & 1024) messages.push('Error mecánico');
    if (status & 2048) messages.push('Error en cuchilla');
    if (status & 8192) messages.push('Error no recuperable');
    
    return messages.length > 0 
      ? messages.join('. ') 
      : 'Impresora lista';
  }

  /**
   * Test printer connection by printing a small test receipt.
   * Use `checkConnection()` if you want to test without printing.
   */
  testConnection(): Promise<PrintResult> {
    debug('testConnection: starting...');
    return this.printWithBuilder((builder) => {
      builder.addTextAlign('center');
      builder.addText('Test de conexión\n');
      builder.addFeedLine(3);
      builder.addCut('feed');
    });
  }

  /**
   * Print a test page
   */
  printTestPage(): Promise<PrintResult> {
    debug('printTestPage: starting...');
    return this.printWithBuilder((builder) => {
      builder.addTextAlign('center');
      builder.addTextStyle(false, false, true); // Bold
      builder.addTextSize(2, 2);
      builder.addText('PÁGINA DE PRUEBA\n');
      builder.addTextSize(1, 1);
      builder.addTextStyle(false, false, false);
      builder.addFeedLine(1);
      
      builder.addText('================================\n');
      builder.addTextAlign('left');
      builder.addText('Impresora: ' + this.config.printerIP + '\n');
      builder.addText('Puerto: ' + this.config.printerPort + '\n');
      builder.addText('Device ID: ' + this.config.deviceId + '\n');
      builder.addText('Halftone: ' + this.printOptions.halftone + '\n');
      builder.addText('Brightness: ' + this.printOptions.brightness + '\n');
      builder.addText('Mode: ' + this.printOptions.mode + '\n');
      builder.addText('================================\n');
      
      builder.addFeedLine(1);
      builder.addTextAlign('center');
      builder.addText('Fecha: ' + new Date().toLocaleString() + '\n');
      
      builder.addFeedLine(3);
      builder.addCut('feed');
    });
  }
}

/**
 * PDF to Canvas conversion utilities
 */
export async function pdfToCanvases(
  pdfFile: File,
  options: {
    scale?: number;
    maxWidth?: number;
  } = {}
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }[]> {
  const { scale = 2, maxWidth = 576 } = options;
  
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const results: { canvas: HTMLCanvasElement; width: number; height: number }[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    let width = viewport.width;
    let height = viewport.height;
    
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = maxWidth;
      height = Math.floor(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);

    await page.render({
      canvasContext: context,
      viewport: page.getViewport({ scale: (width / viewport.width) * scale }),
      canvas,
    }).promise;
    
    results.push({
      canvas,
      width: Math.floor(width),
      height: Math.floor(height),
    });
  }

  return results;
}

/**
 * Convert image file to canvas
 */
export async function imageToCanvas(
  file: File,
  maxWidth: number = 576
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.floor(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve({ canvas, width, height });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Legacy exports for backward compatibility
export class EposPrintBuilder {
  private builder: epson.ePOSBuilder;

  constructor() {
    if (!isEpsonSDKLoaded()) {
      throw new Error('Epson ePOS SDK not loaded');
    }
    const epson = getEpsonSDK();
    this.builder = new epson.ePOSBuilder();
  }

  reset(): this {
    const epson = getEpsonSDK();
    this.builder = new epson.ePOSBuilder();
    return this;
  }

  addText(text: string): this {
    this.builder.addText(text);
    return this;
  }

  addTextLine(text: string): this {
    this.builder.addText(text + '\n');
    return this;
  }

  addFeedLine(lines: number = 1): this {
    this.builder.addFeedLine(lines);
    return this;
  }

  addCut(type: 'no_feed' | 'feed' | 'reserve' = 'feed'): this {
    this.builder.addCut(type);
    return this;
  }

  addTextAlign(align: 'left' | 'center' | 'right'): this {
    this.builder.addTextAlign(align);
    return this;
  }

  addTextStyle(reverse = false, underline = false, bold = false, color: 'color_1' | 'color_2' | 'color_3' | 'color_4' = 'color_1'): this {
    this.builder.addTextStyle(reverse, underline, bold, color);
    return this;
  }

  addTextSize(width: number = 1, height: number = 1): this {
    this.builder.addTextSize(width, height);
    return this;
  }

  addImage(canvas: HTMLCanvasElement, mode: 'mono' | 'gray16' = 'mono'): this {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      this.builder.addImage(ctx, 0, 0, canvas.width, canvas.height, 'color_1', mode);
    }
    return this;
  }

  addBarcode(
    data: string,
    type: string = 'code128',
    hri: 'none' | 'above' | 'below' | 'both' = 'below',
    width: number = 2,
    height: number = 100
  ): this {
    this.builder.addBarcode(data, type, hri, 'font_a', width, height);
    return this;
  }

  addQRCode(
    data: string,
    type: 'model_1' | 'model_2' | 'micro' = 'model_2',
    level: 'level_l' | 'level_m' | 'level_q' | 'level_h' = 'level_m',
    width: number = 4
  ): this {
    this.builder.addSymbol(data, `qrcode_${type}`, level, width);
    return this;
  }

  build(): string {
    return this.builder.toString();
  }

  getBuilder(): epson.ePOSBuilder {
    return this.builder;
  }
}

// Legacy function exports
export async function pdfToImages(
  pdfFile: File,
  options: { scale?: number; maxWidth?: number } = {}
): Promise<{ images: string[]; width: number; height: number }[]> {
  const canvases = await pdfToCanvases(pdfFile, options);
  return canvases.map(({ canvas, width, height }) => ({
    images: [canvas.toDataURL('image/png').split(',')[1]],
    width,
    height,
  }));
}

export async function imageToBase64(file: File): Promise<{ base64: string; width: number; height: number }> {
  const { canvas, width, height } = await imageToCanvas(file);
  return {
    base64: canvas.toDataURL('image/png').split(',')[1],
    width,
    height,
  };
}
