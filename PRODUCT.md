# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are front-end developers who embed `BarcodeScannerModal` in their own web apps. Their job is to add reliable in-browser barcode scanning without building camera, detection, and confirmation logic themselves. The people who actually point a phone at a barcode are their end users; the modal must serve those end users well, but the host developer decides where and how it appears.

The demo page (`src/App.jsx`) exists to show developers the component working, not as an end-user product.

## Product Purpose

A reusable React modal that opens the device camera, finds a linear barcode, confirms it, and returns `{ code, format }` to the host through `onScan`. Success means a developer can drop it into an app with three props (`open`, `onClose`, `onScan`) and their users get a correct read on the first try, with clear feedback when the camera or detector fails.

## Positioning

Scanning runs entirely in the browser: native `BarcodeDetector` when available, falling back to ZXing WASM elsewhere, so it works across browsers with no server round-trip. Reads are deliberate rather than instant: a code must stay steady in the guide for a confirmation period before it is accepted, and the read is cancelled if the code moves or disappears, which avoids accidental scans of the wrong item.

## Operating Context

- End users scan on mobile browsers, in portrait or landscape, holding the phone over a physical barcode.
- The modal auto-zooms (up to 3x) toward a detected code so it fills most of the screen width.
- Developers verify behavior with the `?debug` URL flag, which overlays the analyzed area and the detected code box, and with Playwright e2e tests (`tests/scanner.spec.js`).

## Capabilities and Constraints

- Distributed as a public package for any host app (packaging and publishing not set up yet).
- Linear formats only: Codabar, Code 39, Code 93, Code 128, EAN-8, EAN-13, ITF, UPC-A, UPC-E. 2D codes (QR, Data Matrix) are intentionally out of scope.
- Built on the native `<dialog>` element (`showModal`); status text is announced through an `aria-live` region.
- States the modal must handle: starting camera, scanning, locked / confirming, camera or detector error with retry.
- Repeated detector failures stop the scanner and show an error instead of failing silently.
- Stack: React 19, Vite, oxlint, Playwright.
- Undecided: the public theming API (which tokens or CSS variables are supported and stable), localization of UI strings (currently English, hard-coded), and how the engine label is exposed.

## Brand Commitments

The default look is the category standard executed at the craft of the iOS Camera app's code scanning (chosen 2026-10-16 over more distinctive directions, kept in `docs/design/scanner-directions/`): black viewfinder, corner brackets, system yellow for detection, capsule controls. Hosts still restyle it through the `--bsm-*` tokens and own their branding.

## Evidence on Hand

- Working demo: `src/App.jsx`; component: `src/BarcodeScanner.jsx`, `src/BarcodeScanner.css`.
- E2E tests: `tests/scanner.spec.js`.
- No users, adopters, benchmarks, download numbers, or testimonials exist. Do not invent any.
- No package name, license, or documentation site exists yet; README is still the Vite template.

## Product Principles

1. **Correct read over fast read.** Confirmation, motion cancellation, and format limits exist to prevent wrong scans; never trade them for speed without a decision.
2. **The host owns the look.** Defaults are neutral and every visual choice should be overridable through a documented token, not hard-coded.
3. **Never fail silently.** Every camera or detector failure reaches the user as a clear state with a way to retry or leave.
4. **Small surface for developers.** Keep the integration to a few props; new options need a real integration need behind them.

## Accessibility & Inclusion

The modal runs inside other people's apps, so it must not lower their accessibility baseline: keyboard-closable dialog, announced status changes, visible focus, and sufficient contrast over a live camera feed. A specific conformance target (e.g. WCAG 2.2 AA) has not been set.
