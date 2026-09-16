# @saerskriven/wire-saerskriven-yaml

The Saerskriven YAML format, version 1, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

The format is a contract with files people already have, so this schema is
the only authority on version 1. It declares its own ids, vocabularies and
record shapes, and none of them is built out of the internal model's, so a
change to the model cannot change what a version 1 file means. An id is any
non-empty string, unbranded: the model brands its ids at its own parse
boundary, and a file is not a model. Nothing here is defaulted and nothing is
transformed.

Every key the first release of version 1 declared is required, and a key a
later release added is optional: a flow's `bidirectional` and an attached
endpoint's `side`. The assumption status `unconfirmed` is a vocabulary value a
later release added. Version 1 is frozen: version 2 is
[`@saerskriven/wire-saerskriven-yaml-v2`](../wire-saerskriven-yaml-v2/README.md),
and [the format documentation](../../docs/saerskriven-yaml.md#formatversion)
states the compatibility contract both follow. `saerskrivenYamlCodec` in
[`@saerskriven/formats`](../formats/README.md) reads version 1 through its
migration to version 2.

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml`.
