---
version: 1
slug: "src-barcodescanner-jsx"
primary_target: "src/BarcodeScanner.jsx"
related_targets: ["src/App.jsx"]
---

Scope: the scanner modal (src/BarcodeScanner.jsx, src/BarcodeScanner.css) and its demo page. Mode: Operate.
Audience: end users holding a phone over a barcode; developers embedding the modal.

## Direction contract
THESIS: The category standard played straight, at the craft of the iOS Camera app's code scanning. It refuses novelty skins over a live feed.
OWN-WORLD: Pure black viewfinder and control area, white corner brackets that go system yellow (#FFD60A) on detection, capsule controls with black text on yellow, blurred translucent circle controls over video, SF/system type, iOS dark-mode secondary grey and red.
STORY: The user sees the feed immediately, aims at the brackets, watches the yellow ring confirm, and the code returns. Failures read in plain words with one capsule action.
FIRST VIEWPORT: Full-bleed feed; brackets centered at 80% width; blurred close top-left; status line in the black bottom area, centered, primary action as a full-width capsule.
FORM: category standard (canon, chosen by the user over the roll). seed:8fa64894f65867a9
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
