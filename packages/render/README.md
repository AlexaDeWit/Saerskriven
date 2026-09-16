# @saerskriven/render

Projections of a model. `renderSvg` draws one diagram as a standalone SVG
document, `renderRegister` writes the threat register as GFM Markdown, shaped
to replace a register a downstream site generator builds by hand, and
`renderTypst` writes the whole model, every diagram and that same register, as
the source of one Typst document.

Every projection is a pure function of the model and its render options.
[Render themes and embedded registers](../../docs/render-themes.md) describes
the shared theme, partial overrides, the stylesheet interface and heading
controls. The theme's schema and defaults, `renderThemeSchema` and
`defaultRenderTheme`, come from `@saerskriven/canvas`, which a caller imports
directly.

Behaviour is documented in TSDoc beside the code. This README says what each
entry point is for and what a caller has to supply.

## The main entry

[`svg-document.tsx`](src/lib/svg-document.tsx): `renderSvg(diagram, model,
theme)` lays the diagram out with `@saerskriven/canvas` and draws the canvas
primitives through `renderToStaticMarkup`. The studio mounts the same
primitives in React Flow, so what the CLI writes and what a browser draws come
out of one set of glyphs and one path maths. The projection is per diagram:
which diagram to draw is the caller's decision.

`unplaced` is what the drawing left out: a flow whose endpoint names an
element the canvas draws as no box. A caller that drops that list drops the
only notice of it, and `renderUnplacedWarning`
([`unplaced-warning.ts`](src/lib/unplaced-warning.ts)) words it.

[`register-tree.ts`](src/lib/register-tree.ts) builds the register as one
mdast tree, and states what the register promises: stable threat anchors,
records on their threats, the model's assumptions in one section, prose kept
as Markdown under `deepestProse`, and no label left blank.
[`markdown-register.ts`](src/lib/markdown-register.ts): `renderRegister`
serializes that tree, and
[`typst-document.ts`](src/lib/typst-document.ts): `renderTypst` walks it into
Typst, so what a PDF says and what a Markdown file says cannot drift.
`flagLabel` and `sectionLabel` ([`register-labels.ts`](src/lib/register-labels.ts))
are the labels every surface names a flag or a register section with.

Typst markup is a language, and threat prose is untrusted: `#` calls a
function, so a title reaching the source as markup could read a file. No value
out of the model is written as markup, which
`test-data/adversarial/typst-injection.yaml` holds the package to.

[`theme.ts`](src/lib/theme.ts): `readThemeOverrides` reads a partial theme
over the defaults, and `withBundledFonts` swaps a family the PDF and PNG
outputs do not carry for the default.
[`register-stylesheet.ts`](src/lib/register-stylesheet.ts):
`registerStylesheet` is the scoped CSS a styled register carries, for a host
that writes it to its own file. [`register-options.ts`](src/lib/register-options.ts):
`registerOptionsSchema` holds the heading controls.

## Typst source as a PDF

`compilePdf(source, assets)`, on the `@saerskriven/render/pdf` subpath
([`pdf.ts`](src/pdf.ts)), returns the bytes of a PDF or a `PdfFailure`. It sits
on a subpath because it pulls in 28 MB of WebAssembly, which a caller drawing
an SVG or writing a register has no use for. Its JavaScript loads on the first
call, so a web build can keep it in a separate chunk.

This package reads no file. `assets.wasm` is the Typst WebAssembly module and
`assets.fonts` the faces, in compiler order. `apps/cli` reads them beside its
bundle, and `apps/studio` fetches the same build-time assets. The Node-only
`@saerskriven/render/build-assets` subpath
([`build-assets.ts`](src/build-assets.ts)) names the compiler module and the
five font files, so the CLI and the studio cannot choose different faces.

## An SVG document as a PNG

`rasterizeSvg(source, assets, longEdge)`, on the `@saerskriven/render/resvg`
subpath ([`resvg.ts`](src/resvg.ts)), returns the bytes of a PNG and its pixel
size, or a `ResvgFailure`. It sits on a subpath for the reason the `pdf` one
does: 2 MB of WebAssembly.

`assets.wasm` is the module the `resvg-wasm` project builds out of the `resvg`
crate, and `assets.fonts` the faces. Without a face the renderer draws no text
at all. `build-assets` names the variable a build reads the module's path from
and the name it is carried under beside a bundle. Its spec skips where that
variable is unset, which is what running outside the flake shell looks like:
inside it the `resvg-wasm` build every carrying target depends on is what
writes the module the variable names, as
[Building the executables](../../docs/build.md#the-svg-rasterizer) describes.

## A diagram as a PNG

`renderPng(diagram, model, options)`, on the `@saerskriven/render/png` subpath
([`png.ts`](src/png.ts)), draws one diagram with `renderSvg` and rasterizes it.
It exists because MCP hosts take an image block as PNG, JPEG, GIF or WebP and
never as SVG. `options.assets` is what `rasterizeSvg` needs, and a caller
leads the faces with `drawingFace`, which `ledBy` arranges or refuses.

## The goldens

The files under [`test-data/render/`](../../test-data/render) are this
package's output, committed so a change to what it writes arrives as a diff on
a file rather than as a test that still passes:

- `ecluse.register.snapshot.md`, the Écluse model as a threat register.
- `saerskriven.register.snapshot.md`, the same of
  [Saerskriven's own threat model](../../threat-modelling/README.md), which
  carries what Écluse does not: a custom methodology, a CIA category, threats
  attached to no element, and a mitigation written as a Markdown list.
- `ecluse.snapshot.svg`, the one diagram of the Écluse model.
- `every-glyph.snapshot.svg`, the diagram of
  `test-data/every-glyph.model.json`, drawing one of every glyph the canvas
  knows. `@saerskriven/canvas` draws the same model into a golden of its own,
  which is why the model sits under `test-data`.
- `saerskriven-read-and-render.snapshot.svg` and
  `saerskriven-agent-and-desktop.snapshot.svg`, the two diagrams of the
  Saerskriven model.
- One `<diagram>.snapshot.png` beside each of those four drawings, that same
  drawing rasterized, committed as a picture so a reviewer can open it.
- `ecluse.snapshot.typ`, the Écluse model as the Typst source of a whole
  document.

The drawings and their rasters are one list in `src/goldens.fixtures.ts`, so a
further model or diagram joins every check by being added there. The
registers keep their own list in their own spec. Cached tests write no
snapshot, so a missing golden fails. Regenerate them with
`pnpm snapshots:update @saerskriven/render` in the commit that moved them, and
read the diff. That command runs Vitest directly rather than through nx, so
the raster goldens need the rasterizer module built first, at the path
[`SAERSKRIVEN_RESVG_WASM`](../../docs/build.md#the-svg-rasterizer) names. Whether
a missing module skips that suite or fails it turns on the variable rather
than the file, which that section describes.

The CLI's suites read several of the goldens as fixtures, and the Saerskriven
ones use the model `@saerskriven/formats` maintains under `test-data`.

Unit tests: `pnpm nx test @saerskriven/render`.
