# The Saerskriven YAML format

Saerskriven's own file format. A save writes version 2 while version 2 holds
the model, and version 3, which holds each element once and lets one element
be drawn on several diagrams, once it does not
([Which version a save writes](#which-version-a-save-writes)). Everything the
internal model holds has a place in the file, and everything this release
declares for the file has a place in the model, so a file this release wrote
reads and writes back with nothing changed and no divergence reported in
either direction. A file from a later release can hold more, and what this
release has no place for it drops and reports: a key it does not declare
([Reading](#reading)), and an accent it does not know ([Accents](#accents)). A
version 1 file still reads, through the migration Reading describes. The other
format Saerskriven reads, Threat Dragon v2 JSON, is somebody else's shape and
does not have that property.

Each version is declared by a package of one zod schema that imports nothing
but zod: `@saerskriven/wire-saerskriven-yaml-v3` for version 3,
`@saerskriven/wire-saerskriven-yaml-v2` for version 2 and
`@saerskriven/wire-saerskriven-yaml` for version 1. Those are the format's
definition, and this page describes them rather than restating them. The codec
is `saerskrivenYamlCodec` in `@saerskriven/formats`, the only place that knows
both the file and the model.

## The file

YAML, UTF-8, one document, a mapping at the root with its keys in this order.
Version 3 has all eight, and version 2 has every one but `elements`:

| Key                      | What it holds                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `formatVersion`          | `2` or `3`, exactly                                                                                                                                    |
| `metadata`               | Title, owner, description, contributors                                                                                                                |
| `assumptions`            | What the analysis rests on, linked to threats by id, and `appliesToModel`                                                                              |
| `diagrams`               | The diagrams: in version 2 each owns its elements and their geometry, and in version 3 each holds placements of the elements ([Version 3](#version-3)) |
| `elements`               | Version 3 only: each element once, with its facts and relationships, wherever it is drawn                                                              |
| `mitigations`            | Mitigating work, addressing threats by id                                                                                                              |
| `threats`                | The threats, each attached to elements by id, and optionally `appliesToModel`                                                                          |
| `lastIssuedThreatNumber` | The highest threat number ever issued or kept by a paste, counting removed ones                                                                        |

Every key is required unless the schema marks it optional, and every list may
be empty. Nothing is defaulted: a model saves before it is drawn, and it does so
with empty strings and empty lists rather than with absent keys. Version 2
declares a few keys optional from its first release, each where absence means
something. A flow's `bidirectional` is absent where the read takes the flow as
one way. An attached endpoint's `side`, one of `top`, `right`, `bottom` and
`left`, pins the end to that side of its element, and absent leaves the side to
the renderer. A write states `bidirectional` on every flow and `side` on every
pinned end. The security facts and declared relationships below are optional
from the first release too, with absence meaning unknown. Version 3 keeps
every key of version 2, with the same optionality and the same rule for when a
write states it, and moves some of them onto placements. What a key added
later costs the format, and when a write states one, is under `formatVersion`
below.

That order is three tiers, so a key added to the format later has an obvious
home rather than an argued one. The header comes first, `formatVersion` and
then `metadata`, because it says what the file is and what it covers. The
content follows in alphabetical order, since no other order among
`assumptions`, `diagrams`, `elements`, `mitigations` and `threats` is more
true than the rest. The bookkeeping the editor keeps for itself goes last,
where it is out of the way of a reader.

An element and a threat category are tagged unions, written with the tag
first: `kind` for an element, a flow endpoint and a boundary shape,
`methodology` for a category. A version 3 placement has no tag: its keys tell
which geometry it holds.

## Version 3

Version 3 holds each element once, in the root `elements` list, and gives
each diagram `placements` in the order it draws them. An element holds its id,
kind, name, description and scope, its security facts and relationship lists,
a Note's text, and for a flow its direction and, for each end, the element it
attaches to (`kind: attached` and `element`) or `kind: free`. A placement holds
`element`, the id of the element it draws, an optional `accent`, and the
element's geometry on that diagram, which its keys tell apart:

| Element kind                | Placement geometry                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Actor, process, store, Note | `position` and `size`                                                                       |
| Trust boundary              | `shape`, a box or a curve as in version 2                                                   |
| Flow                        | `waypoints`, and a `source` and a `target`, each a pinned `side` or a free end's `position` |

An end attached to an element placed on the same diagram holds no `position`,
and its `side` pins it where one is given, as in version 2. A free end holds
its `position` and no `side`. A diagram places an element at most once, and
every element is placed at least once. This release still refuses a file that
places one element on two diagrams or draws a flow end away from its element,
so every version 3 file it reads is one version 2 also holds.

### Why a new version

Sharing an element is a change an older release cannot pass over. Had it been
an optional key of version 2, a release of version 2 would open the file and
drop what it does not declare, and the studio's save, which does not refuse
that ([Reading](#reading)), would write the file without it. A release that
does not know version 3 refuses the whole file at `formatVersion` instead, so
it cannot damage one. The accent also moves from the element to its
placement, a rename, which the rule under `formatVersion` makes breaking.
[The proposal on #847](https://github.com/AlexaDeWit/Saerskriven/issues/847#issuecomment-6226181435)
sets out the design and its reasons.

### Which version a save writes

A save writes version 2 while version 2 holds the model, and version 3 once it
does not. Version 2 holds a model where:

- every element is on exactly one diagram,
- no flow end is drawn away from its element, and
- every relationship list, `containedElements`, `crossingFlows` and
  `trustBoundaryIds`, names elements of the one diagram that draws the element
  holding it.

The version follows from the model alone, never from the version the file was
read as. Two writes of one model are byte-identical, a file keeps its version
and its bytes through every edit version 2 can hold, and a file goes back to
version 2 once its last shared element is unshared. A version 1 file is
written as version 2. No file changes version unless its content needs it, so
a file an earlier release opens stays one it opens, and a tracked file's diff
moves every element only at the edit that needs version 3.

A release that reads only versions 1 and 2 refuses a version 3 file, so three
tools say when they write one:

- The studio shows a report under the card at the edit that moves the model
  from version 2 to version 3, worked out from the model before and after the
  edit.
- `saer_edit` answers `movedToVersion3` for a batch that moves a file from
  version 2 to version 3, worked out the same way ([writing](mcp.md#writing)).
- `saer convert` warns on standard error whenever the document it writes is
  version 3, since a conversion is not an edit and holds no earlier model.

`saer_create` and `saer_import` write a new file and say nothing of its
version, and nothing is said at a move back to version 2. A share link, the
studio's clipboard and its recovery snapshot carry the text or the document a
save writes, so they follow the same rule, and the snapshot keeps no retained
document for a Saerskriven YAML file, which its save does not read.

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

Version 2 has grown by two keys. The first is a threat's `appliesToModel`. A
threat applies to the model as a whole, to the elements it names, or to both,
as an assumption applies to the model, to threats, or to both. An assumption's
`appliesToModel` is required, because the first release of version 2 declared
it. A threat's is optional, and a threat that leaves it out does not apply to
the model. The model holds the flag on every threat, and a write states it
only on a threat that applies to the model, under the rule above for a key
added after a version's first release. A `false` written by hand is therefore
removed by the next save. The studio sets a threat's flag under the threat's
[attached elements](studio.md#attached-elements) and an assumption's on
[the model panel](studio.md#the-model-panel). `saer_edit` sets either through
the operations that link a [threat](mcp.md#threats) or an
[assumption](mcp.md#mitigations-and-assumptions) to the model and unlink it.

The second is an element's `accent`, which [Accents](#accents) describes.

Everything else is breaking: a rename, a type change, a removal, or a new key
whose absence means nothing. That takes a new `formatVersion`, and a new
version arrives as a wire package of its own beside the one before it, so
`@saerskriven/wire-saerskriven-yaml` goes on declaring version 1 unchanged and
a file of that version keeps the reading it has. The migration from one
version to the next lives in `@saerskriven/formats`, which the layer matrix
makes the only place allowed to know two wire packages. A write emits version
2 or version 3, as [Which version a save writes](#which-version-a-save-writes)
sets out. A release that reads only versions 1 and 2 refuses a version 3 file
whole, at `formatVersion`, and a release from before version 2 refuses a
version 2 file the same way.

Every released version reads, for good. A read dispatches on the version the
file states: a version 3 file goes straight to the mapping, a version 2 file
goes through the v2 to v3 step first, and a version 1 file through the v1 to
v2 migration before that, so a file Saerskriven has ever written opens in
every later release of it.

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
by a later release of its version still reads here, minus what this release has
no home for. Its `saer_edit`, and `saer convert` rewriting the file in place,
refuse to write such a file unless the call says to drop the key
([writing](mcp.md#writing), [usage](../README.md#usage)), while the studio, a
conversion to another file, and a release from before that refusal drop it.
Use a release that declares the key for lossless edits. A value this release
does not declare in an enumerated vocabulary is a refusal, at the path of that
value, as the additive rule above sets out.

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

Every status carries over as the file states it. A version 1 file then takes
the v2 to v3 step a version 2 file takes.

The v2 to v3 step moves each element to the root `elements` list, in the order
the diagrams draw them, and leaves on the diagram that drew it a placement
holding its accent and geometry, in the same order. Every id, order and value
carries over, an accent no release knows included, so the step reports
nothing. The document a read hands back for a later write is the migrated
version 3 document, so a version 1 or 2 file written back unedited reports
nothing more than its read did, and is written as version 2, which holds every
model those versions read as.

What a read does refuse, it refuses with a path: into the file where the
schema is what said no, and into the model where a rule no schema states did,
such as a threat referring to an element no diagram holds. A model's path
names the field where the file states it: in version 1 or 2 under the diagram
that holds the element, and in version 3 under `elements` or under the
placement.

## Geometry

Every number that places or sizes something is in canvas units and has a
bound, both ends included:

- A coordinate, an `x` or a `y`, is from -1,000,000 to 1,000,000. That covers
  a `position`, a free flow end, and each of a flow's or a curve boundary's
  `waypoints`.
- A `width` or a `height` is from 1 to 1,000,000.

A read refuses a file holding a number outside its bound, with the path of
that number in the model. Nothing is clamped. An earlier release held any
finite coordinate and any size above zero, so a file it wrote with a number
outside the bound no longer opens.

The bound is the model's (`geometryLimits` in `@saerskriven/model`), which
every format reads through, so a Threat Dragon or an OTM file is held to it
too. [Position and size](studio.md#moving-resizing-and-arranging) in the
studio and [the geometry edits](mcp.md#geometry) of `saer_edit` refuse the
same numbers.

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

## Accents

An element of any kind, a Note included, may take `accent`, one of eight keys:
`s1` to `s4` for a strong accent and `l1` to `l4` for a light one, over four
palette slots. A key names a slot and never a colour.
[The studio](studio.md#accents) and an exported drawing decide how a slot is
drawn, and the model reads no meaning into one. An accent belongs to the
diagram the element is drawn on: version 2 states it on the element, and
version 3 on the placement, after `element`.

The key arrived after version 2's first release, so a write states it only on
an element that holds an accent, as `accent: s1` after `reasonOutOfScope`, and
a file with none is written as it was before the key existed. Version 3 states
it on the same terms, on a placement that holds one.

`accent` is text in the wire schema, not an enumerated vocabulary, so the
refusal of an unknown enumerated value does not reach it. A text that is none
of the eight keys reads as no accent and is reported as a `narrowed`
divergence naming the element and the text, so a file holding a key a later
release adds still opens. The v2 to v3 step moves such a text onto the
placement as the file states it, and the read reports it there. A write drops
it, so `saer_edit`, and `saer convert` rewriting the file in place, refuse on
the terms of an undeclared key ([Reading](#reading)), and the studio's next
save writes no accent for that element. A value that is not text is refused at
its path, as any mistyped key is. In a version 1 file, `accent` is an
undeclared key: dropped, and reported as one.

A release of version 2 from before the key reads the file, drops each
`accent`, reports it as `undeclared` with its path, and writes the file
without it at its next save. A Note took the key in a later release than the
other kinds, and a release from between the two reads a Note's `accent` as an
undeclared key.

## Ordering

The bytes are fixed by the model, not by the run: two writes of one model
produce the same file, so a diff shows the edit and nothing else.

- **Keys** are written in the order the wire schema declares them, whatever
  order the model records were built in, with the tag of a tagged union
  first.
- **Threats** are written in number order. A threat number is unique across
  the model and no edit changes it, so ordering by it is total and holds each
  threat's position in the file steady as the model is edited.
- **Diagrams, elements, placements, mitigations and assumptions** keep the
  order the model holds them in. Version 2 writes a diagram's elements in the
  order it draws them, and version 3 the root elements in the model's order and
  a diagram's placements in the order it draws them. Diagrams and elements are
  drawn in that order, so it is information rather than incidental.
  Mitigations and assumptions have nothing to sort on that would order them
  any better: their ids are
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
the native YAML text in UTF-8, never the editor's own state, so a link holds
version 3 wherever a save would write it, and a release that reads only
versions 1 and 2 refuses that link at `formatVersion`. The codec is
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

The same model in version 3, as the version 3 projection writes it and a test
compares, though a save writes version 2 for a model version 2 holds:

<!-- prettier-ignore -->
```yaml
formatVersion: 3
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
    placements:
      - element: element-1
        position:
          x: 120
          y: 80
        size:
          width: 100
          height: 60
elements:
  - kind: process
    id: element-1
    name: Gateway
    description: ""
    outOfScope: false
    reasonOutOfScope: ""
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
