# The Saerskriven YAML format

Saerskriven's own file format, version 2. Everything the internal model holds has
a place in the file and everything the file holds has a place in the model, so
reading a version 2 file and writing it back changes nothing and neither
direction reports a divergence. A version 1 file still reads, through the
migration [Reading](#reading) describes. The other format Saerskriven reads,
Threat Dragon v2 JSON, is somebody else's shape and does not have that
property.

Each version is declared by a package of one zod schema that imports nothing
but zod: `@saerskriven/wire-saerskriven-yaml-v2` for version 2 and
`@saerskriven/wire-saerskriven-yaml` for version 1. Those are the format's
definition, and this page describes them rather than restating them. The codec
is `saerskrivenYamlCodec` in `@saerskriven/formats`, the only place that knows
both the file and the model.

## The file

YAML, UTF-8, one document, a mapping at the root with seven keys in this
order:

| Key                      | What it holds                                                                   |
| ------------------------ | ------------------------------------------------------------------------------- |
| `formatVersion`          | `2`, exactly                                                                    |
| `metadata`               | Title, owner, description, contributors                                         |
| `assumptions`            | What the analysis rests on, linked to threats by id, and `appliesToModel`       |
| `diagrams`               | The diagrams, each owning its elements and their geometry                       |
| `mitigations`            | Mitigating work, addressing threats by id                                       |
| `threats`                | The threats, each attached to elements by id, and optionally `appliesToModel`   |
| `lastIssuedThreatNumber` | The highest threat number ever issued or kept by a paste, counting removed ones |

Every key is required unless the schema marks it optional, and every list may
be empty. Nothing is defaulted: a model saves before it is drawn, and it does so
with empty strings and empty lists rather than with absent keys. Version 2
declares a few keys optional from its first release, each where absence means
something. A flow's `bidirectional` is absent where the read takes the flow as
one way. An attached endpoint's `side`, one of `top`, `right`, `bottom` and
`left`, pins the end to that side of its element, and absent leaves the side to
the renderer. A write states `bidirectional` on every flow and `side` on every
pinned end. The security facts and declared relationships below are optional
from the first release too, with absence meaning unknown. What a key added
later costs the format, and when a write states one, is under `formatVersion`
below.

That order is three tiers, so a key added to the format later has an obvious
home rather than an argued one. The header comes first, `formatVersion` and
then `metadata`, because it says what the file is and what it covers. The
content follows in alphabetical order, since no other order among
`assumptions`, `diagrams`, `mitigations` and `threats` is more true than the
rest. The bookkeeping the editor keeps for itself goes last, where it is out
of the way of a reader.

An element and a threat category are tagged unions, written with the tag
first: `kind` for an element, a flow endpoint and a boundary shape,
`methodology` for a category.

## `formatVersion`

The version carries the compatibility contract set out below, and it is also what
tells a Saerskriven file apart from a JSON format without consulting the file
extension.

- **Missing**: the read fails, with the issue at path `formatVersion`.
- **A version this release does not know**: the read fails, with the issue at
  path `formatVersion`, and the file is refused whole rather than read in
  part.

A change to the format is additive when the absence of what it adds means
something. A new key is then optional on read, the mapping in
`@saerskriven/formats` supplies what its absence means, and `formatVersion`
stays where it is. A write states a key that a version's first release
declared wherever the model holds a value for it. A key added to a version
after its first release is written only where its value differs from what its
absence means, so a file from before the key is written back as it was, and an
earlier release of that version, which drops the key and reports it as
`undeclared`, meets it only in the files that use it.

A new value in an enumerated vocabulary is additive too: the version stays
where it is, and every file that does not use the value reads and writes as
it did. An older release refuses a file that holds the new value, at the path
of that value, because its schema does not declare it. An assumption's
`unconfirmed` status arrived this way in version 1.

Version 1 grew by additive changes: every key its first release declared is
required, and the keys later releases added are optional. Those are a flow's
`bidirectional`, an attached endpoint's `side`, the security facts on actors,
processes, stores and flows, and the relationship lists (`trustBoundaryIds`,
`containedElements` and `crossingFlows`). Version 1, which a write no longer
emits, stated `bidirectional` on every flow, one-way ones included, so the
rule above for a later key holds from version 2 on.

Version 2 has grown by one: a threat's `appliesToModel`. A threat applies to
the model as a whole, to the elements it names, or to both, as an assumption
applies to the model, to threats, or to both. An assumption's `appliesToModel`
is required, because the first release of version 2 declared it. A threat's is
optional, and a threat that leaves it out does not apply to the model. The
model holds the flag on every threat, and a write states it only on a threat
that applies to the model, under the rule above for a key added after a
version's first release. A `false` written by hand is therefore removed by the
next save. The studio sets a threat's flag under the threat's
[attached elements](studio.md#attached-elements) and an assumption's on
[the model panel](studio.md#the-model-panel). `saer_edit` sets either through
the operations that link a [threat](mcp.md#threats) or an
[assumption](mcp.md#mitigations-and-assumptions) to the model and unlink it.

Everything else is breaking: a rename, a type change, a removal, or a new key
whose absence means nothing. That takes a new `formatVersion`, and a new
version arrives as a wire package of its own beside the one before it, so
`@saerskriven/wire-saerskriven-yaml` goes on declaring version 1 unchanged and
a file of that version keeps the reading it has. The migration from one
version to the next lives in `@saerskriven/formats`, which the layer matrix
makes the only place allowed to know two wire packages. A write emits the
version this release is current on, which is 2, and a release from before
version 2 refuses that file at `formatVersion`.

Every released version reads, for good. A read dispatches on the version the
file states: a version 2 file goes straight to the mapping, and a version 1
file goes through the v1 to v2 migration first, so a file Saerskriven has ever
written opens in every later release of it.

The internal model cannot change this. The wire schema declares its own ids,
its own vocabularies, and its own record shapes, and the layer matrix forbids
it from reusing the model's, so a model changed for the sake of the editor
leaves the format alone. What the two have in common today they have by
coincidence, and the mapping between them is written out in
`@saerskriven/formats`, member by member, so a change on either side stops
compiling there rather than silently reaching a file. A change to what
a version carries is a change to its wire schema, deliberately.

## Reading

A key this release does not declare is not a refusal. The read drops it and
reports it as an `undeclared` divergence naming its path, so a file written
by a later release of version 2 still reads here, minus what this release has
no home for. Older releases can open extended files of their version but lose
these new fields when saving. Use a release that understands the fields for
lossless edits. A value this release does not declare in an enumerated
vocabulary is a refusal, at the path of that value, as the additive rule above
sets out.

A record with no reference in the file, a mitigation that links no threat or an
assumption that links no threat and does not apply to the model, is kept on
read and not culled, and so is a threat the file attaches to no element and
does not apply to the model. Culling is edit-triggered, as the
[model package](../packages/model/README.md) sets out.

A threat's model link is never inferred. A threat with an empty `elements`
list applies to the model only where the file states `appliesToModel: true`,
and version 1 has no such key, so a version 1 threat never does.

The first release of version 2 removed two keys and added one, and the v1 to
v2 migration reads a version 1 file in three steps over its document:

- An assumption links threats and nothing else, so its `elements` list has no
  version 2 key. The migration drops every id in it and reports each
  assumption whose list held any as a `narrowed` divergence naming that
  assumption.
- A mitigation is a record, so a threat's `mitigation` text has no version 2
  key. The migration makes one mitigation record of a non-empty text, linked
  to that threat alone, with an empty title, the text as its prose, and the
  status `implemented` where the threat is `mitigated` and `proposed`
  otherwise. Its id is `<threat id>-mitigation`, counted on with `-2`, `-3`
  past any id the file already holds, and the records follow the file's own
  mitigations in threat number order, which is the rule the Threat Dragon read
  follows too. An empty text makes no record, and nothing is reported, since
  nothing is lost.
- An assumption may apply to the model as a whole as well as to threats, which
  version 2 states as `appliesToModel`. A version 1 assumption whose `threats`
  list is empty applies to the model, and one that links threats keeps them
  and does not. Nothing is reported, since nothing is lost. This is the only
  place an empty threat list is read as a model link.

Every status carries over as the file states it. The document a read hands
back for a later write is the migrated version 2 document, so a version 1
file written back unedited reports nothing more than its read did, and is
written as version 2.

What a read does refuse, it refuses with a path: into the file where the
schema is what said no, and into the model where a rule no schema states did,
such as a threat referring to an element no diagram holds.

## Security facts

These optional fields use the same names in native YAML, the internal model,
and Threat Dragon's element `data` object.

| Element kind     | Fields                                                                               |
| ---------------- | ------------------------------------------------------------------------------------ |
| `actor`          | `providesAuthentication`                                                             |
| `process`        | `handlesCardPayment`, `handlesGoodsOrServices`, `isWebApplication`, `privilegeLevel` |
| `store`          | `isALog`, `isEncrypted`, `isSigned`, `storesCredentials`, `storesInventory`          |
| `flow`           | `protocol`, `isEncrypted`, `isPublicNetwork`, `trustBoundaryIds`                     |
| `trust-boundary` | `containedElements`, `crossingFlows`                                                 |

The flags are booleans. An absent flag means unknown, and `false` records an
explicit negative. `protocol` and `privilegeLevel` are text, without a closed
vocabulary. An empty string is an explicit value and remains distinct from absence.

`trustBoundaryIds` records the boundaries a flow crosses. `containedElements`
records the elements inside a boundary, and `crossingFlows` records its crossing
flows. List order and repeated entries survive conversion. An absent list means
unrecorded relationships. An empty list explicitly records none. The model does
not infer these assertions from geometry or add reciprocal assertions.

Each reference must resolve inside its element's diagram. `trustBoundaryIds`
targets trust boundaries, `crossingFlows` targets flows, and `containedElements`
targets another element. Invalid relationships refuse the read with a field path.

Deleting an element also removes its entries from these lists. A previously
present list can become empty, while an absent list stays absent. Moving, resizing,
renaming, reconnecting or changing flow direction leaves all recorded facts intact.
Copying a selection restricts the copied relationship lists to copied targets,
matching threat links. Pasting remaps every retained target ID.
The original model retains its full lists.

The studio edits these values under **Security properties**
([using the studio](studio.md#security-properties)).

## Ordering

The bytes are fixed by the model, not by the run: two writes of one model
produce the same file, so a diff shows the edit and nothing else.

- **Keys** are written in the order the wire schema declares them, whatever
  order the model records were built in, with the tag of a tagged union
  first.
- **Threats** are written in number order. A threat number is unique across
  the model and no edit changes it, so ordering by it is total and holds each
  threat's position in the file steady as the model is edited.
- **Diagrams, elements, mitigations and assumptions** keep the order the
  model holds them in. Diagrams and elements are drawn in that order, so it
  is information rather than incidental. Mitigations and assumptions have
  nothing to sort on that would order them any better: their ids are
  generated, so sorting by id scatters them and drops each new record
  wherever its id falls, and a title moves when a record is retitled.
- **No line is wrapped.** A long description is one long line, so editing a
  sentence changes the line it is on rather than reflowing the paragraph
  under it.

A read preserves the order the file states. It is a write that orders, so a
hand-edited file reaches canonical order the next time Saerskriven saves it.

## Share links

A share link carries a whole model in its URL fragment:
`<base URL>#share=<encoding>.<payload>`. The payload is the file a save writes,
the native YAML text in UTF-8, never the editor's own state. The codec is
`writeShareLink` and `readShareLink` on the `@saerskriven/formats/share-link`
subpath, which take the brotli module as bytes.

| Encoding | Payload                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `1`      | The text compressed as one standard brotli stream at quality 11 with no custom dictionary, then base64url without padding (RFC 4648, section 5) |

Every encoding ever issued decodes for good. An encoding is a number of one to
four ASCII digits, and a later encoding takes a new one. A release refuses a
number it does not know as `UnknownEncoding`, and anything else where the
number goes as `Malformed`.

The encoding versions the wrapping, and the document's own `formatVersion`
versions the content. A link is read through `saerskrivenYamlCodec`, the path a
file takes, so a link written by an earlier release migrates as its file would,
and every read limit applies. Decompression stops at `readLimits.maxTextBytes`,
and a stream that would inflate past it is refused as `ExceededReadLimit`.

A link holds at most 1,048,576 characters, base URL included: Firefox's default
cap, which Chrome and Safari both exceed, so every link opens in all three. A
model whose link would pass that gets `TooLong` rather than a link, and one
whose text is past `readLimits.maxTextBytes` gets `PastReadBound`, since no read
would open it. A link that was cut off, or holds a character outside the
base64url alphabet, is refused as `Malformed`: chat tools shorten long links.

## An example

Written by the codec, and compared against it by a test, so it is what a save
produces rather than a rendering of one. The formatter is told to leave it
alone for that reason.

<!-- prettier-ignore -->
```yaml
formatVersion: 2
metadata:
  title: Order service
  owner: Alexandra de Wit
  description: ""
  contributors:
    - Alexandra de Wit
assumptions: []
diagrams:
  - id: diagram-1
    title: High level
    elements:
      - kind: process
        id: element-1
        name: Gateway
        description: ""
        outOfScope: false
        reasonOutOfScope: ""
        position:
          x: 120
          y: 80
        size:
          width: 100
          height: 60
mitigations: []
threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category:
      methodology: STRIDE
      category: spoofing
    severity: high
    status: open
    description: An unauthenticated caller reaches the gateway.
    elements:
      - element-1
lastIssuedThreatNumber: 1
```

[`threat-modelling/saerskriven.yaml`](../threat-modelling/README.md) is
Saerskriven's own threat model, a production-scale example authored in this
format rather than converted into it.
