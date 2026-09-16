# @saerskriven/wire-saerskriven-yaml

The Saerskriven YAML format, version 1, as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

This schema is the only authority on version 1. It declares its own ids,
vocabularies and record shapes rather than building them out of the internal
model's. An id is any non-empty string, unbranded: the model brands its ids at
its own parse boundary, and a file is not a model. Nothing here is defaulted
and nothing is transformed.

Version 2 is
[`@saerskriven/wire-saerskriven-yaml-v2`](../wire-saerskriven-yaml-v2/README.md).
[The format documentation](../../docs/saerskriven-yaml.md#formatversion) states
the compatibility contract both versions follow, and `saerskrivenYamlCodec` in
[`@saerskriven/formats`](../formats/README.md) reads version 1 through its
migration to version 2.

Unit tests: `pnpm nx test @saerskriven/wire-saerskriven-yaml`.
