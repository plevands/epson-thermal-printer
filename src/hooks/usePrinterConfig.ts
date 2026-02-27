/**
 * React hook for managing printer configuration with localStorage persistence.
 *
 * Without arguments, config starts as `null` until the user calls `updateConfig`.
 * Pass `initialConfig` to provide defaults for new users (e.g. a known printer IP).
 * Pass `storageKey` to use a custom localStorage key — useful when managing
 * multiple printer configurations (e.g. one per network).
 *
 * @example
 * // No defaults — config is null until user configures
 * const { config, isConfigured } = usePrinterConfig();
 *
 * // With defaults — config starts pre-filled
 * const { config, isConfigured } = usePrinterConfig({
 *   initialConfig: { printerIP: '10.0.0.50' },
 * });
 *
 * // Multiple configs for different networks
 * const office  = usePrinterConfig({ storageKey: 'printer-office' });
 * const warehouse = usePrinterConfig({ storageKey: 'printer-warehouse' });
 */

import { useState, useCallback, useRef } from 'react';
import type { EpsonPrinterConfig, UsePrinterConfigOptions, UsePrinterConfigReturn } from '../types';
import { error } from '../lib/logger';

const DEFAULT_STORAGE_KEY = 'epson-printer-config';

/** Internal defaults applied when merging partial updates */
const INTERNAL_DEFAULTS: Omit<EpsonPrinterConfig, 'printerIP'> = {
  printerPort: 80,
  deviceId: 'local_printer',
  timeout: 60000,
};

/** Helper: load config from localStorage and merge with defaults */
function loadFromStorage(
  storageKey: string,
  initialConfig: EpsonPrinterConfig | undefined,
): EpsonPrinterConfig | null {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<EpsonPrinterConfig>;
      // Merge: INTERNAL_DEFAULTS < initialConfig < stored (localStorage wins)
      return {
        ...INTERNAL_DEFAULTS,
        ...(initialConfig ?? {}),
        ...parsed,
      } as EpsonPrinterConfig;
    }
  } catch (err) {
    error('Failed to load printer config from localStorage:', err);
  }
  return initialConfig ?? null;
}

export function usePrinterConfig(
  options?: UsePrinterConfigOptions
): UsePrinterConfigReturn {
  const { initialConfig, storageKey = DEFAULT_STORAGE_KEY } = options ?? {};

  // Keep a stable reference to the initial config for resetConfig
  const initialConfigRef = useRef(initialConfig ?? null);

  const [config, setConfig] = useState<EpsonPrinterConfig | null>(
    () => loadFromStorage(storageKey, initialConfig),
  );

  // Re-sync state when storageKey changes (e.g. user switches network)
  // This follows React's recommended pattern for adjusting state based on prop changes
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes
  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  if (prevStorageKey !== storageKey) {
    setPrevStorageKey(storageKey);
    setConfig(loadFromStorage(storageKey, initialConfig));
  }

  const updateConfig = useCallback((newConfig: Partial<EpsonPrinterConfig>) => {
    setConfig(prev => {
      // If config was null, merge with initialConfig defaults (if any) + INTERNAL_DEFAULTS
      const base = prev ?? { ...INTERNAL_DEFAULTS, ...(initialConfigRef.current ?? {}) };
      const merged = { ...base, ...newConfig } as EpsonPrinterConfig;
      try {
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch (err) {
        error('Failed to save printer config to localStorage:', err);
      }
      return merged;
    });
  }, [storageKey]);

  const resetConfig = useCallback(() => {
    setConfig(initialConfigRef.current);
    try {
      localStorage.removeItem(storageKey);
    } catch (err) {
      error('Failed to remove printer config from localStorage:', err);
    }
  }, [storageKey]);

  const isConfigured = config !== null && Boolean(
    config.printerIP && 
    config.printerIP.trim() !== '' && 
    config.printerIP !== '0.0.0.0'
  );

  return {
    config,
    updateConfig,
    resetConfig,
    isConfigured,
  };
}
