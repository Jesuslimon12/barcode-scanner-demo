# Feature: scanner-harden

## Objective
Make `BarcodeScannerModal` safe to embed in any host app, as PRODUCT.md commits to ("the host owns the look", "small surface for developers", "never fail silently").

## Problem
The 2026-10-16 audit (`~/Documents/audits/barcode-scanner-demo/2026-10-16-barcode-scanner-modal.pdf`) found that the component behaves as if it owns the page:
- module scope reads `location` (crashes SSR) and starts the 1 MB ZXing WASM download on import;
- generic class names (`.panel`, `.error`, `.code`…) and the `ring-fill` keyframe pick up host styles;
- the host URL `?debug` turns on the debug overlay;
- the `<dialog>` has no accessible name;
- UI strings are hard-coded English, and errors show raw exception text;
- a missing `navigator.mediaDevices` (insecure context) throws during the effect instead of showing an error state.

## Scope
In: SSR-safe module, lazy detector loading on mount, `debug` prop, `bsm-` class and keyframe prefix, dialog name, `labels` prop with error kinds (permission, no camera, camera busy, unsupported, detector stopped).
Out (other audit commands): accent contrast and public tokens (`colorize`), engine label (`distill`), reduced motion (`animate`), rem font sizes (`typeset`), final wording polish (`clarify`).

## Constraints
- Keep the three-prop integration working unchanged; new props are optional.
- Keep the WASM download parallel to the camera permission prompt (test: "wasm starts before camera ready").
- Artifacts in English.

## Tasks
- [x] T1 SSR-safe module: no `window`/`location` access at import; detector loads on first mount, still before `getUserMedia`; a failed download is retried on "Try again". Route: inline (one non-trivial file, `src/BarcodeScanner.jsx`).
  - Evidence: RED `does not download the ZXing WASM until the scanner opens` failed on HEAD (WASM requested on page load). GREEN 19/19. SSR import via `vite.ssrLoadModule` + `renderToString`: before `location is not defined`, after renders `<dialog class="scanner">…`. Lint clean.
- [x] T2 `debug` prop instead of reading the host URL; the demo passes it from `?debug`. Merged into T1's commit: removing `DEBUG` from module scope is the same change. Route: inline.
  - Commit `aa14172`. RDD assess (`--untracked-scope=exclude`, PRODUCT.md untracked): medium, `under_budget` (118 lines), pending in slice.
- [x] T3 Prefix every class and the keyframe with `bsm-`. Route: inline (mechanical rename across CSS/JSX/tests).
  - Evidence: RED `host styles with common class names do not leak into the scanner` failed on the pre-T3 build. GREEN 20/20 after rebuild. Lint clean.
  - Commit `df6f895`. RDD assess: medium, `under_budget` (253 lines).
- [x] T4 Accessible dialog name, `labels` prop, error kinds mapped from camera/detector failures, guard for missing `mediaDevices`. Route: inline (one non-trivial file).
  - Evidence: RED on 4 tests (detector-stopped copy, denied permission, missing `mediaDevices` crashed into the demo ErrorBoundary, unnamed dialog). GREEN 23/23. SSR render with `labels={{ title: 'Escanear código', close: 'Cerrar' }}` outputs both. Browser check (Chromium, emulated camera) at 393×852, 852×393, 768×1024, 1440×900: no horizontal scroll, no panel overflow, no page errors. That check found "Try again" useless on the unsupported error; it is now hidden there (covered by the test).
  - Raw errors go to `console.error` for developers; users only see the mapped copy.

## Acceptance criteria
- Importing the module touches no browser global.
- WASM is not requested until the modal opens; it still starts before the camera resolves.
- A host `.panel`/`.error` rule no longer changes the modal.
- `?debug` alone does not enable the overlay inside the component; the demo still supports it.
- Screen readers announce the dialog by name; every visible string is overridable.
- Each camera failure shows a plain-language message with a next step.

## Checks
`npm run lint`, `npx playwright test` (mobile project), browser verification at 393×852, 852×393, 768×1024, 1440×900.

## Progress
Baseline: 18/18 e2e passing before changes.
Note: a `vite preview` on port 4174 started outside this session (14:53) is reused by Playwright (`reuseExistingServer`), so the suite skips its own build. Run `npm run build` before `npx playwright test`.

## Next step
All tasks done. Remaining audit items: `/impeccable colorize` (accent contrast, public tokens), `optimize` is covered by T1, then `clarify`, `animate`, `distill`, `typeset`, `polish`.
