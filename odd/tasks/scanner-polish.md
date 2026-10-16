# Feature: scanner-polish

## Objective
Final pass before shipping: fix the remaining visual and copy defects found in the browser and close the non-blocking review follow-ups.

## Evidence
Browser round (Chromium, emulated camera) at 393×852, 768×1024 and 1440×900 in the scanning, confirming and error states; no console errors.

## Scope
- Copy: "The scanner stopped working. Try again." repeats the button label; drop the second sentence.
- Panel text wraps with an orphan word in the 280px desktop side panel: `text-wrap: pretty`.
- The close control is a `×` text glyph, whose weight and size depend on the platform font; replace with an authored SVG.
- `labels` entries that are `undefined` (e.g. a missing translation) erased the default text.
- Changing `debug` re-ran the camera effect without resetting the scanner state; remount instead.
- Missing tests for the no-camera, camera-busy and detector-download-failure paths.

Out: an SSR import test (needs a Vite SSR harness; verified manually during harden).

## Tasks
- [x] T1 Copy, wrapping and SVG close icon. Route: inline (JSX + CSS, already understood).
  - Evidence: RED on the stopped-working copy test, GREEN after. Browser second round at the three sizes: one-line error on desktop, SVG close icon renders evenly.
- [x] T2 `undefined` labels keep defaults; `debug` change remounts the scanner. Route: inline. No e2e test: the demo host passes neither `labels` nor a changing `debug`; both are one-line fixes.
- [x] T3 Tests for no camera, camera busy, download failure with recovery on retry. Route: inline. Green on first run: they cover existing behavior.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser round at the three sizes.

## Progress
Baseline: 28/28 e2e.

Final: 31/31 e2e, lint clean.

## Next step
None in the audit plan. Delivery (push/PR) is the user's decision.
