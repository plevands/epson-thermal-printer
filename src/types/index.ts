/**
 * Type definitions for @plevands/epson-thermal-printer library
 */

// Re-export from pdf-processor (single source of truth)
export type { PdfProcessingConfig, ProcessedPage } from '../lib/pdf-processor';

// Import ProcessedPage for use within this file
import type { ProcessedPage } from '../lib/pdf-processor';
import type { epson } from '../lib/epson-sdk';

// Epson Printer Configuration
export interface EpsonPrinterConfig {
  printerIP: string;
  printerPort?: number;
  deviceId?: string;
  timeout?: number;
  /** Use HTTPS instead of HTTP (default: false) */
  useHttps?: boolean;
}

// Print Result
export interface PrintResult {
  success: boolean;
  code?: string;
  status?: number;
  message?: string;
  printjobid?: string;
}

// Print Options
export interface PrintOptions {
  halftone?: 0 | 1 | 2; // 0=DITHER, 1=ERROR_DIFFUSION, 2=THRESHOLD
  brightness?: number;  // 0.1 to 10.0, default 1.0
  mode?: 'mono' | 'gray16';
  cut?: boolean;
  align?: 'left' | 'center' | 'right';
}

// SDK Loader Types
export interface LoaderState {
  loading: boolean;
  loaded: boolean;
  error: Error | null;
}

export interface SDKLoadOptions {
  timeout?: number;
}

export interface InitializeSDKResult {
  success: boolean;
  error?: string;
}

// Printer Status
export interface PrinterStatus {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
  classes: string[];
}

export type PrintBuilderFn = (builder: epson.ePOSBuilder) => void;

// Hook Return Types
export interface UseEpsonPrinterReturn {
  /** Print a single canvas to the thermal printer */
  print: (canvas: HTMLCanvasElement) => Promise<PrintResult>;
  /** Print multiple canvases (pages) with optional page selection */
  printPages: (
    canvases: HTMLCanvasElement[],
    options?: {
      pageSelection?: 'all' | number[];
      headerText?: string;
      footerText?: string;
    }
  ) => Promise<PrintResult>;
  /** Print custom commands using Epson ePOSBuilder */
  printWithBuilder: (buildFn: PrintBuilderFn) => Promise<PrintResult>;
  /** Check printer connection without printing anything */
  checkConnection: () => Promise<PrintResult>;
  /** Test printer connection by printing a small test receipt */
  testConnection: () => Promise<PrintResult>;
  /** Whether a print operation is in progress */
  isLoading: boolean;
  /** Error message from the last operation, if any */
  error: string | null;
  /** Current SDK loading status */
  sdkStatus: PrinterStatus;
}

export interface UsePrinterConfigOptions {
  /** Initial printer configuration used as defaults for new users.
   *  localStorage values take priority over this for returning users. */
  initialConfig?: EpsonPrinterConfig;
  /** Custom localStorage key for persisting this configuration.
   *  Defaults to `'epson-printer-config'`.
   *  Use different keys to manage multiple printer configurations (e.g. per network). */
  storageKey?: string;
}

export interface UsePrinterConfigReturn {
  /** Current printer configuration, or null if not yet configured */
  config: EpsonPrinterConfig | null;
  /** Update configuration (merges with current config or initialConfig defaults) */
  updateConfig: (newConfig: Partial<EpsonPrinterConfig>) => void;
  /** Reset configuration to initial value (initialConfig if provided, otherwise null) and clear localStorage */
  resetConfig: () => void;
  /** Whether the printer has been configured by the user (config is not null and has a valid IP) */
  isConfigured: boolean;
}

export interface UsePdfProcessorReturn {
  processFile: (file: File) => Promise<ProcessedPage[]>;
  isProcessing: boolean;
  error: string | null;
}

// Logger Types
export type LogLevel = 'debug' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  args?: unknown[];
}

export interface LoggerConfig {
  /** Enable debug/warn logs in console (errors always shown). Default: false */
  enabled: boolean;
  /** Callback to intercept all logs (including errors) */
  onLog?: (entry: LogEntry) => void;
}
