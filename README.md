# @plevands/epson-thermal-printer

[![npm version](https://img.shields.io/npm/v/@plevands/epson-thermal-printer.svg)](https://www.npmjs.com/package/@plevands/epson-thermal-printer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Library for Epson thermal printer integration with PDF support and React hooks.

## Requirements

- **Node.js** 18.x or higher
- **React** 18.x or higher (optional, for hooks API)
- **pdfjs-dist** 4.x or higher (optional, for PDF processing)
- Epson thermal printer with network connectivity

## Features

- ✅ **Official Epson ePOS SDK** integration with TypeScript support
- 🔄 **Lazy loading** - SDK loads automatically on first use
- 📄 **PDF Processing** - Intelligent margin trimming and scaling for thermal printers
- ⚛️ **React Hooks** - Modern hooks-based API (`useEpsonPrinter`, `usePrinterConfig`, `usePdfProcessor`)
- 🎨 **Optional UI Components** - Ready-to-use React components for quick integration
- 🔧 **Fully Configurable** - Control PDF processing, print quality, paper width, and more
- 📦 **TypeScript First** - Complete type definitions included
- 🎯 **Zero Config** - Works out of the box with sensible defaults
- ✨ **Self-contained** - Epson SDK is embedded, no external dependencies to configure

## Installation

### Development with npm link

```bash
# In the library directory
npm install
npm run build
npm link

# In your project
npm link @plevands/epson-thermal-printer
```

### Usage in Your Projects

```bash
npm install @plevands/epson-thermal-printer
```

> **Note:** The Epson ePOS SDK v2.27.0 is embedded in the library. No additional setup required!

### PDF Processing (Optional)

If you want to use PDF processing features (`processPdfFile`, `usePdfProcessor`), install `pdfjs-dist`:

```bash
npm install pdfjs-dist
```

If you don't use PDF features, you don't need to install it. The library uses dynamic imports so `pdfjs-dist` is only loaded when you call PDF processing functions.

## Setup (Optional)

### Custom PDF.js Worker

The PDF.js worker is auto-configured to use a CDN. Only configure it if you want to use your own worker:

```typescript
import { configurePdfWorker } from '@plevands/epson-thermal-printer';

// Use your own worker instead of CDN
configurePdfWorker('/assets/pdf.worker.min.mjs');
```

## Quick Start

### Basic Usage (Hooks API)

```typescript
import { useEpsonPrinter, usePrinterConfig } from '@plevands/epson-thermal-printer';

function MyPrintComponent() {
  const { config } = usePrinterConfig();
  const { print, isLoading, error } = useEpsonPrinter(config);

  const handlePrint = async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const result = await print(canvas);
    
    if (result.success) {
      alert('Print successful!');
    } else {
      alert(`Print failed: ${result.message}`);
    }
  };

  return (
    <div>
      <button onClick={handlePrint} disabled={isLoading}>
        {isLoading ? 'Printing...' : 'Print'}
      </button>
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### Service API (No React)

```typescript
import { EposPrintService } from '@plevands/epson-thermal-printer';

const service = new EposPrintService({
  printerIP: '192.168.1.100',
  printerPort: 80,
  deviceId: 'local_printer',
});

// SDK loads automatically from configured path (default: /epos-2.27.0.js)
const result = await service.printCanvas(canvas);
```

### With PDF Processing

```typescript
import { 
  useEpsonPrinter, 
  usePdfProcessor,
  usePrinterConfig 
} from '@plevands/epson-thermal-printer';

function PdfPrinter() {
  const { config } = usePrinterConfig();
  const { processFile } = usePdfProcessor({
    enabled: true,
    trimMargins: { top: 10, bottom: 10, left: 5, right: 5 },
    targetWidth: 576, // 80mm paper
    monochromeThreshold: 160,
  });
  const { printPages } = useEpsonPrinter(config);

  const handlePrint = async (file: File) => {
    // Process PDF with margin trimming and scaling
    const pages = await processFile(file);
    
    // Print all processed pages
    const result = await printPages(
      pages.map(p => p.canvas),
      { pageSelection: 'all' }
    );
  };

  return <div>{/* Your UI */}</div>;
}
```

### Using Pre-built Components

```typescript
import { 
  PdfUploader,
  PdfPreview,
  PrinterConfig,
  PrintControls 
} from '@plevands/epson-thermal-printer/components';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState([]);

  return (
    <div>
      <PrinterConfig onConfigChange={(config) => console.log(config)} />
      <PdfUploader onFileSelect={setFile} />
      <PdfPreview 
        file={file} 
        onPagesLoaded={setPages}
        paperWidth={576}
        pdfProcessing={{ enabled: true }}
      />
      <PrintControls pages={pages} />
    </div>
  );
}
```

## Configuration

### PDF Processing Options

```typescript
interface PdfProcessingConfig {
  enabled: boolean;              // Enable/disable processing
  trimMargins?: {
    top?: number;                // Default: 8px
    bottom?: number;             // Default: 8px
    left?: number;               // Default: 8px
    right?: number;              // Default: 8px
  };
  targetWidth?: number;          // Default: 576 (80mm paper)
  scale?: number;                // Render scale, default: 3
  monochromeThreshold?: number;  // 0-255, default: 160
}
```

#### Paper Width Reference

| Paper Size | Width (pixels) | `targetWidth` value |
|------------|----------------|---------------------|
| 80mm       | 576px          | 576 (default)       |
| 58mm       | 384px          | 384                 |

### Print Options

```typescript
interface PrintOptions {
  halftone?: 0 | 1 | 2;  // 0=DITHER, 1=ERROR_DIFFUSION, 2=THRESHOLD
  brightness?: number;    // 0.1 to 10.0, default 1.0
  mode?: 'mono' | 'gray16';
  cut?: boolean;
  align?: 'left' | 'center' | 'right';
}
```

### Printer Configuration

```typescript
interface EpsonPrinterConfig {
  printerIP: string;     // Required
  printerPort?: number;  // Default: 80
  deviceId?: string;     // Default: 'local_printer'
  timeout?: number;      // Default: 60000ms
}
```

## API Reference

### Hooks

#### `useEpsonPrinter(config, options?)`

Main hook for printer operations with automatic SDK loading.

**Returns:**
- `print(canvas)` - Print a single canvas
- `printPages(canvases, options?)` - Print multiple pages
- `testConnection()` - Test printer connection
- `isLoading` - Loading state
- `error` - Error message if any
- `sdkStatus` - SDK loading status

#### `usePrinterConfig()`

Manages printer configuration with localStorage persistence.

**Returns:**
- `config` - Current configuration
- `updateConfig(partial)` - Update configuration
- `resetConfig()` - Reset to defaults
- `isConfigured` - Boolean

#### `usePdfProcessor(config?)`

Process PDF files with configurable options.

**Returns:**
- `processFile(file)` - Process PDF file
- `isProcessing` - Processing state
- `error` - Error message if any

### Services

#### `EposPrintService`

Core service class for printing operations.

```typescript
const service = new EposPrintService(config, options);

// Methods
await service.printCanvas(canvas);
await service.printWithBuilder((builder) => {
  builder.addTextAlign('center');
  builder.addText('Hello World!\n');
  builder.addFeedLine(3);
  builder.addCut('feed');
});
await service.printPages(canvases, { header: 'Header Text' });
await service.testConnection();  // Prints a test receipt
await service.printTestPage();   // Prints a detailed test page
```

#### SDK Loader Functions

```typescript
import { 
  loadEpsonSDK,
  isEpsonSDKLoaded,
  initializeEpsonSDK,
  getEpsonSDK,
  checkEpsonSDKStatus,
} from '@plevands/epson-thermal-printer';

// Check if loaded
const loaded = isEpsonSDKLoaded();

// Check detailed SDK status
const status = checkEpsonSDKStatus();
// Returns: { loaded: boolean, loading: boolean, error: string | null, classes: string[] }

// Get SDK instance (after loading)
const sdk = getEpsonSDK();

// Manual initialization (optional)
const result = await initializeEpsonSDK();

// Note: SDK loads automatically on first print - no manual call needed!
```

#### PDF Processing Functions

```typescript
import {
  configurePdfWorker,
  isPdfWorkerConfigured,
  PDFJS_CDN_WORKER_URL,
  processPdfFile,
  processPdfPage,
} from '@plevands/epson-thermal-printer';

// Configure PDF.js worker (optional but recommended)
configurePdfWorker(PDFJS_CDN_WORKER_URL);

// Check if worker is configured
const configured = isPdfWorkerConfigured();

// Process a PDF file
const pages = await processPdfFile(file, {
  targetWidth: 576,
  trimMargins: { top: 10, bottom: 10 },
});
```

### Logging Configuration

By default, only errors are logged to the console. You can enable debug logs or intercept all logs with a custom handler:

```typescript
import { configureLogger } from '@plevands/epson-thermal-printer';

// Enable all logs (debug, warn, error) in console
configureLogger({ enabled: true });

// Intercept all logs with custom handler
configureLogger({
  enabled: false, // Don't show debug/warn in console (errors always shown)
  onLog: (entry) => {
    // entry: { level: 'debug' | 'warn' | 'error', message: string, args?: unknown[] }
    myLoggingService.log(entry.level, entry.message, entry.args);
  },
});

// Combine both: show in console AND send to custom handler
configureLogger({
  enabled: true,
  onLog: (entry) => sendToAnalytics(entry),
});
```

## Running the Demo App

This repository includes a demo application to test the library:

```bash
# Clone the repository
git clone https://github.com/plevands/epson-printer.git
cd epson-printer

# Install dependencies
npm install

# Start the development server
npm run dev

# Open in browser: http://localhost:5123
```

The demo app provides:
- 🖨️ Printer configuration panel
- 📄 PDF file upload and preview
- 🎨 Real-time PDF processing visualization
- ⚙️ Print controls with customizable options

## Development Workflow with npm link

### In the Library

```bash
# Make changes to the library
npm run build        # Build once
# OR
npm run dev:lib      # Watch mode - rebuilds on changes
```

### In Your Project

```bash
# Link the library (once)
npm link @plevands/epson-thermal-printer

# Your project will use the local version
# Changes to the library reflect immediately after rebuild
```

### Unlinking

```bash
# In your project
npm unlink @plevands/epson-thermal-printer

# In the library
npm unlink
```

## Network Requirements

### CORS Configuration

The printer must allow CORS requests from your application domain. Configure your printer's web interface:

1. Access printer at `http://[PRINTER_IP]`
2. Navigate to Network > CORS settings
3. Add your application origin (e.g., `http://localhost:5173`)

### Firewall

Ensure port 80 (or custom port) is accessible on the printer's IP address.

## Technical Notes

### SDK Inheritance Pattern

The Epson ePOS SDK uses JavaScript prototypal inheritance where `ePOSPrint` extends `ePOSBuilder` via `ePOSPrint.prototype = new ePOSBuilder()`. This pattern has an important implication:

**Problem:** When calling builder methods directly on `ePOSPrint` instance (e.g., `printer.addText()`), the commands accumulate in a shared prototype `message` property, not an instance property. When `send()` is called internally, it creates a new empty `ePOSBuilder` instead of using the accumulated commands.

**Solution:** This library handles this by using separate `ePOSBuilder` instances:

```typescript
// ✅ Correct pattern (used internally by this library)
const builder = new epson.ePOSBuilder();
builder.addText('Hello');
builder.addCut(builder.CUT_FEED);
const xml = builder.toString();

const printer = new epson.ePOSPrint(printerUrl);
printer.send(xml);  // Pass XML explicitly
```

If you're extending this library or using the raw SDK, always follow this pattern to avoid empty print requests.

## Troubleshooting

### SDK Not Loading

The SDK loads automatically on first print. If you see errors:

1. Check console for loading errors
2. Verify `public/epos-2.27.0.js` exists in your build
3. Try manual initialization:
   ```typescript
   import { initializeEpsonSDK } from '@plevands/epson-thermal-printer';
   await initializeEpsonSDK();
   ```

### Connection Failed

- Verify printer IP address is correct
- Check CORS configuration on printer
- Ensure printer is on same network
- Test connection:
  ```typescript
  const { testConnection } = useEpsonPrinter(config);
  await testConnection();
  ```

### Print Quality Issues

Adjust print options:

```typescript
const { print } = useEpsonPrinter(config, {
  halftone: 1,        // Try different values (0, 1, 2)
  brightness: 1.2,    // Increase for lighter prints
  mode: 'mono',       // Or 'gray16' for grayscale
});
```

### PDF Processing Issues

Fine-tune processing config:

```typescript
const { processFile } = usePdfProcessor({
  enabled: true,
  trimMargins: { top: 0, bottom: 0, left: 0, right: 0 }, // Disable trimming
  monochromeThreshold: 180, // Higher = more white
});
```

## Examples

See the included demo app in this repository for complete examples of all features.

```bash
npm run dev    # Start demo app
npm run build  # Build library for production
npm run lint   # Run ESLint
```

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome  | ✅ 90+    |
| Firefox | ✅ 88+    |
| Safari  | ✅ 14+    |
| Edge    | ✅ 90+    |

> **Note:** Requires modern browser with ES2020+ and Canvas API support.

## License

MIT © [Colegio Plevand's](https://github.com/plevands)

## Contributing

Contributions welcome! Please feel free to submit issues and pull requests.
