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
