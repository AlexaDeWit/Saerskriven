#set document(title: "Two diagrams", date: none)
#set page(paper: "a4", margin: 2cm, numbering: "1", fill: rgb("#F9F6F0"))
#set text(font: "Liberation Sans", size: 10pt, fill: rgb("#38342E"))
#show raw: set text(font: "Liberation Mono", size: 9pt)
#set table(inset: 5pt)
#let saer-badge(label, tone) = box(inset: (x: 3pt, y: 1pt), radius: 2pt, fill: tone, stroke: (paint: tone, thickness: 3pt), text(fill: rgb("#FAF8F2"), label))
#show table: set text(size: 8pt)

#page(flipped: true)[
#grid(rows: (auto, 1fr), row-gutter: 1em,
heading(level: 1)[#"Taking an order"],
align(center + horizon)[
#image(bytes("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-8 12 1256 536\" width=\"1256\" height=\"536\"><title>Taking an order</title><rect x=\"-8\" y=\"12\" width=\"1256\" height=\"536\" fill=\"#F9F6F0\"></rect><style>.pn-element {
  font-family: \"Liberation Sans\";
}
.pn-shape {
  fill: #FAF8F2;
  stroke: #38342E;
  stroke-width: 2;
}
.pn-actor {
  fill: #EAE5DA;
}
.pn-process {
  fill: #E7E9E1;
}
.pn-store {
  fill: none;
  stroke-width: 2.5;
}
.pn-boundary-box,
.pn-boundary-curve {
  fill: none;
  stroke: #6B655C;
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.pn-out-of-scope {
  opacity: 0.5;
}
.pn-out-of-scope .pn-shape {
  stroke-dasharray: 6 4;
}
.pn-label {
  fill: #38342E;
  font-size: 10px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-note {
  fill: #6B655C;
  font-size: 12px;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-flow {
  fill: none;
}
.pn-flow-arrow {
  fill: #38342E;
  stroke: none;
}
.pn-flow-label {
  fill: #6B655C;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: #F9F6F0;
  stroke-width: 3;
  stroke-linejoin: round;
}
.pn-badge {
  stroke: #FAF8F2;
  stroke-width: 3;
}
.pn-badge-count {
  fill: #FAF8F2;
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-badge-primary .pn-badge-count {
  font-size: 11px;
}
.pn-badge-secondary .pn-badge-count {
  font-size: 9px;
}
.pn-badge-mark {
  fill: #FAF8F2;
  stroke: none;
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-badge-flag {
  stroke-linejoin: round;
}
.pn-tone-critical {
  fill: #C14339;
}
.pn-tone-high {
  fill: #A85E1D;
}
.pn-tone-medium {
  fill: #46788A;
}
.pn-tone-low {
  fill: #4B6B50;
}
.pn-tone-neutral {
  fill: #756E63;
}
.pn-tone-flag {
  fill: #38342E;
}

.pn-tone-low { fill: #4B6B50; stroke: #4B6B50; stroke-width: 3; }
.pn-tone-low ~ .pn-badge-count, .pn-tone-low ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-medium { fill: #46788A; stroke: #46788A; stroke-width: 3; }
.pn-tone-medium ~ .pn-badge-count, .pn-tone-medium ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-high { fill: #A85E1D; stroke: #A85E1D; stroke-width: 3; }
.pn-tone-high ~ .pn-badge-count, .pn-tone-high ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-critical { fill: #C14339; stroke: #C14339; stroke-width: 3; }
.pn-tone-critical ~ .pn-badge-count, .pn-tone-critical ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-neutral { fill: #756E63; stroke: #756E63; stroke-width: 3; }
.pn-tone-neutral ~ .pn-badge-count, .pn-tone-neutral ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-flag { fill: #38342E; stroke: #38342E; stroke-width: 3; }
.pn-tone-flag ~ .pn-badge-count, .pn-tone-flag ~ .pn-badge-mark { fill: #FAF8F2; }</style><g transform=\"translate(300, 20)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-boundary-box\" width=\"560\" height=\"520\"></rect><text class=\"pn-label\" x=\"280\" y=\"11\"><tspan x=\"280\" dy=\"0\">Shop network</tspan></text></g></g><g transform=\"translate(0, 220)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"140\" height=\"80\"></rect><text class=\"pn-label\" x=\"70\" y=\"40\"><tspan x=\"70\" dy=\"0\">Shopper</tspan></text><g class=\"pn-badge\" transform=\"translate(140, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-high\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">H</text></g></g></g></g><g transform=\"translate(460, 200)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"70\" cy=\"70\" r=\"70\"></circle><text class=\"pn-label\" x=\"70\" y=\"70\"><tspan x=\"70\" dy=\"0\">Web shop</tspan></text></g></g><g transform=\"translate(680, 60)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"150\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"80\" x2=\"150\" y2=\"80\"></line><text class=\"pn-label\" x=\"75\" y=\"40\"><tspan x=\"75\" dy=\"0\">Catalogue</tspan></text></g></g><g transform=\"translate(680, 420)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"150\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"80\" x2=\"150\" y2=\"80\"></line><text class=\"pn-label\" x=\"75\" y=\"40\"><tspan x=\"75\" dy=\"0\">Order ledger</tspan></text><g class=\"pn-badge\" transform=\"translate(150, 0)\"><g class=\"pn-badge-flag\" transform=\"translate(0, 0)\"><path class=\"pn-tone-flag\" d=\"M 0 -11 L 11 11 L -11 11 Z\"></path><text class=\"pn-badge-mark\" y=\"4\">!</text></g></g></g></g><g transform=\"translate(1040, 200)\"><g class=\"pn-element pn-out-of-scope\"><circle class=\"pn-shape pn-process\" cx=\"70\" cy=\"70\" r=\"70\"></circle><text class=\"pn-label\" x=\"70\" y=\"63.75\"><tspan x=\"70\" dy=\"0\">Payment</tspan><tspan x=\"70\" dy=\"12.5\">gateway</tspan></text></g></g><g transform=\"translate(0, 420)\"><g class=\"pn-element\"><text class=\"pn-note\" x=\"100\" y=\"37.5\"><tspan x=\"100\" dy=\"0\">Card numbers never reach the</tspan><tspan x=\"100\" dy=\"15\">shop.</tspan></text></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 140 260 L 460 270\"></path><path class=\"pn-flow-arrow\" d=\"M 460 270 L 441.79 276.434 L 442.227 262.441 Z\"></path><text class=\"pn-flow-label\" x=\"379.147\" y=\"288.543\"><tspan x=\"379.147\" dy=\"0\">browse the catalogue and</tspan><tspan x=\"379.147\" dy=\"12.5\">fill a basket</tspan></text><g class=\"pn-badge\" transform=\"translate(380.856, 240.114)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-high\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">H</text></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 460 270 L 140 260\"></path><path class=\"pn-flow-arrow\" d=\"M 140 260 L 158.21 253.566 L 157.773 267.559 Z\"></path><text class=\"pn-flow-label\" x=\"219.342\" y=\"283.549\"><tspan x=\"219.342\" dy=\"0\">return the rendered page</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 600 270 L 680 100\"></path><path class=\"pn-flow-arrow\" d=\"M 680 100 L 678.669 119.267 L 666.002 113.306 Z\"></path><text class=\"pn-flow-label\" x=\"710.879\" y=\"218.355\"><tspan x=\"710.879\" dy=\"0\">read the product listings</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 600 270 L 1040 270\"></path><path class=\"pn-flow-arrow\" d=\"M 1040 270 L 1022 277 L 1022 263 Z\"></path><text class=\"pn-flow-label\" x=\"710\" y=\"289\"><tspan x=\"710\" dy=\"0\">authorise the card</tspan><tspan x=\"710\" dy=\"12.5\">payment</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 1040 270 L 600 270\"></path><path class=\"pn-flow-arrow\" d=\"M 600 270 L 618 263 L 618 277 Z\"></path><text class=\"pn-flow-label\" x=\"930\" y=\"289\"><tspan x=\"930\" dy=\"0\">confirm the authorisation</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 530 340 L 530 460 L 680 460\"></path><path class=\"pn-flow-arrow\" d=\"M 680 460 L 662 467 L 662 453 Z\"></path><text class=\"pn-flow-label\" x=\"605\" y=\"479\"><tspan x=\"605\" dy=\"0\">record the paid order</tspan></text><g class=\"pn-badge\" transform=\"translate(605, 435)\"><g class=\"pn-badge-flag\" transform=\"translate(0, 0)\"><path class=\"pn-tone-flag\" d=\"M 0 -11 L 11 11 L -11 11 Z\"></path><text class=\"pn-badge-mark\" y=\"4\">!</text></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 1240 480 L 1110 340\"></path><path class=\"pn-flow-arrow\" d=\"M 1110 340 L 1127.378 348.427 L 1117.119 357.953 Z\"></path><text class=\"pn-flow-label\" x=\"1131.237\" y=\"450.637\"><tspan x=\"1131.237\" dy=\"0\">card network callback</tspan></text><g class=\"pn-badge\" transform=\"translate(1211.188, 376.397)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-neutral\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">?</text></g><g class=\"pn-badge-flag\" transform=\"translate(0, 27)\"><path class=\"pn-tone-flag\" d=\"M 0 -11 L 11 11 L -11 11 Z\"></path><text class=\"pn-badge-mark\" y=\"4\">!</text></g></g></g></svg>
"), format: "svg", fit: "contain", width: 100%, height: 100%)
],
)
]

#page(flipped: true)[
#grid(rows: (auto, 1fr), row-gutter: 1em,
heading(level: 1)[#"Shipping an order"],
align(center + horizon)[
#image(bytes("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-10 39 931 589\" width=\"931\" height=\"589\"><title>Shipping an order</title><rect x=\"-10\" y=\"39\" width=\"931\" height=\"589\" fill=\"#F9F6F0\"></rect><style>.pn-element {
  font-family: \"Liberation Sans\";
}
.pn-shape {
  fill: #FAF8F2;
  stroke: #38342E;
  stroke-width: 2;
}
.pn-actor {
  fill: #EAE5DA;
}
.pn-process {
  fill: #E7E9E1;
}
.pn-store {
  fill: none;
  stroke-width: 2.5;
}
.pn-boundary-box,
.pn-boundary-curve {
  fill: none;
  stroke: #6B655C;
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.pn-out-of-scope {
  opacity: 0.5;
}
.pn-out-of-scope .pn-shape {
  stroke-dasharray: 6 4;
}
.pn-label {
  fill: #38342E;
  font-size: 10px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-note {
  fill: #6B655C;
  font-size: 12px;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-flow {
  fill: none;
}
.pn-flow-arrow {
  fill: #38342E;
  stroke: none;
}
.pn-flow-label {
  fill: #6B655C;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: #F9F6F0;
  stroke-width: 3;
  stroke-linejoin: round;
}
.pn-badge {
  stroke: #FAF8F2;
  stroke-width: 3;
}
.pn-badge-count {
  fill: #FAF8F2;
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-badge-primary .pn-badge-count {
  font-size: 11px;
}
.pn-badge-secondary .pn-badge-count {
  font-size: 9px;
}
.pn-badge-mark {
  fill: #FAF8F2;
  stroke: none;
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-badge-flag {
  stroke-linejoin: round;
}
.pn-tone-critical {
  fill: #C14339;
}
.pn-tone-high {
  fill: #A85E1D;
}
.pn-tone-medium {
  fill: #46788A;
}
.pn-tone-low {
  fill: #4B6B50;
}
.pn-tone-neutral {
  fill: #756E63;
}
.pn-tone-flag {
  fill: #38342E;
}

.pn-tone-low { fill: #4B6B50; stroke: #4B6B50; stroke-width: 3; }
.pn-tone-low ~ .pn-badge-count, .pn-tone-low ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-medium { fill: #46788A; stroke: #46788A; stroke-width: 3; }
.pn-tone-medium ~ .pn-badge-count, .pn-tone-medium ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-high { fill: #A85E1D; stroke: #A85E1D; stroke-width: 3; }
.pn-tone-high ~ .pn-badge-count, .pn-tone-high ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-critical { fill: #C14339; stroke: #C14339; stroke-width: 3; }
.pn-tone-critical ~ .pn-badge-count, .pn-tone-critical ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-neutral { fill: #756E63; stroke: #756E63; stroke-width: 3; }
.pn-tone-neutral ~ .pn-badge-count, .pn-tone-neutral ~ .pn-badge-mark { fill: #FAF8F2; }
.pn-tone-flag { fill: #38342E; stroke: #38342E; stroke-width: 3; }
.pn-tone-flag ~ .pn-badge-count, .pn-tone-flag ~ .pn-badge-mark { fill: #FAF8F2; }</style><g transform=\"translate(-2, 328)\"><g class=\"pn-element\"><path class=\"pn-shape pn-boundary-curve\" d=\"M 2 2 C 72 13.667 278.667 72 422 72 C 565.333 72 788.667 13.667 862 2\"></path><text class=\"pn-label\" x=\"422\" y=\"91\"><tspan x=\"422\" dy=\"0\">Warehouse floor</tspan></text></g></g><g transform=\"translate(40, 80)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"150\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"80\" x2=\"150\" y2=\"80\"></line><text class=\"pn-label\" x=\"75\" y=\"40\"><tspan x=\"75\" dy=\"0\">Stock</tspan></text><g class=\"pn-badge\" transform=\"translate(150, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-medium\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">M</text></g></g></g></g><g transform=\"translate(400, 60)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"70\" cy=\"70\" r=\"70\"></circle><text class=\"pn-label\" x=\"70\" y=\"70\"><tspan x=\"70\" dy=\"0\">Dispatch</tspan></text><g class=\"pn-badge\" transform=\"translate(140, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-high\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">H</text></g></g></g></g><g transform=\"translate(760, 70)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"60\" cy=\"60\" r=\"60\"></circle><text class=\"pn-label\" x=\"60\" y=\"60\"><tspan x=\"60\" dy=\"0\">Label printer</tspan></text></g></g><g transform=\"translate(40, 480)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"140\" height=\"80\"></rect><text class=\"pn-label\" x=\"70\" y=\"40\"><tspan x=\"70\" dy=\"0\">Picker</tspan></text><g class=\"pn-badge\" transform=\"translate(140, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-high\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">H</text></g></g></g></g><g transform=\"translate(760, 480)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"140\" height=\"80\"></rect><text class=\"pn-label\" x=\"70\" y=\"40\"><tspan x=\"70\" dy=\"0\">Courier</tspan></text><g class=\"pn-badge\" transform=\"translate(140, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-low\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">L</text></g></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 190 120 L 400 130\"></path><path class=\"pn-flow-arrow\" d=\"M 400 130 L 381.687 136.136 L 382.353 122.152 Z\"></path><text class=\"pn-flow-label\" x=\"296.356\" y=\"90.275\"><tspan x=\"296.356\" dy=\"0\">reserve the stock for the</tspan><tspan x=\"296.356\" dy=\"12.5\">order</tspan></text><g class=\"pn-badge\" transform=\"translate(293.687, 152.572)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-medium\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">M</text></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 180 520 L 470 200\"></path><path class=\"pn-flow-arrow\" d=\"M 470 200 L 463.1 218.038 L 452.726 208.637 Z\"></path><text class=\"pn-flow-label\" x=\"277.41\" y=\"316.872\"><tspan x=\"277.41\" dy=\"0\">report the picked items</tspan></text><g class=\"pn-badge\" transform=\"translate(348.98, 381.732)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-high\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">H</text></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 760 520 L 470 200\"></path><path class=\"pn-flow-arrow\" d=\"M 470 200 L 487.274 208.637 L 476.9 218.038 Z\"></path><path class=\"pn-flow-arrow\" d=\"M 760 520 L 742.726 511.363 L 753.1 501.962 Z\"></path><text class=\"pn-flow-label\" x=\"655.04\" y=\"323.713\"><tspan x=\"655.04\" dy=\"0\">collect the parcel</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 540 130 L 760 130\"></path><path class=\"pn-flow-arrow\" d=\"M 760 130 L 742 137 L 742 123 Z\"></path><text class=\"pn-flow-label\" x=\"650\" y=\"149\"><tspan x=\"650\" dy=\"0\">print the shipping label</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 180 520 L 470 620 L 760 520\"></path><path class=\"pn-flow-arrow\" d=\"M 760 520 L 745.265 532.485 L 740.701 519.25 Z\"></path><text class=\"pn-flow-label\" x=\"313.05\" y=\"604.654\"><tspan x=\"313.05\" dy=\"0\">hand over the parcel</tspan></text><g class=\"pn-badge\" transform=\"translate(334.952, 541.14)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-low\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"7.5\">L</text></g></g></g></svg>
"), format: "svg", fit: "contain", width: 100%, height: 100%)
],
)
]

#heading(level: 1)[#"Two diagrams threat register"]

#table(columns: 6,
[#"Number"], [#"Title"], [#"Elements"], [#"Category"], [#"Severity"], [#"Status"],
[#"1"], [#"Account takeover by credential stuffing"], [#"Shopper, browse the catalogue and fill a basket"], [#"Spoofing (STRIDE)"], [#saer-badge("High", rgb("#A85E1D"))], [#saer-badge("Open", rgb("#C14339"))],
[#"2"], [#"Basket price changed in the page"], [#"Web shop, return the rendered page"], [#"Tampering (STRIDE)"], [#saer-badge("Critical", rgb("#C14339"))], [#saer-badge("Mitigated", rgb("#4B6B50"))],
[#"3"], [#"Unpublished listings readable"], [#"Catalogue, read the product listings"], [#"Confidentiality (CIA)"], [#saer-badge("Medium", rgb("#46788A"))], [#saer-badge("Accepted risk", rgb("#A85E1D"))],
[#"4"], [#"Card data disclosed in transit"], [#"Payment gateway, authorise the card payment"], [#"Information disclosure (STRIDE)"], [#saer-badge("High", rgb("#A85E1D"))], [#saer-badge("Transferred", rgb("#46788A"))],
[#"6"], [#"Shopper denies placing an order"], [#"Order ledger, record the paid order"], [#"Repudiation (STRIDE)"], [#saer-badge("Low", rgb("#4B6B50"))], [#saer-badge("Mitigated", rgb("#4B6B50"))],
[#"7"], [#"Forged payment callback"], [#"card network callback"], [#"Callback integrity (Payments checklist)"], [#saer-badge("Undecided", rgb("#756E63"))], [#saer-badge("Open", rgb("#C14339"))],
[#"8"], [#"Stock held by abandoned reservations"], [#"Stock, reserve the stock for the order"], [#"Denial of service (STRIDE)"], [#saer-badge("Medium", rgb("#46788A"))], [#saer-badge("Open", rgb("#C14339"))],
[#"9"], [#"Courier learns more than the address"], [#"Courier, hand over the parcel"], [#"Data disclosure (LINDDUN)"], [#saer-badge("Low", rgb("#4B6B50"))], [#saer-badge("Open", rgb("#C14339"))],
[#"10"], [#"Picker overrides a dispatch hold"], [#"Picker, Dispatch, report the picked items"], [#"Elevation of privilege (STRIDE)"], [#saer-badge("High", rgb("#A85E1D"))], [#saer-badge("Open", rgb("#C14339"))],
[#"11"], [#"Refund policy abused"], [#"None"], [#"Integrity (CIA)"], [#saer-badge("Low", rgb("#4B6B50"))], [#saer-badge("Open", rgb("#C14339"))],
)

#heading(level: 2)[#"Assumptions that apply to the model"]

#list([#saer-badge("Valid", rgb("#4B6B50"))

#"The payment provider holds its own card data certification."], [#saer-badge("Unconfirmed", rgb("#756E63"))

#"Every courier is vetted by the carrier."])

#heading(level: 2)[#"Threat 1: Account takeover by credential stuffing"]

#list([#strong[#"Elements"]#": "#"Shopper, browse the catalogue and fill a basket"], [#strong[#"Category"]#": "#"Spoofing (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("High", rgb("#A85E1D"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"Reused passwords from another breach sign in as the shopper."

#strong[#"Mitigations"]

#list([#saer-badge("Proposed", rgb("#756E63"))#" "#strong[#"Sign-in throttling"]

#"Throttle sign-in attempts:"

#list([#"per account"], [#"per network address"])])

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 2: Basket price changed in the page"]

#list([#strong[#"Elements"]#": "#"Web shop, return the rendered page"], [#strong[#"Category"]#": "#"Tampering (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("Critical", rgb("#C14339"))], [#strong[#"Status"]#": "#saer-badge("Mitigated", rgb("#4B6B50"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"The page carries the price back with the basket, so an edited page could set its own."

#strong[#"Mitigations"]

#list([#saer-badge("Implemented", rgb("#46788A"))

#"The server prices the basket from the catalogue and ignores any price the page sends."], [#saer-badge("Verified", rgb("#4B6B50"))#" "#strong[#"Signed basket"]

#"The basket token is signed, and a changed token is refused."])

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 3: Unpublished listings readable"]

#list([#strong[#"Elements"]#": "#"Catalogue, read the product listings"], [#strong[#"Category"]#": "#"Confidentiality (CIA)"], [#strong[#"Severity"]#": "#saer-badge("Medium", rgb("#46788A"))], [#strong[#"Status"]#": "#saer-badge("Accepted risk", rgb("#A85E1D"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"A guessed listing address shows a product before launch:"

#list([#"its draft price"], [#"its launch date"])

#strong[#"Mitigations"]

#"None recorded."

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 4: Card data disclosed in transit"]

#list([#strong[#"Elements"]#": "#"Payment gateway, authorise the card payment"], [#strong[#"Category"]#": "#"Information disclosure (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("High", rgb("#A85E1D"))], [#strong[#"Status"]#": "#saer-badge("Transferred", rgb("#46788A"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"None recorded."

#strong[#"Mitigations"]

#"None recorded."

#strong[#"Assumptions"]

#list([#saer-badge("Valid", rgb("#4B6B50"))

#"The payment provider holds its own card data certification."])

#heading(level: 2)[#"Threat 6: Shopper denies placing an order"]

#list([#strong[#"Elements"]#": "#"Order ledger, record the paid order"], [#strong[#"Category"]#": "#"Repudiation (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("Low", rgb("#4B6B50"))], [#strong[#"Status"]#": "#saer-badge("Mitigated", rgb("#4B6B50"))], [#strong[#"Flags"]#": "#saer-badge("Mitigated without implemented work", rgb("#A85E1D"))])

#strong[#"Description"]

#"None recorded."

#strong[#"Mitigations"]

#list([#saer-badge("Proposed", rgb("#756E63"))

#"Write an audit entry with each ledger change."])

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 7: Forged payment callback"]

#list([#strong[#"Elements"]#": "#"card network callback"], [#strong[#"Category"]#": "#"Callback integrity (Payments checklist)"], [#strong[#"Severity"]#": "#saer-badge("Undecided", rgb("#756E63"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#saer-badge("Rests on an invalidated assumption", rgb("#C14339"))])

#strong[#"Description"]

#"A callback that is not from the card network marks an order paid."

#strong[#"Mitigations"]

#"None recorded."

#strong[#"Assumptions"]

#list([#saer-badge("Invalidated", rgb("#C14339"))

#"The card network signs every callback it sends."])

#heading(level: 2)[#"Threat 8: Stock held by abandoned reservations"]

#list([#strong[#"Elements"]#": "#"Stock, reserve the stock for the order"], [#strong[#"Category"]#": "#"Denial of service (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("Medium", rgb("#46788A"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"None recorded."

#strong[#"Mitigations"]

#list([#saer-badge("Implemented", rgb("#46788A"))#" "#strong[#"Reservation expiry"]

#"A reservation lapses after thirty minutes, and a hold outlives no reservation."])

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 9: Courier learns more than the address"]

#list([#strong[#"Elements"]#": "#"Courier, hand over the parcel"], [#strong[#"Category"]#": "#"Data disclosure (LINDDUN)"], [#strong[#"Severity"]#": "#saer-badge("Low", rgb("#4B6B50"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"None recorded."

#strong[#"Mitigations"]

#"None recorded."

#strong[#"Assumptions"]

#list([#saer-badge("Unconfirmed", rgb("#756E63"))

#"Every courier is vetted by the carrier."])

#heading(level: 2)[#"Threat 10: Picker overrides a dispatch hold"]

#list([#strong[#"Elements"]#": "#"Picker, Dispatch, report the picked items"], [#strong[#"Category"]#": "#"Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": "#saer-badge("High", rgb("#A85E1D"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"None recorded."

#strong[#"Mitigations"]

#list([#saer-badge("Implemented", rgb("#46788A"))#" "#strong[#"Reservation expiry"]

#"A reservation lapses after thirty minutes, and a hold outlives no reservation."])

#strong[#"Assumptions"]

#"None recorded."

#heading(level: 2)[#"Threat 11: Refund policy abused"]

#list([#strong[#"Elements"]#": "#"None"], [#strong[#"Category"]#": "#"Integrity (CIA)"], [#strong[#"Severity"]#": "#saer-badge("Low", rgb("#4B6B50"))], [#strong[#"Status"]#": "#saer-badge("Open", rgb("#C14339"))], [#strong[#"Flags"]#": "#"None"])

#strong[#"Description"]

#"Not tied to one element: the policy itself is the weakness."

#strong[#"Mitigations"]

#"None recorded."

#strong[#"Assumptions"]

#"None recorded."