# @saerskriven/wire-saerskriven-yaml-v2

The Saerskriven YAML format, version 2, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping, and no
import of any internal package, the version 1 package included.

`saerskrivenYamlCodec` in [`@saerskriven/formats`](../formats/README.md)
writes version 2 while version 2 holds the model, and reads it through its
migration to
[`@saerskriven/wire-saerskriven-yaml-v3`](../wire-saerskriven-yaml-v3/README.md).
[`docs/saerskriven-yaml.md`](../../docs/saerskriven-yaml.md) describes the file
and its compatibility contract.

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml-v2`.
