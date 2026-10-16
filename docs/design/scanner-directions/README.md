# Scanner visual directions

Phone-size sketches (390×844) from the 2026-10-16 redesign round, kept as starting points for future scanner styles. Each shows the same state: a confirmed EAN-13 read. They are composition and colour sketches, not production code. Open any file in a browser.

| File | Direction | Idea | Palette | Risk |
|---|---|---|---|---|
| `category-standard.html` | Category standard (**chosen**) | Dark viewfinder, corner brackets, frosted bottom sheet. | `#000` `#fff` `#0A84FF` | Looks like every other scanner by design. |
| `shelf-edge.html` | Shelf Edge | The read lands as a supermarket shelf-edge tag clipped into a yellow strip; the strip fills while a read confirms. | `#FFD60A` `#141414` `#FAFAF7` `#D7261E` | Supermarket yellow can read as a promo inside a quiet host. |
| `till-receipt.html` | Till Receipt | Each read prints as a thermal receipt line with a torn edge. | `#F4F1EA` `#2B2B2B` `#8A8A85` `#C23B22` | The obvious scanning artifact. |
| `datamatics.html` | Datamatics | Pure black and white; confirm progress is a bar field filling in. | `#000` `#fff` | Errors have no colour of their own. |
| `ticket-coupon.html` | Ticket Coupon | States stamp onto an airline coupon: VALID, VOID. | `#1C2B5A` `#fff` `#C8102E` `#5B3A8C` | Reads as a travel brand. |

Ideas worth carrying into any style:
- One colour, one meaning: the accent marks only the confirming read; red marks only errors.
- When a read locks, the camera feed drops back and only the result stays lit.
- Changes snap into place rather than floating in.
