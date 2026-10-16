# Feature: scanner-colorize

## Objective
Close the audit's color findings: the primary button fails WCAG AA (3.45:1), and hosts cannot theme the modal because its five tokens are private and declared on `.bsm-scanner` itself.

## Strategy
Operate surface, used over a live camera feed. Color only encodes the primary action, the confirmation progress and errors; everything else stays neutral dark so the feed keeps attention. The incumbent green and dark viewfinder are kept (refinement, not a new identity); the green is darkened until white text passes AA.

## Scope
- Public tokens, prefixed and read with fallbacks so a host can set them on `:root` or any ancestor: `--bsm-accent`, `--bsm-on-accent`, `--bsm-background`, `--bsm-surface`, `--bsm-text`, `--bsm-text-muted`, `--bsm-danger`, `--bsm-radius`, `--bsm-font`.
- Default accent `#237a35` (5.38:1 with white); the demo button follows.
- A themed focus ring instead of the browser default.
- Camera overlays (guide, dimming, ring track, close-button scrim) and debug colors stay internal: they exist for legibility over video, not for branding.

Out: copy (`clarify`), final pass (`polish`).

## Tasks
- [x] T1 Public tokens with fallbacks, AA accent, themed focus ring. Route: inline (CSS plus tests; index.css is a one-value change).
  - Evidence: RED contrast 3.45 < 4.5 and host `--bsm-accent` ignored (`rgb(47, 158, 68)`). GREEN 27/27 after rebuild; lint clean.
  - Browser (Chromium, emulated camera): default error state, confirmation ring, a host theme (violet accent, light panel, pill radius) at 393×852; keyboard focus ring on Close over a bright scene and on Try again at 1440×900 and 393×852.
- [x] T2 (found during verification) Close came last in the DOM, so Tab from Close left the modal instead of reaching Try again. Moved it first; RED/GREEN test `keyboard focus moves from Close to Try again in visual order`. Route: inline.

## Acceptance criteria
- "Try again" text on its background ≥ 4.5:1 with the default tokens.
- A host rule `:root { --bsm-accent: … }` changes the button and the ring.
- Focus ring visible on the panel and over the camera.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser check at 393×852 and 1440×900 (error state, scanning state, keyboard focus).

## Progress
Baseline: 24/24 e2e.

## Next step
`/impeccable clarify`, then `polish`.
