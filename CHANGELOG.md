# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-27

### Changed (**BREAKING**)
- `usePrinterConfig()` now returns `config: EpsonPrinterConfig | null` instead of always returning a default config
  - Without arguments, `config` starts as `null` until `updateConfig()` is called
  - `isConfigured` is now `false` by default (previously always `true`)
- `useEpsonPrinter()` now accepts `config: EpsonPrinterConfig | null`
  - All operations return `{ success: false, code: 'NOT_CONFIGURED' }` when config is null

### Added
- `usePrinterConfig(options?)` accepts an options object with:
  - `initialConfig` — optional initial configuration for new users (e.g. `{ printerIP: '10.0.0.1' }`). `resetConfig()` resets to this value (or `null` if none). localStorage values still take priority for returning users.
  - `storageKey` — custom localStorage key (default: `'epson-printer-config'`). Enables multiple independent printer configurations (e.g. one per network) by using different keys per instance.
- New exported type `UsePrinterConfigOptions`

## [0.1.2] - 2026-01-02

### Added
- `useHttps` option in `EpsonPrinterConfig` for HTTPS printer connections
  - Automatically sets port to 443 when enabled (unless explicitly specified)
  - Useful for printers with TLS/SSL enabled

## [0.1.1] - 2026-01-02

### Added
- Initial public release
- `EposPrintService` class for direct printer communication via Epson ePOS SDK
- React hooks:
  - `useEpsonPrinter` - Printer connection and printing
  - `usePdfProcessor` - PDF to raster image conversion
  - `usePrinterConfig` - Persistent printer configuration
- PDF processing with configurable options:
  - Halftone algorithms (Dither, Error Diffusion, Threshold)
  - Brightness adjustment
  - Mono and grayscale modes
- Support for 80mm (576px) and 58mm (384px) paper widths
- Full TypeScript support with type definitions
- Demo application included

### Fixed
- UI/UX improvements in demo app
- Light mode support
- Responsive layout for different screen sizes
