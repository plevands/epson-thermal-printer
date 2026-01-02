/**
 * Dynamic loader for Epson ePOS SDK
 * Implements singleton pattern to avoid multiple loads
 */

import { debug, warn, error } from './logger';

interface LoaderState {
  loading: boolean;
  loaded: boolean;
  error: Error | null;
  promise: Promise<boolean> | null;
}

const state: LoaderState = {
  loading: false,
  loaded: false,
  error: null,
  promise: null,
};

/**
 * Check if SDK is already available in window
 */
export function isEpsonSDKLoaded(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.epson !== 'undefined' &&
    typeof window.epson.ePOSPrint !== 'undefined'
  );
}

// Import SDK as raw text - Vite will inline this at build time
import epsonSDKSource from '/public/epos-2.27.0.js?raw';

/**
 * Cached blob URL for the SDK
 */
let sdkBlobURL: string | null = null;

/**
 * Get or create the SDK blob URL
 */
function getSDKBlobURL(): string {
  if (!sdkBlobURL) {
    const blob = new Blob([epsonSDKSource], { type: 'application/javascript' });
    sdkBlobURL = URL.createObjectURL(blob);
  }
  return sdkBlobURL;
}

/**
 * Load SDK script dynamically
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if SDK is already loaded (by checking window.epson)
    if (isEpsonSDKLoaded()) {
      resolve();
      return;
    }

    // Check if script already exists in DOM with data attribute
    const existing = document.querySelector('script[data-epson-sdk]');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = true;
    script.setAttribute('data-epson-sdk', 'true');

    script.onload = () => {
      debug('Epson SDK loaded successfully');
      resolve();
    };

    script.onerror = (err) => {
      error('Failed to load Epson SDK:', err);
      reject(new Error('Failed to load Epson SDK'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Wait for SDK to be available in window with timeout
 */
function waitForSDKAvailable(maxWait: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    
    const check = () => {
      if (isEpsonSDKLoaded()) {
        resolve(true);
        return;
      }
      
      if (Date.now() - start > maxWait) {
        warn('Timeout waiting for Epson SDK to be available');
        resolve(false);
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
}

/**
 * Load Epson SDK dynamically (singleton pattern)
 * Returns true if loaded successfully, false otherwise
 */
export async function loadEpsonSDK(options?: {
  timeout?: number;
}): Promise<boolean> {
  // Already loaded
  if (state.loaded || isEpsonSDKLoaded()) {
    state.loaded = true;
    state.loading = false;
    return true;
  }

  // Currently loading - return existing promise
  if (state.loading && state.promise) {
    return state.promise;
  }

  // Start loading
  state.loading = true;
  state.error = null;

  state.promise = (async () => {
    try {
      const timeout = options?.timeout || 10000;

      debug('Loading embedded Epson SDK...');

      // Get blob URL for the embedded SDK
      const sdkUrl = getSDKBlobURL();

      // Load the script
      await loadScript(sdkUrl);

      // Wait for SDK to be available
      const available = await waitForSDKAvailable(timeout);

      if (!available) {
        throw new Error('Epson SDK loaded but not available in window.epson');
      }

      state.loaded = true;
      state.loading = false;
      debug('Epson SDK ready');
      return true;

    } catch (err) {
      state.error = err instanceof Error ? err : new Error(String(err));
      state.loading = false;
      state.loaded = false;
      error('Failed to load Epson SDK:', state.error);
      return false;
    }
  })();

  return state.promise;
}

/**
 * Get current loader state
 */
export function getLoaderState(): Readonly<LoaderState> {
  return { ...state };
}

/**
 * Reset loader state (useful for testing)
 */
export function resetLoaderState(): void {
  state.loading = false;
  state.loaded = false;
  state.error = null;
  state.promise = null;
}

/**
 * Get Epson SDK (throws if not loaded)
 */
export function getEpsonSDK(): typeof window.epson {
  if (!isEpsonSDKLoaded()) {
    throw new Error(
      'Epson SDK not loaded. Call loadEpsonSDK() first or wait for automatic loading.'
    );
  }
  return window.epson;
}

/**
 * Initialize SDK (optional - for eager loading)
 */
export async function initializeEpsonSDK(options?: {
  sdkPath?: string;
  timeout?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const loaded = await loadEpsonSDK(options);
    
    if (!loaded) {
      const loaderState = getLoaderState();
      return {
        success: false,
        error: loaderState.error?.message || 'Failed to load Epson SDK',
      };
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
