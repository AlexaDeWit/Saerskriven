# @saerskriven/canvas

The drawing primitives a diagram is made of, shared by the interactive studio
and by headless rendering: one glyph component per element kind, the flow
edge and its path maths, the threat badges, the handle geometry, the text
wrapping, label placement, and one stylesheet. Everything is presentational
and stateless, and every number it draws comes out of the model. Imports
`@saerskriven/model` and no other internal package.

React Flow renders a node as positioned HTML rather than as part of one SVG
document, so what is shared is not the canvas but the pieces inside it.
`packages/render` composes these primitives into a standalone SVG, and the
studio wraps the same ones in React Flow nodes and edges, so geometry, glyphs
and paths cannot drift between what a browser shows and what the CLI writes.

Behaviour is documented in TSDoc beside the code. This README says what each
module is for and what a consumer has to do.

## Laying a diagram out

[`layout.ts`](src/lib/layout.ts): `layoutDiagram(diagram, model)` turns one
diagram into `nodes`, `edges`, `unplaced` and `bounds`. Paint `nodes` and then
`edges`: boundaries come first so they sit behind what they enclose. A flow
end naming an element the canvas draws as no box leaves that flow out of the
layout and in `unplaced`. `canvasNodeOf` converts a single element and
`isBoundary` tells a trust boundary node apart.

[`bounds.ts`](src/lib/bounds.ts): `bounds` and `drawnBounds` hold everything
the layout paints except stroke widths, which a caller sizing a viewBox pads
for. Nothing else needs padding.

[`layout-move.ts`](src/lib/layout-move.ts): `flowLabelFollows` and
`flowWithFollowedLabel` carry a settled flow label along a path the studio
changes, without the diagram-wide label search.

[`text-placement.ts`](src/lib/text-placement.ts): `nodeTextPlacement` and
`textPlacementCorners` say where an element's text hangs and what box it
fills.

[`flow-labels.ts`](src/lib/flow-labels.ts) draws a flow's badge and name as
one block, the badge first, on a backing in the canvas ground colour
([`flow-blocks.ts`](src/lib/flow-blocks.ts)). The block sits on the flow's
line, which it breaks, starting at the middle of the line's longest run. Where
it would cover a shape, a name, a badge, another block, another flow's line or
a trust boundary's line, it slides along its own line to the nearest clear
spot, leaving some line and every arrowhead showing at both ends. Where no spot
on the line is clear, it goes beside the line, alongside the run it hangs
beside: above a run nearer horizontal, right of one nearer vertical, wrapping
the name onto up to three lines where that helps, and on the other side only
where that side is blocked. It stands at most 16 units off the line through
that run and within 20 of the run as drawn wherever a spot that close is clear
on either side, so it still reads as the line's, and only then steps out as
far as 44, within 48 of the run. Where nothing is clear it takes the spot
that covers the fewest things, so no name is dropped. The search is
[`flow-block-search.ts`](src/lib/flow-block-search.ts). Flows are
placed in id order from the model alone, so the studio and the headless render
agree. During a drag, `flowLabelPlacementsDuringMove` keeps the block of every
flow the drag leaves alone and places a moving flow's block by the same rules.
A block cannot yet be dragged along its line and kept there, since the file
format has no field to hold it.

## Drawing

[`glyphs.tsx`](src/lib/glyphs.tsx): `ElementGlyph` draws an element in its own
coordinates, and `boxElementStrokeInsets` says how far an outline's stroke
reaches past its box. Glyphs are the ones Threat Dragon draws, since the
corpus round-trips through that tool, except a process: Threat Dragon draws
the circle inscribed in its box, and this package draws the ellipse filling
it. [`scene.tsx`](src/lib/scene.tsx): `DiagramGlyphs` draws a whole layout in
painting order with no root element, so the `<svg>`, its viewBox and its
`<style>` belong to whoever composes the document.

[`badges.tsx`](src/lib/badges.tsx) counts open threats on the model's own
definition of open and marks any flagged threat, so a badge, the register and
the CLI count one set. A badge letters the `BadgeMarks` its caller passes as
`marks`, one per severity and one for the flag, since a mark abbreviates a
word in the reader's language. `DiagramGlyphs`, `ElementGlyph` and the React
Flow bodies each require them, and `@saerskriven/render` supplies them from
its catalogues.

[`handles.ts`](src/lib/handles.ts): every box element exposes four handles at
its side midpoints. An attached flow end takes its pinned side, or else
`nearestHandleSide` to its next point. An unpinned end can change sides as a
waypoint moves, and several flows can meet at one midpoint.

[`paths.ts`](src/lib/paths.ts): `polylinePath` and `smoothPath` write SVG
paths, and `curveMidpoints` finds where a smooth path passes halfway along
the length of each segment between a pair of its points, and how long that
segment is. In [`geometry.ts`](src/lib/geometry.ts), `boxOfPoints` bounds a
list of points and `boxesOverlap` tests whether two boxes overlap.

## The visual system

