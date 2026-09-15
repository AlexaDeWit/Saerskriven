# threat-modelling

Saerskriven's own threat model, in Saerskriven's own format.

## `saerskriven.yaml`

Two diagrams. `read-and-render` is the path a model file takes from disk
through the codecs into a register or a diagram. `agent-and-desktop` is the
path an agent or the desktop shell takes to the same core. Between them, 37
elements (4 of them trust boundaries), 25 threats, 37 mitigations and 3
assumptions.
The threats are the ones this repository actually has: hostile files reaching
the read limits and the wire schemas, foreign prose reaching the render
paths, the desktop IPC bridge, and the MCP write tools.

Every status is true to the tree. A threat is mitigated where a mechanism is
on `main` and a mitigation record names that mechanism, open where the
surface is designed and its issue is named but nothing is built, and carries
an undecided severity where there is nothing built to assess. A third case
sits between the first two. A threat is partly held where a mechanism is on
`main` and does not cover the whole surface: it stays open, and its mitigation
record names the mechanism and what the mechanism leaves behind rather than an
issue. Threats 21 and 25 are the two of those. Nineteen are mitigated, five
are open, and one is transferred to whoever publishes a register. Every mitigated
threat names a mitigation record, and every open one names either the issue
that carries the work or, where it is partly held, the mechanism and its
residual.

It is a draft the maintainer will refine. What it is not is decoration: it is
the second production-scale fixture the suites gate on, beside the Écluse
model under `test-data/`, and the first one authored in the native format
rather than read out of Threat Dragon's.

## Where it gates

| Suite              | What it holds the file to                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `packages/formats` | It reads with no divergence, it is its own golden, and it is opened as Saerskriven YAML without being told |
| `packages/formats` | No read bound refuses it, alongside the Écluse file and the Threat Dragon corpus                           |
| `packages/render`  | `test-data/render/saerskriven.register.snapshot.md` is its threat register                                 |
| `packages/render`  | One standalone SVG document and one PNG per diagram, under `test-data/render/`                             |
| `packages/canvas`  | One committed scene per diagram, beside `scene.spec.tsx`                                                   |
| `packages/mcp`     | `saer_render_diagram` asks which diagram to draw and draws the one a call names                            |
| `apps/cli`         | `validate` counts its diagrams, elements and threats, and `render` draws a diagram named by id or title    |
| `apps/studio`      | It opens in the browser and saves back as the format it arrived in                                         |

The formats, render and canvas suites read lists rather than paths, so a
third model file joins every one of them by being added to `nativeFixtures`
in `packages/formats/src/lib/saerskriven-yaml.fixtures.ts`, to the register
list in `markdown-register.spec.ts` and `goldenDocuments` in
`packages/render/src/goldens.fixtures.ts`, and to the scene list in the canvas
spec. Each diagram is drawn three times on purpose: the canvas golden is the
glyphs alone, the render SVG golden is the document composed around them, and
the PNG golden is that document rasterized. The `packages/mcp` suite and the
app suites name the path.

This file is its own golden, so `packages/formats` writes it back where it
differs during an explicit snapshot update. Normal tests read the committed
bytes. The render and canvas suites read the derived model through
`test-data/saerskriven.model.json`, so the layer matrix needs no dependency on
the formats package.

`packages/formats` also writes this model out as
`test-data/saerskriven.model.json`, because the render and canvas suites gate on
a model and the layer matrix keeps the codec out of their reach. Where that
goes is a field on the same `nativeFixtures` entry, so a third file brings
its own. Écluse names none: `test-data/ecluse.model.json` is written by
`packages/model` from its own hand transcription of the Threat Dragon file,
the fixture that carries M1's representability gate, and this suite compares
its read against that file rather than producing it. A file authored in the
native format has no such transcription, so the codec is its only producer.

That file is derived. This one is the source.

## Editing it

The committed bytes are what `writeSaerskrivenYaml` produces, compared as a
vitest file snapshot against the file itself. A hand edit that leaves the
writer's canonical form therefore reds the suite rather than passing. Edit the
file, then regenerate it in the same commit:

```sh
pnpm snapshots:update @saerskriven/formats  # YAML and model JSON
pnpm snapshots:update @saerskriven/render   # register, SVG and PNG
pnpm snapshots:update @saerskriven/canvas   # canvas SVG
```

`snapshots:update` runs vitest outside nx, so nothing builds the rasterizer
module on the way. In a checkout with no `dist/resvg-wasm`, run
`pnpm nx run resvg-wasm:build` before the render update.

Read every diff before committing. Each of those files is an output by
definition, so a change to one is a change to what the format, the register,
or the canvas writes.

Each test target that reads this directory names it in a fixture input, so an
edit invalidates its cached result. `.oxfmtrc.json`
leaves the YAML here alone, for the same reason it leaves the payloads under
`test-data/` alone: a formatter must not rewrite a file that is compared byte
for byte.

## Placing names

`packages/canvas` places the names, in
`packages/canvas/src/lib/label-placement.ts`. A curve boundary's name, such as
`tb-untrusted` on `agent-and-desktop`, hangs beside the curve rather than on
it. A flow's name takes the cheapest of the candidates along the flow, where
each shape, line, name or badge it overlaps is a cost, and a tie goes to the
candidate nearest the midpoint of the flow's longest segment. A name with no
clear candidate still takes the cheapest one, so a gap narrower than the name
means a name drawn over a line. Every gap here is wide enough for the name
that crosses it, measured against the name unwrapped rather than as the canvas
happens to wrap it today. Moving an element toward a boundary is what breaks
that, so re-render and look after any move.
