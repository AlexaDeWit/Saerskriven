# @saerskriven/formats

Reads and writes Saerskriven's file formats, and imports OTM and TM-BOM. It is
the only package that maps between the model and the wire packages: it imports
`@saerskriven/model` and the wire packages, and no other internal package.
Behavioural detail lives in the TSDoc of the module named beside each part
below.

## Codecs

A `Codec` ([`codec.ts`](src/lib/codec.ts)) is one interface over two paths.
`read` returns the model together with the wire document it was mapped from.
`write` merges the model onto that document when given it, so what the model
does not describe stays as the file had it, and projects the model into the
format's canonical form when given none. A read that fails returns a
`ReadFailure` in an Effect `Either`, and `renderReadFailure`
([`read-failure.ts`](src/lib/read-failure.ts)) words it for a person.

Two codecs are registered:

- `threatDragonCodec`, Threat Dragon v2, declared by
  [`@saerskriven/wire-threat-dragon`](../wire-threat-dragon/README.md). The read
  is [`threat-dragon-read.ts`](src/lib/threat-dragon-read.ts) and the merge and
  its numbering rules are
  [`threat-dragon-write.ts`](src/lib/threat-dragon-write.ts).
- `saerskrivenYamlCodec`, the native format, declared by
  [`@saerskriven/wire-saerskriven-yaml-v2`](../wire-saerskriven-yaml-v2/README.md)
  for version 2 and
  [`@saerskriven/wire-saerskriven-yaml`](../wire-saerskriven-yaml/README.md) for
  version 1. A write emits version 2, and a read takes both, migrating version 1
  in [`saerskriven-yaml-migration.ts`](src/lib/saerskriven-yaml-migration.ts).
  [`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the
  file.

`readAnyFormat` ([`detect.ts`](src/lib/detect.ts)) opens a text without being
told its format and answers with the codec that claimed it, so a later write
goes back through the same one.

## Divergences

A divergence is a place a file and the model do not correspond exactly, or a
written file and the source it was merged onto. Reads and writes return one
list of them, and an empty list is the aligned case. The reasons and the
terminal escaping of `renderDivergences` are in
[`divergence.ts`](src/lib/divergence.ts).

## Read limits

`readLimits` ([`read-limits.ts`](src/lib/read-limits.ts)) is what a read may
spend on a text before refusing it, exported so a caller checking a file first
enforces the same numbers. There are four parsing bounds: 8 MiB of UTF-8, 64
levels of nesting, 50 YAML aliases, and 100,000 nodes reached through them.
`maxImportTextUnits` is an import budget beside them. YAML alias accounting is
in [`yaml-alias-cost.ts`](src/lib/yaml-alias-cost.ts).

## Import

[Import](../../docs/import.md) converts OTM and TM-BOM into a native model through
`importModel` ([`import.ts`](src/lib/import.ts)). No codec writes those
formats.

## Fixtures

Each format this package reads keeps one feature-complete fixture, hand
written to use every field, enum value and union variant its wire schema
declares, with the model or register the read makes of it written out by hand
beside it:

- Threat Dragon:
  [`test-data/threat-dragon/feature-complete.json`](../../test-data/threat-dragon/feature-complete.json),
  with `featureCompleteModel` in
  [`threat-dragon.fixtures.ts`](src/lib/threat-dragon.fixtures.ts).
- Saerskriven YAML version 2:
  [`test-data/saerskriven/feature-complete.yaml`](../../test-data/saerskriven/feature-complete.yaml),
  which states its own model.
- OTM and TM-BOM: `otmFeatureComplete`, `tmbomFeatureComplete` and
  `tmbomScopeVariants` in [`import.fixtures.ts`](src/lib/import.fixtures.ts).
  A TM-BOM scope holds one value of each of its enums, so the variants carry
  the others and the 1.0.1 release.

`unusedConstructs` in
[`wire-coverage.fixtures.ts`](src/lib/wire-coverage.fixtures.ts) walks a wire
schema and names what no fixture uses, so a construct added to a wire package
fails a test until a fixture carries it. It tells constructs apart by schema
instance: a field schema counts once wherever it is used, whether shared through
`.extend()` or a constant, so a new field built from a shared schema already
used under the same name is not flagged. A schema type the walk does not know
fails the test. Version 1 of Saerskriven YAML is held by the frozen files a
release wrote, `test-data/saerskriven/v0.2.1.yaml` and
`saerskriven-v0.3.0.yaml`, which are never extended.

`nativeFixtures` in
[`saerskriven-yaml.fixtures.ts`](src/lib/saerskriven-yaml.fixtures.ts) lists
the native files committed in the writer's canonical form, the feature-complete
file, `test-data/saerskriven/two-diagrams.yaml` and
[`threat-modelling/saerskriven.yaml`](../../threat-modelling/README.md), and
each is compared byte for byte with a write of its read.

Unit tests: `pnpm nx test @saerskriven/formats`.
