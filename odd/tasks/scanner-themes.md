# Feature: scanner-themes

## Objective
Ship the five redesign directions as built-in scanner themes selected by a `theme` prop, and let the demo page pick one before scanning.

## Decision
2026-10-16: the user chose a component prop over demo-only CSS, accepting a larger public API. Sketches in `docs/design/scanner-directions/` are the visual source.

## Scope
- `theme` prop on `BarcodeScannerModal`: `'standard'` (default, the current iOS-camera look), `'shelf'`, `'receipt'`, `'datamatics'`, `'coupon'`. Rendered as `data-theme` on the dialog; an unknown value falls back to the default look with no code path.
- Themes are CSS only: each sets the internal `--_*` defaults (host `--bsm-*` tokens still win) plus panel, guide, button, code and ring treatment translated from its sketch. No markup changes, no web fonts (system stacks), no behavior change.
- Every theme keeps AA: retry text ≥ 4.5:1 on its accent, error text ≥ 4.5:1 on its panel.
- Demo: a segmented control on the start screen selects the theme; the scanner opens with it.

Out: per-theme copy, theme-specific markup (e.g. the coupon's ruled fields), web fonts.

## Tasks
- [x] T1 `theme` prop + five theme stylesheets in `src/BarcodeScanner.css`, tests (data-theme, fallback, AA per theme, host token still wins). Route: delegated (writer trigger: CSS, JSX and tests, 2+ non-trivial files).
- [x] T2 Demo theme picker in `src/App.jsx`, `src/index.css`, demo test. Route: delegated with T1 (same writer).
  - Evidence: RED 8 new tests failing (no data-theme, no picker radios), GREEN 40/40. Existing keyboard-order test now tabs past the picker. Parent spot check: 40/40, lint clean. Parent fix after the browser round: picker segments size to their label ("Datamatics" touched its edges at 393px).
- [x] T3 DESIGN.md themes section, browser round of every theme. Route: inline (docs; verification by parent).
  - Browser (Chrome, mocked camera over a bright scene): five themes in scanning, confirming and error at 393×852 and 1440×900 (landscape side panel), picker at 393px with no horizontal scroll.

## Acceptance criteria
- `<BarcodeScannerModal theme="receipt" />` renders the receipt look; omitting `theme` renders today's look unchanged.
- Retry and error text pass AA in all five themes.
- Picking a theme in the demo and opening the scanner shows it.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser round of the five themes (scanning, confirming, error) at 393×852 and 1440×900.

## Progress
Baseline: 32/32 e2e (feat/scanner-redesign at d159005).

## Next step
Push and PR are the user's decision.
