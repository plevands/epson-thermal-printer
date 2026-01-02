# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
