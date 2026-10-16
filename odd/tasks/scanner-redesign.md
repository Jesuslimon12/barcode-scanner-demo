# Feature: scanner-redesign

## Objective
Replace the scanner's default look with the category standard, executed at the craft level of the iOS Camera app's code scanning: full-bleed black viewfinder, corner brackets, system yellow for detection, capsule controls. The demo page follows the same world.

## Decision
Redesign round on 2026-10-16 (impeccable new-work, seed:8fa64894f65867a9). The user chose the category standard (canon) over the rolled Shelf Edge direction and named the iOS Camera as the reference. The other directions are kept as sketches in `docs/design/scanner-directions/`. The user allowed changing the theming tokens; the `--bsm-*` API stays because it costs nothing to keep.

## Scope
- Modal: black viewfinder and control area, corner-bracket guide without full-screen dimming, system yellow accent (`#FFD60A` with black text), capsule retry button, blurred close button, iOS dark-mode secondary text and red.
- Guide keeps its element and size (`.bsm-guide`, geometry tests depend on it); only its drawing changes.
- Demo page: same palette and capsule button; result shown as an inset grouped card.
- Docs: PRODUCT.md brand commitment, DESIGN.md from the built world.

Out: behavior, copy, props.

## Tasks
- [ ] T1 Modal restyle in `src/BarcodeScanner.css`. Route: inline (one CSS file, design settled).
- [ ] T2 Demo page restyle in `src/App.jsx` and `src/index.css`. Route: inline (two small files, mechanical).
- [ ] T3 PRODUCT.md commitment, DESIGN.md, sketches. Route: inline (passive docs).

## Acceptance criteria
- Retry text ≥ 4.5:1 on the accent; host `--bsm-accent` still wins.
- Guide geometry unchanged; brackets readable over a bright scene.
- Error, starting, scanning, confirming states render at 393×852, 768×1024 and 1440×900 without overflow.

## Checks
`npm run lint`, `npm run build` then `npx playwright test`, browser round at the three sizes.

## Progress
Baseline: 31/31 e2e (main at c8b4d4e).

## Next step
T1.
