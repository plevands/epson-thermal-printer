/**
 * React hook for managing printer configuration with localStorage persistence.
 *
 * Without arguments, config starts as `null` until the user calls `updateConfig`.
 * Pass an `initialConfig` to provide defaults for new users (e.g. a known printer IP).
 *
 * @example
 * // No defaults — config is null until user configures
 * const { config, isConfigured } = usePrinterConfig();
 *
 * // With defaults — config starts pre-filled
 * const { config, isConfigured } = usePrinterConfig({ printerIP: '10.0.0.50' });
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { EpsonPrinterConfig, UsePrinterConfigReturn } from '../types';
import { error } from '../lib/logger';

const STORAGE_KEY = 'epson-printer-config';

/** Internal defaults applied when merging partial updates */
const INTERNAL_DEFAULTS: Omit<EpsonPrinterConfig, 'printerIP'> = {
  printerPort: 80,
  deviceId: 'local_printer',
  timeout: 60000,
};

export function usePrinterConfig(
  initialConfig?: EpsonPrinterConfig
): UsePrinterConfigReturn {
  // Keep a stable reference to the initial config for resetConfig
  const initialConfigRef = useRef(initialConfig ?? null);

  const [config, setConfig] = useState<EpsonPrinterConfig | null>(() => {
    // 1. Try to load from localStorage (user has previously configured)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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

    // 2. No localStorage → use initialConfig if provided, otherwise null
    return initialConfig ?? null;
  });

  // Track whether the user has explicitly called updateConfig in this session
  // to avoid writing initialConfig defaults to localStorage on mount
  const hasUserUpdated = useRef(false);

  // Save to localStorage only after explicit user updates
  useEffect(() => {
    if (!hasUserUpdated.current) return;
    if (config === null) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      error('Failed to save printer config to localStorage:', err);
    }
  }, [config]);

  const updateConfig = useCallback((newConfig: Partial<EpsonPrinterConfig>) => {
    hasUserUpdated.current = true;
    setConfig(prev => {
      // If config was null, merge with initialConfig defaults (if any) + INTERNAL_DEFAULTS
      const base = prev ?? { ...INTERNAL_DEFAULTS, ...(initialConfigRef.current ?? {}) };
      return { ...base, ...newConfig } as EpsonPrinterConfig;
    });
  }, []);

  const resetConfig = useCallback(() => {
    hasUserUpdated.current = false;
    setConfig(initialConfigRef.current);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      error('Failed to remove printer config from localStorage:', err);
    }
  }, []);

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
