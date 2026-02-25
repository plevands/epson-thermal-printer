/**
 * React hook for Epson printer operations
 */

import { useState, useCallback, useEffect } from 'react';
import { EposPrintService, checkEpsonSDKStatus } from '../lib/epos-print';
import type { 
  EpsonPrinterConfig, 
  PrintResult, 
  PrintOptions,
  PrintBuilderFn,
  UseEpsonPrinterReturn,
  PrinterStatus,
} from '../types';

const NOT_CONFIGURED_RESULT: PrintResult = {
  success: false,
  code: 'NOT_CONFIGURED',
  message: 'Printer not configured',
};

export function useEpsonPrinter(
  config: EpsonPrinterConfig | null,
  options?: PrintOptions
): UseEpsonPrinterReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkStatus, setSdkStatus] = useState<PrinterStatus>({
    loaded: false,
    loading: false,
    error: null,
    classes: [],
  });

  // Check SDK status periodically until loaded
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    const checkStatus = () => {
      const status = checkEpsonSDKStatus();
      setSdkStatus(status);
      
      // Stop checking once SDK is loaded
      if (status.loaded && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    
    // Initial check
    const initialStatus = checkEpsonSDKStatus();
    setSdkStatus(initialStatus);
    
    // Only start interval if SDK is not loaded yet
    if (!initialStatus.loaded) {
      intervalId = setInterval(checkStatus, 1000);
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, []); // Empty deps - only run on mount

  const print = useCallback(
    async (canvas: HTMLCanvasElement): Promise<PrintResult> => {
      if (!config) {
        setError(NOT_CONFIGURED_RESULT.message!);
        return NOT_CONFIGURED_RESULT;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new EposPrintService(config, options);
        const result = await service.printCanvas(canvas);

        if (!result.success) {
          setError(result.message || 'Print failed');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          code: 'ERROR',
          message: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [config, options]
  );

  const printPages = useCallback(
    async (
      canvases: HTMLCanvasElement[],
      pageOptions?: {
        pageSelection?: 'all' | number[];
        headerText?: string;
        footerText?: string;
      }
    ): Promise<PrintResult> => {
      if (!config) {
        setError(NOT_CONFIGURED_RESULT.message!);
        return NOT_CONFIGURED_RESULT;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new EposPrintService(config, options);

        // Filter canvases based on page selection
        let selectedCanvases = canvases;
        if (pageOptions?.pageSelection && pageOptions.pageSelection !== 'all') {
          selectedCanvases = pageOptions.pageSelection
            .map(pageNum => canvases[pageNum - 1])
            .filter(Boolean);
        }

        const result = await service.printPages(selectedCanvases, {
          header: pageOptions?.headerText,
          footer: pageOptions?.footerText,
        });

        if (!result.success) {
          setError(result.message || 'Print failed');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          code: 'ERROR',
          message: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [config, options]
  );

  const printWithBuilder = useCallback(
    async (buildFn: PrintBuilderFn): Promise<PrintResult> => {
      if (!config) {
        setError(NOT_CONFIGURED_RESULT.message!);
        return NOT_CONFIGURED_RESULT;
      }

      setIsLoading(true);
      setError(null);

      try {
        const service = new EposPrintService(config, options);
        const result = await service.printWithBuilder(buildFn);

        if (!result.success) {
          setError(result.message || 'Print failed');
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return {
          success: false,
          code: 'ERROR',
          message: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [config, options]
  );

  const testConnection = useCallback(async (): Promise<PrintResult> => {
    if (!config) {
      setError(NOT_CONFIGURED_RESULT.message!);
      return NOT_CONFIGURED_RESULT;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new EposPrintService(config, options);
      
      // Use the service's testConnection method which prints a test receipt
      const result = await service.testConnection();

      if (!result.success) {
        setError(result.message || 'Connection test failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        code: 'ERROR',
        message: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [config, options]);

  const checkConnection = useCallback(async (): Promise<PrintResult> => {
    if (!config) {
      setError(NOT_CONFIGURED_RESULT.message!);
      return NOT_CONFIGURED_RESULT;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new EposPrintService(config, options);

      // Use the service's checkConnection method (no printing)
      const result = await service.checkConnection();

      if (!result.success) {
        setError(result.message || 'Connection check failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        code: 'ERROR',
        message: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [config, options]);

  return {
    print,
    printPages,
    printWithBuilder,
    checkConnection,
    testConnection,
    isLoading,
    error,
    sdkStatus,
  };
}
