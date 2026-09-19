# Importing a foreign model

Saerskriven imports OTM and TM-BOM files into new native models, and writes
neither format.

In the studio, choose **Import** beside **Export** in the File menu and select
an OTM or TM-BOM file. Import replaces the current model after the usual
unsaved-changes confirmation. The result is an unsaved native model: Save
writes YAML under the source file's stem and never writes back to the imported
file. A refused import leaves the current model and file available. Over MCP,
`saer_import` writes the converted model to a new file ([the MCP
server](mcp.md)). On the command line, `saer convert <file> --to
saerskriven-yaml` writes it as native YAML ([usage](../README.md#usage)).

The conversion report names generated values, changed representations, and
omitted source fields that hold a value. Expand its details before dismissing
it. Import does not retain a source document for later merging, so keep the
original file when its omitted information matters.

`importModel(text)` in `@saerskriven/formats` provides the same conversion to
application code. It returns Effect's `Either`, with `ReadFailure` on refusal.
Content determines the format. JSON and YAML alike pass the size, depth and
alias bounds every read has. The text a conversion joins, the identifiers it
generates, and the escaped paths its report names for undeclared fields share
one budget, `readLimits.maxImportTextUnits`, charged before each string is
built. A conversion over it returns
`ExceededReadLimit`. Imported identifiers use an ASCII alphabet the canvas can
address. The mapping validates the references it uses and then parses the
result through `parseModel`.

## OTM 0.2.0

Import accepts the `otmVersion: 0.2.0` stamp. All components become process
nodes because OTM component types do not define a DFD vocabulary. Their
original types remain in their descriptions. All graph records enter one
diagram, using geometry from the first declared diagram representation
where available. Missing geometry receives a deterministic layout. Additional
representations, code references, and drawing attributes are reported as
omissions. Invalid geometry produces a model failure.

Trust zones become drawn boxes. Parent relationships and numeric trust
ratings do not enter the core. A bidirectional dataflow becomes one
bidirectional flow. Referenced asset names and descriptions become prose on
the arrows and components. These copies no longer share an editable data
identity.

Each threat occurrence becomes a separate threat with its own status and
mitigations. This preserves different treatments on different components.
Threat definitions without occurrences become threats on no element. Known
threat statuses map to the corresponding core treatment. Unknown statuses
remain in the description and import as open. Each mitigation an occurrence
names becomes a record linked to that occurrence's threat. Mitigations marked
implemented or verified retain that status. Other mitigation states import as
proposed, with the source state kept in prose and differences reported. A
mitigation definition no occurrence names would link no threat, so it becomes
a line of the model description holding its name and description, with a
report line.

Threat severity remains undecided. OTM numeric risk values and category
lists have no exact core equivalent and appear in the omission report.
Threats receive an unspecified custom category. Numeric mitigation
reductions, asset risk assessments, tags, and extension attributes are also
reported as omissions.

## TM-BOM 1.0.1 and 1.0.2

Import requires a `$schema` URI naming either supported release of the OWASP
Threat Model Library schema. The model's own `version` is not a schema
version. Later schema versions are refused.

Actors, components, data stores, and flows become their corresponding DFD
kinds. Import generates a diagram grouped by declared trust-zone membership.
Boxes show those zones, but membership remains visual after import. Embedded
Graphviz, Mermaid, PlantUML, and SVG sources are reported as omissions.
Import does not execute or interpret them.

Flow encryption and sensitivity values remain in the flow descriptions.
Data-set names and descriptions appear on the stores named by their
placements. TM-BOM has no direct data-set reference on a flow, so import does
not infer one. Shared data identity and other data-set properties are
reported as losses.

Threats preserve their declared component attachments and event descriptions.
They import as open, with undecided severity and an unspecified category.
Separate risk records and threat personas are reported as omissions.
Controls become mitigations linked to the threats they name. Active controls
become implemented mitigations. Suggested controls become proposed
mitigations. Other pending states remain in prose and import as proposed.
A control naming no threat would link no threat, so it becomes a line of the
model description holding its title, its description and its mapped status,
with a report line. Retired and declined controls are reported as omissions
whether or not they name a threat.

TM-BOM assumptions name no threat, so every assumption imports as an
assumption that applies to the model, with its description as prose.
Confirmed, rejected and unconfirmed assumptions map to the valid,
invalidated and unconfirmed states. Topic links are reported as omissions.
