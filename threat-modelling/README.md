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

It is a draft the maintainer refines. The formats suite reads it, validates it
and holds it to the writer's canonical form, through `nativeFixtures` in
`packages/formats/src/lib/saerskriven-yaml.fixtures.ts`. The canvas and
render goldens come from purpose-built fixtures under `test-data`, so an edit
here regenerates none of them.

## Editing it

The committed bytes must stay what `saerskrivenYamlCodec` writes: the formats
suite compares a write of the file's read with the file itself, and nothing
rewrites the file, so a hand edit that leaves the writer's canonical form fails
the suite. `.oxfmtrc.json` leaves the YAML here alone for the same reason. To
get the canonical form, save the file from the studio or edit it through the
MCP server's `saer_edit`, both of which write through the codec, or match the
form by hand until the formats suite passes.

Flow names are placed by `packages/canvas` against the other shapes, lines,
names and badges of the diagram, and a name with no clear place still takes the
cheapest one, so a gap narrower than a name puts it over a line. After moving
an element, re-render and check that every gap is still wide enough for the
name that crosses it, measured against the name unwrapped rather than as the
canvas happens to wrap it.
