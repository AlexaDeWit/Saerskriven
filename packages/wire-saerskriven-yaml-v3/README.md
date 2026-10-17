# @saerskriven/wire-saerskriven-yaml-v3

The Saerskriven YAML format, version 3, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping, and no
import of any internal package, the earlier versions' packages included.

Version 3 holds each element once, at the root, and gives each diagram the
placements that draw it. `saerskrivenYamlCodec` in
[`@saerskriven/formats`](../formats/README.md) reads every version through its
migration to version 3, and writes version 3 only for a model that version 2
cannot hold.
[`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the file
and its compatibility contract.

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml-v3`.
