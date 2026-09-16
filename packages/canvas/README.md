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
fills. [`flow-labels.ts`](src/lib/flow-labels.ts) puts every flow's name and
badge where nothing else is drawn, deterministically, so the studio and the
headless render agree.

## Drawing

[`glyphs.tsx`](src/lib/glyphs.tsx): `ElementGlyph` draws an element in its own
coordinates, and `boxElementStrokeInsets` says how far an outline's stroke
reaches past its box. Glyphs are the ones Threat Dragon draws, since the
corpus round-trips through that tool. [`scene.tsx`](src/lib/scene.tsx):
`DiagramGlyphs` draws a whole layout in painting order with no root element,
so the `<svg>`, its viewBox and its `<style>` belong to whoever composes the
document.

[`badges.tsx`](src/lib/badges.tsx) counts open threats on the model's own
definition of open and marks any flagged threat, so a badge, the register and
the CLI count one set.

[`handles.ts`](src/lib/handles.ts): every box element exposes four handles at
its side midpoints. An attached flow end takes its pinned side, or else
`nearestHandleSide` to its next point. An unpinned end can change sides as a
waypoint moves, and several flows can meet at one midpoint.

[`paths.ts`](src/lib/paths.ts): `polylinePath` and `smoothPath` write SVG
paths, and [`geometry.ts`](src/lib/geometry.ts): `boxOfPoints` and
`boxesOverlap` measure boxes.

## The visual system

[`stylesheet.ts`](src/lib/stylesheet.ts): primitives carry class names from
`canvasClassNames` and never inline styles, and one stylesheet styles them.
The headless render embeds `renderCanvasStylesheet` for a theme, and the
studio injects `themedCanvasStylesheet`, the same sheet with every colour
read from a custom property. `wrappedTextStyles` pairs each run of text with
its class and font size, and `severityToneClass` names each severity's tone.
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
as the `--pn-*` custom properties the studio's CSS modules read.

## Measuring nothing, and the same bytes every time

Nothing reads a glyph's extent back out of a layout engine, and a spec walks
the package to check it. [`typography.ts`](src/lib/typography.ts) wraps text
by one ratio of glyph width to font size (`wrapText`, `textExtent`,
`lineHeight`, `lineHeightRatio`), so headless and interactive output wrap
alike. `xmlSafeText` replaces characters XML 1.0 forbids, and a document
composed around these glyphs applies it to its own text. Every number
reaching an SVG attribute goes through `svgNumber`
([`numbers.ts`](src/lib/numbers.ts)), so one model gives one set of bytes on
every run and platform.

The suite pins that with a golden SVG per scene in `scene.spec.tsx`: the
Écluse model, `test-data/every-glyph.model.json`, and each diagram of
[Saerskriven's own threat model](../../threat-modelling/README.md). The
every-glyph model lives under `test-data` because `packages/render` draws it
too and cannot import this package's spec fixtures, which no entry point
exports.

## React Flow

[`react-flow.tsx`](src/lib/react-flow.tsx): `CanvasNodeBody`,
`CanvasEdgeBody` and `CanvasFreeEndBody` are the node, edge and free-end
components. `toReactFlowNodes`, `toReactFlowEdges` and `freeEndNodes` carry a
layout over with every position and extent explicit, so React Flow measures
nothing. A flow end at a free position rides on an anchor node named by
`flowEndNodeId`, of type `freeEndNodeKind`. `layoutAtReactFlowNodes` lays the
diagram out at the node positions React Flow holds during a gesture.
[`resizing.ts`](src/lib/resizing.ts): `resizeKeys`, `keyboardResizeStep` and
`shiftedKeyboardResizeStep` are the keyboard resize the node body's controls
use.

A canvas mounting these passes `connectionMode={ConnectionMode.Loose}`, gives
each node its accessible name, and loads `@xyflow/react/dist/style.css`
beside the canvas stylesheet. That sheet styles React Flow's container,
viewport, handles and controls, none of which a primitive draws.

Unit tests: `pnpm nx test @saerskriven/canvas`.
