# @saerskriven/wire-otm

The OTM 0.2.0 wire schema. This package imports zod alone and declares the
foreign document independently of the core model.

The schema follows the upstream JSON Schema. Component types and occurrence
states remain strings because OTM does not enumerate them. Extension
attributes remain declared maps of unknown values. Callers must bound input
before validation, including any values inside those maps.

A `parent` that names neither or both of a trust zone and a component is
refused with `{ code: 'otm-parent-not-single' }` as the issue's parameters.
`@saerskriven/formats` reads that code, so it is an interface.

[Fixture provenance](../../test-data/otm/README.md) records the source and
licences. [Import behaviour](../../docs/studio.md#otm-and-tm-bom) belongs to
the mapping package.