[`stylesheet.ts`](src/lib/stylesheet.ts): primitives carry class names from
`canvasClassNames` and never inline styles, and one stylesheet styles them.
The headless render embeds `renderCanvasStylesheet` for a theme, and the
studio injects `themedCanvasStylesheet`, the same sheet with every colour
read from a custom property. `wrappedTextStyles` pairs each run of text with
its class and font size, and `severityToneClass` names each severity's tone.
Nothing in the sheet is faded, so every ink is drawn at the ratio
`tokens.spec.ts` measures for it. An out-of-scope element is marked by round
dots on its outline, where an outline in scope is solid and a trust boundary's
is dashed. A note has no outline, so while it is out of scope its glyph draws
a dotted frame `noteFrameOffset` outside its box, clear of the selection frame
and focus ring the studio draws inside the box. `drawnBounds` holds the frame,
and a flow's block is held clear of it.
[`render-theme.ts`](src/lib/render-theme.ts): `renderThemeSchema` and
`defaultRenderTheme` are the theme headless output is drawn with, and
`badgeTextColour` resolves a badge's lettering under it.
[Render themes](../../docs/render-themes.md) describes overriding it.

[`tokens.ts`](src/lib/tokens.ts) decides every colour, size and step of
spacing, for the diagram and the studio's chrome: `lightPalette`,
`darkPalette`, `canvasType`, `gridSpacing` and `panelCover` among them.
`tokens.spec.ts` holds every text and mark pair of both palettes to its WCAG
floor through `contrastRatio`. `rgbColour` writes a token the way a browser
serializes a computed style, for a browser spec to compare against.
`tokenStylesheet`, on the `@saerskriven/canvas/tokens` subpath, is the table
as the `--saer-*` custom properties the studio's CSS modules read.

## Measuring nothing, and the same bytes every time

Nothing reads a glyph's extent back out of a layout engine, and a spec walks
the package to check it. [`typography.ts`](src/lib/typography.ts) wraps text
by one ratio of glyph width to font size (`wrapText`, `textExtent`,
`lineHeight`, `lineHeightRatio`), so headless and interactive output wrap
alike. `xmlSafeText` replaces characters XML 1.0 forbids, and a document
composed around these glyphs applies it to its own text. Every number
reaching an SVG attribute goes through `svgNumber`
([`numbers.ts`](src/lib/numbers.ts)), so one model gives one set of bytes on
every run and platform. The writing itself is the model package's
`fixedNumber`, which its geometry operations round with. `svgNumber` raises a
`RangeError` for a number that is not finite, so no attribute reads `Infinity`
or `NaN`. A boundary curve's
box, worked out from its points and the stroke width, is written at the most
decimals any of them has, so Position and size in the studio shows it without
the noise of that arithmetic.

The bytes are pinned once, by the SVG goldens of
[`packages/render`](../render/README.md#the-goldens), which draws these glyphs.
The diagrams this suite lays out whole, for its element count and label
placement checks, are `committedDiagrams` on `@saerskriven/model/fixtures`:
`test-data/every-glyph.model.json` and the two diagrams of
`test-data/two-diagrams.model.json`. They live under `test-data` because
`packages/render` draws them too and cannot import this package's spec
fixtures, which no entry point exports.

## React Flow

[`react-flow.tsx`](src/lib/react-flow.tsx): `CanvasNodeBody`,
`CanvasEdgeBody` and `CanvasFreeEndBody` are the node, edge and free-end
components. `toReactFlowNodes`, `toReactFlowEdges` and `freeEndNodes` carry a
layout over with every node position and extent explicit. A flow end at a
free position rides on an anchor node named by `flowEndNodeId`, of type
`freeEndNodeKind`. Each anchor declares its fixed handle geometry through
React Flow's public `handles` field and draws the same invisible handle.
Resolving a free end does not wait for browser handle measurement.
`layoutAtReactFlowNodes` lays the
diagram out at the node positions React Flow holds during a gesture.
`CanvasNodeBody` draws a selected node's badge at `selectedBadgeAnchor`,
stepped out past its top-right corner and clear of a resize handle inside it.
That is drawing only: the layout, flow name placement and every export keep the
badge on the corner. A canvas measuring a selection as drawn passes
`selectedBadgeAnchor` to `drawnBounds`.
[`resizing.ts`](src/lib/resizing.ts): `resizeKeys`, `keyboardResizeStep` and
`shiftedKeyboardResizeStep` are the keyboard resize the node body's controls
use, one control per `resizeControlPositions` entry, less those a boundary
curve's points give nothing to stretch. `scaledCurvePoints` fits a curve's
points to a resized box, for the node body's live drawing and for the edit the
mounting canvas commits. `isResizeKey` tells whether a key is one of
`resizeKeys`. `GestureInput` names what a gesture is made with, a pointer or
the keyboard, and the resize controls hand it to `onResizeEnd` beside the
settled box. They call `onResizeRefused` for an arrow key on a control's axis
that `minimumNodeExtent` blocks, so the mounting canvas can say so.

A canvas mounting these passes `connectionMode={ConnectionMode.Loose}`, gives
each node its accessible name, hands `CanvasNodeBody` the `resizeLabels` its
resize controls are named by and both bodies the badge `marks`, and loads
`@xyflow/react/dist/style.css` beside the canvas stylesheet. The package words
nothing a reader sees or hears, so the mounting app supplies that text in its
own language. The sheet styles React Flow's container, viewport, handles and
controls, none of which a primitive draws. `canvasInteractionClassNames` names
the node body's badge layer and a boundary's pointer target, which the canvas
stylesheet leaves for the mounting canvas to stack and hand the pointer to.

Unit tests: `pnpm nx test @saerskriven/canvas`.
