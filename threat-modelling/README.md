# threat-modelling

Saerskriven's own threat model, in Saerskriven's own format.

## `saerskriven.yaml`

Two diagrams. `read-and-render` is the path a model file takes from disk
through the codecs into a register or a diagram. `agent-and-desktop` is the
path an agent or the desktop shell takes to the same core. The threats are the
ones this repository has: hostile files reaching the read limits and the wire
schemas, foreign prose reaching the render paths, the desktop IPC bridge, and
the MCP write tools.

Every status is true to the tree:

- A threat is **mitigated** where a mechanism is on `main` and a mitigation
  record names that mechanism.
- A threat is **open** where the surface is designed and its issue is named
  but nothing is built.
- A threat is **partly held** where a mechanism is on `main` and does not cover
  the whole surface. It stays open, and its mitigation record names the
  mechanism and what the mechanism leaves behind rather than an issue.
- A threat is **transferred** where its risk rests with whoever publishes a
  register.

It is a draft the maintainer refines. It is also the production-scale fixture
authored in the native format, beside the Écluse model under `test-data/` that
was read out of Threat Dragon's, so the formats, render, canvas, MCP, CLI and
studio suites all read it. The formats, render and canvas suites read it
through lists (`nativeFixtures` in
`packages/formats/src/lib/saerskriven-yaml.fixtures.ts`, the register list in
`markdown-register.spec.ts`, `goldenDocuments` in
`packages/render/src/render.fixtures.ts`, and the scene list in the canvas
spec), so a further native model joins them by being added to each, its
`nativeFixtures` entry naming where the derived model JSON goes
([test-data](../test-data/README.md#saerskrivenmodeljson)).

## Editing it

The committed bytes are what `saerskrivenYamlCodec` writes, compared as a
Vitest file snapshot against the file itself, so a hand edit that leaves the
writer's canonical form fails the suite. `.oxfmtrc.json` leaves the YAML here
alone for the same reason. Edit the file, then regenerate it and everything
derived from it in the same commit:

```sh
pnpm snapshots:update @saerskriven/formats  # YAML and model JSON
pnpm snapshots:update @saerskriven/render   # register, SVG and PNG
pnpm snapshots:update @saerskriven/canvas   # canvas SVG
```

The render update needs the rasterizer module built first
([Building the executables](../docs/build.md#the-svg-rasterizer)). Read every
diff before committing: each of those files is an output, so a change to one is
a change to what the format, the register, or the canvas writes.

Flow names are placed by `packages/canvas` against the other shapes, lines,
names and badges of the diagram, and a name with no clear place still takes the
cheapest one, so a gap narrower than a name puts it over a line. After moving
an element, re-render and check that every gap is still wide enough for the
name that crosses it, measured against the name unwrapped rather than as the
canvas happens to wrap it.
