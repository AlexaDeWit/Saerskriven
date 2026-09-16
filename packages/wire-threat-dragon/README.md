# @saerskriven/wire-threat-dragon

The OWASP Threat Dragon v2 file format as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

The format belongs to another project and the files are already in the wild,
so this schema is the only authority on it here. It declares its own ids,
vocabularies and record shapes, and none of them is built out of the internal
model's, so no change to the model can change what a Threat Dragon file means.

It declares what Threat Dragon writes, not what Threat Dragon publishes. The
JSON Schema that project ships describes the same format and the two differ:
the published one puts a cell's threats beside `data` rather than under it,
names a threat's id `threatId`, and declares neither ports nor tools nor
labels nor `threatFrequency` nor the boundary bookkeeping. Where the two agree
on a bound this schema takes the published one, which is where the
two-character minimum on a cell id, a threat id, and the string branch of
`summary.id` comes from. The published bound on `diagramType` it does not
take is `minLength: 3`, one character here, because that value is a display
label Threat Dragon translates and a two-character label in some language is
not far-fetched. [`test-data/README.md`](../../test-data/README.md#threat-dragonschema)
records what the published schema requires of a written file.

The schema declares every key the format carries, the parts Saerskriven does not
model included, because a write merges onto the document a read returned and
only a declared key is there to leave alone. What it declares it demands, and
it demands nothing else: a value with no home in the internal model reaches
the document intact and is refused, if at all, by the mapping rather than
here.

The codec is `threatDragonCodec` in
[`@saerskriven/formats`](../formats/README.md), and the corpus that gates it is
described in [`test-data/README.md`](../../test-data/README.md).

Unit tests: `pnpm nx test @saerskriven/wire-threat-dragon`.
