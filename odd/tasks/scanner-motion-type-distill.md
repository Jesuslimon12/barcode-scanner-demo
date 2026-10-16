# Feature: scanner-motion-type-distill

## Objective
Close three P2/P3 audit findings (2026-10-16) in one batch: reduced motion, the engine label, and fixed font sizes.

## Scope
- `animate`: under `prefers-reduced-motion: reduce`, the camera feed does not zoom or slide; the confirmation ring (progress feedback) and the guide fade stay.
- `distill`: "Engine: native" leaves the panel and the `aria-live` region; the engine moves into the `debug` overlay. The overlay moves to the top right so it no longer covers the close button.
- `typeset`: the scanner button uses `1em` so it follows the host's text size and user scaling; the demo's own sizes move to `rem`.

Out: accent contrast and tokens (`colorize`), copy (`clarify`), final pass (`polish`).

## Tasks
- [x] T1 Reduced-motion path for the zoom. Route: inline (CSS + one test).
- [x] T2 Engine label only in debug overlay; overlay to the top right. Route: inline (JSX, CSS, tests).
- [x] T3 Relative font sizes for the scanner button and the demo. Route: inline (CSS only).

## Acceptance criteria
- With reduced motion, the video's computed transform stays `none` while a code is locked.
- No "Engine:" text in the panel without `debug`; with `debug`, the overlay shows the engine.
- At 200% root text size, "Try again" scales with the panel copy.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser check at 393×852 and 1440×900.

## Progress
Baseline: 23/23 e2e passing (after scanner-harden).

Evidence (all three tasks, one commit because the CSS changes interleave):
- RED: reduced-motion test (video transform was a zoom matrix), engine-label test (label present), two debug-overlay tests (no engine in overlay). The engine test first passed for the wrong reason (`toHaveCount(0)` retried until the modal closed after confirming); it now counts once.
- GREEN: 24/24 e2e after rebuild; lint clean.
- Browser (Chromium, emulated camera): at 200% root text, button 32px = panel text 32px, no overflow; debug overlay no longer overlaps Close at 393×852 and 1440×900; reduced motion keeps the video transform `none` with the ring still filling; without it the zoom still applies.

## Next step
`/impeccable colorize` (accent contrast, public tokens), then `clarify`, `polish`.
