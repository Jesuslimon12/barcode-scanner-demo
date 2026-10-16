# Design

The scanner's default look follows the iOS Camera app's code scanning: the camera leads, chrome is black, and yellow means "a code is being read". Hosts override everything below through the public `--bsm-*` tokens in `src/BarcodeScanner.css`.

## Color

| Role | Token | Default | Use |
|---|---|---|---|
| Accent | `--bsm-accent` | `#ffd60a` | Retry button, confirmation ring, text selection. Nothing else. |
| On accent | `--bsm-on-accent` | `#000` | Text on the accent (14.9:1). |
| Background / surface | `--bsm-background`, `--bsm-surface` | `#000` | Modal and control area: no grey panel, the feed meets black. |
| Text | `--bsm-text` | `#fff` | The scanned code, focus ring. |
| Secondary text | `--bsm-text-muted` | `#98989d` | Status hints. |
| Danger | `--bsm-danger` | `#ff453a` | Error messages only. |

Over the camera, white with a soft dark drop shadow (guide corners, ring track) and translucent black with a 20px backdrop blur (close button) keep controls legible on any scene. These are internal, not tokens.

## Type

System stack (`-apple-system, system-ui`), set through `--bsm-font`. Status text at 1.0625em, the code in the system monospace at 1.25em with tabular numerals. Sizes are relative so the modal follows the host's and the user's text size.

## Shape

- Guide: four 36px corner brackets, 4px stroke, 18px radius, drawn by masking a full border; the box keeps its 2:1 geometry because detection crops to it.
- Buttons: capsules (`--bsm-radius`, default 999px), 50px tall; pressed state fades to 0.7.
- Close: 44px circle, top-left.

## Motion

Zoom toward the code (300ms ease-out), guide fade on lock (200ms), the ring filling over the confirmation time. Reduced motion removes the zoom and keeps the ring, the only progress signal.

## Demo page

Same palette: yellow capsule "Scan barcode" with a barcode glyph, result in an inset grouped list (`#1c1c1e`, hairline separators) like iOS Settings.

## Themes

`<BarcodeScannerModal theme="…" />` picks one of five built-in looks, rendered as `data-theme` on the dialog. They are CSS only (no markup or behavior change, system fonts) and each sets its own defaults for the internal tokens, so host `--bsm-*` values still win. An unknown value falls back to `standard`. Sources: `docs/design/scanner-directions/`.

| Theme | Panel | Accent / on accent | Error | Signature |
|---|---|---|---|---|
| `standard` (default) | `#000` | `#ffd60a` / `#000` | `#ff453a` | iOS Camera: corner brackets, capsule button. |
| `shelf` | `#ffd60a` with ink top rule | `#141414` / `#ffd60a` | `#b3120a` bold | Shelf-edge strip; the code on a white price tag. |
| `receipt` | `#f4f1ea` thermal paper, torn top edge | `#2b2b2b` / `#f4f1ea` | `#c23b22` | Monospace throughout, dashed guide. |
| `datamatics` | `#fff` | `#000` / `#fff` | inverted block, white on black | Pure black and white, 1px guide, square corners. |
| `coupon` | white card on `#1c2b5a` | `#c8102e` / `#fff` | `#c8102e` | Ticket coupon, purple carbon code. |

Every theme keeps retry and error text at WCAG AA (checked by e2e tests). Sketch content that would need markup (shelf notch, receipt line items, datamatics bar field, coupon fields and stamps) is not built.
