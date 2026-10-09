# @saerskriven/model

Zod schemas and inferred types for the threat model core: ids, geometry,
elements, diagrams, threats, mitigations, assumptions, and model metadata.
`parseModel` is the parse boundary and the only exported way a `Model` value
comes into existence, `emptyModel` being the one the package parses for you,
where a model that has not been drawn starts. Fallible exports return Effect's
`Either` with a package-owned tagged failure, and an infallible operation
returns its result bare, on the terms [`CODING.md`](../../CODING.md#error-handling)
sets. Each export's TSDoc states its behaviour.

## Text

Every string the model holds is text of a defined character set: an allowlist
of the letters, marks, numbers, punctuation, symbols and space separators
Unicode defines, tab, line feed and carriage return, and the format characters
a script owns. [`SCHEMA.md`](SCHEMA.md) states the set in full, and what it
refuses.

Which format characters that rule reaches depends on the Unicode data the
runtime carries, so
[`src/lib/text.format-characters.snapshot.txt`](src/lib/text.format-characters.snapshot.txt)
pins the set. The suite walks every Cf code point the runtime knows and
writes the accepted ones there as a file snapshot, so a Node or ICU upgrade
that moves the set arrives as a diff on that file rather than as a silent
change, and the diff is a question to answer: a character an upgrade gives a
script is a widening to keep, and one that leaves is a refusal of text a
model in the wild may already hold.

A control character or a bidirectional override from a foreign file is
refused at the parse boundary, with a path to the field that carried it,
rather than reaching a diagram. `firstRefusedCharacter` gives the index of
the first character a string carries that the rule refuses, so an editor can
point at it rather than at the field alone.

`parseModel` is the whole of that gate for a foreign file. `renameElement`,
`editNote`, `setElementDetails`, `setElementProperties`, `addDiagram`,
`renameDiagram` and `setModelMetadata` screen the strings that an editor
commits after parsing, and `selectionFragment`, `remapFragment` and
`insertFragment` pass what they produce through `parseModel`. The other edit
operations take a caller's strings as given, a model assembled in memory
being the caller's to assemble.
A boundary that renders a model escapes or replaces what its output format
forbids instead of resting on this rule.

## Geometry

Every coordinate and size the model holds lies inside `geometryLimits`, both
ends included: a coordinate from -1,000,000 to 1,000,000, and a width or a
height from 1 to 1,000,000. `pointSchema` and `sizeSchema` carry the bound, so
`parseModel` refuses a number outside it with a path to the field, and a
caller validating a typed or passed number with either schema refuses the same
ones. Nothing is clamped.

`selectionFragment`, `remapFragment` and `insertFragment` pass what they
produce through `parseModel`, so a paste offset that would carry an element
past the bound is refused. The other geometry operations store the numbers a
caller hands them and what they compute from those, unchecked: a caller hands
them numbers inside the bound, and a move from a position at the edge of it
can still store one past it, which the next read refuses.

## Operations

Operations are pure functions returning new models: graph edits (add, remove,
move, resize, rename, edit Note text, set description and scope, reconnect,
set flow route and direction, free or move one flow end, reverse a flow, set a
trust boundary's shape, set security properties), diagram edits (add,
rename, remove), a metadata edit, fragment edits (copy, remap, insert), and
register edits for threats (add, remove, replace, attach, detach, link to the
model, unlink from it), mitigations and assumptions (add, replace, remove,
link, unlink, set status). Coverage
queries read a model without changing it: elements no threat references, open
threats by severity, and the threat count of every element. `autoPlacement`
gives a position to a caller that has none to read, as the OTM and TM-BOM
imports do.

An operation that writes geometry takes, as its last argument, how many
decimals to store (`Decimals`, a whole count from 0 to 100): `addElement`,
`removeElement`, `moveElement`, `resizeElement`, `setFlowWaypoints`,
`setFlowEndPosition`, `setBoundaryShape` and `remapFragment`. Handed a count,
it rounds the numbers it writes to that many decimals, the nearest such number
with no negative zero, so a move by an offset from 123.63636363636364 lands on
128.6 at one decimal. It rounds what it writes and nothing else: a move the
positions, bends, free ends and curve points it carries and not a size, a
resize the size and not the position, and no element it was not asked about.
Rounding keeps a number inside [the bound](#geometry), whose ends are whole.
Handed no count, an operation stores what it computes, which is what a file,
the CLI and the MCP server get. A geometry edit that would store every number
as it already is returns the model it was given, at a count or at none.
`setFlowWaypoints`, `setFlowEndPosition` and `setBoundaryShape` return it too
for geometry given as it is stored, so they keep a stored number the count
would round, where `moveElement` by a zero offset and `resizeElement` to the
size held round it. The model holds no count of its own: the caller names one.
`fixedNumber` writes a number at a count of decimals, `storedNumber` rounds
one, `storedPoint` rounds both coordinates of a point, and `decimalsOf` counts
the decimals a number is written with, which is the count that stores it
unchanged. The canvas package's `svgNumber` writes through the first.

A diagram's threats are the ones referencing an element drawn on it, which
`threatsOnDiagrams` reads for one diagram or several. A threat attached to no
element is on no diagram, whether or not it applies to the model.

A threat number never moves: the model carries the highest number it has ever
issued or kept by a paste, so a removed threat leaves a gap and
`nextThreatNumber` never hands its number back. A paste is the one way a number
returns: `insertFragment` lets a pasted threat keep a number no threat in the
model holds, so cut then paste restores a threat under its own number, and it
never leaves the last issued number below one it kept. A threat that applies
to the model survives the cut, so its paste issues no number at all, as the
fragment rules below set out.

`removeDiagram` refuses a diagram that still owns elements. A cascade would
delete records the caller never named, which no other operation does, so a
caller removes the elements with `removeElement` first.

Element variants hold optional security facts and declared boundary
relationships, with the absence semantics of
[the native format](../../docs/saerskriven-yaml.md#security-facts).
`setElementProperties` patches the existing kind: omitted keys keep their
values, keys set to `undefined` clear them, and a patch that changes nothing
returns the same model. Geometry edits do not change these facts.

`setElementDetails` changes the `description`, `outOfScope` and
`reasonOutOfScope` of an element of any kind, a Note included, and the name
stays with `renameElement`, which refuses an empty one on every kind but a
flow.

A copied threat or assumption leaves its `appliesToModel` behind, since the
link belongs to the model it was copied from: `selectionFragment` clears it. A
paste then links to what the target model already holds in place of copying
it, wherever the copy is identical to a held record:

- A mitigation or assumption is identical when the model holds one of the same
  kind, id and content: a mitigation's title, prose and status, or an
  assumption's prose and status. `appliesToModel` is not compared.
  `insertFragment` adds the pasted threat links to the held record, which
  keeps its own `appliesToModel`.
- A threat is identical when the model holds one under the same id that
  applies to the model and has the same number, title, category, description,
  severity and status. Its elements and its model link are not compared, since
  the copy carries its own element list and no link. `insertFragment` attaches
  the pasted elements to the held threat and changes nothing else on it, so
  the links a copied record holds to it are not pasted.

Everything else is copied: a record as a clone, an assumption with no model
link, and a threat as a new threat with no model link, a threat identical to a
held one that does not apply to the model included. So cutting the last
element of a threat that applies to the model and pasting it leaves one threat
under its number, and copying one of its elements attaches the copy to the
same threat. `fragmentRecordCounts` says how many of a fragment's records an
insert links and how many it copies, and `fragmentHeldThreats` names the
threats it attaches to in place of copying.

## Records, culling and flags

A mitigation has meaning on the threats it links, and one mitigation can link
many threats. An assumption has meaning on the threats it links, on the model
as a whole, or on both. The threat links live on the record, and a threat
carries no link back and no mitigation text of its own. An assumption's model
link is its stored `appliesToModel` flag, never inferred from an empty
`threats` list. `addMitigation` refuses a mitigation linked to no threat, and
`addAssumption` an assumption that links no threat and does not apply to the
model. A link that is already there, an unlink of a link that is not, or the
status a record already has return the model they were given. A replace is
whole-record replacement, as editing a threat is.

Culling is edit-triggered. A mitigation's references are its threat links, and
an assumption's are its threat links and its model link, which
`mitigationHasReference` and `assumptionHasReference` read. `removeThreat`, an
unlink, `unlinkAssumptionFromModel`, and a replace that take a record from one
or more references to none remove the record in the same operation, so one
undo step restores both. A record that already had no reference, which a file
can hold, stays through a replace or a status change, and `parseModel` keeps
it. `removeMitigation` and `removeAssumption` are explicit removals, not culls.
`droppedRecords` names the records one model holds and another does not, which
is how a caller reports what an edit culled.

A threat applies to the model as a whole, to the elements it names, or to
both, and its model link is its stored `appliesToModel` flag, never inferred
from an empty `elements` list. `linkThreatToModel` and `unlinkThreatFromModel`
set and clear it, and a link that is already there or an unlink of one that is
not returns the model it was given.

A threat is culled on the same terms as a record, its references being its
element attachments and its model link, which `threatHasReference` reads.
`detachThreat`, `removeElement`, `unlinkThreatFromModel` and `replaceThreat`
remove a threat whose last reference they take, carrying `removeThreat`'s own
cascade, so the records left with no threat go in the same operation and one
undo step restores all of them. A threat that applies to the model stays when
its last element goes, attached to nothing. A threat that had no reference
before the edit stays through any of them: `parseModel` keeps it, an unrelated
`removeElement` keeps it, and a `replaceThreat` that leaves it with none keeps
it too, whatever else it changes. `addThreat` accepts a threat with no
reference. `droppedThreats` names the threats one model holds and another does
not, the way `droppedRecords` does for records. No new threat takes a culled
threat's number.

`threatFlags` derives the flags a threat's records raise, as
`threatFlagSchema` values: `mitigated-without-implemented-work` for a
`mitigated` threat with no linked mitigation `implemented` or `verified`, and
`rests-on-invalidated-assumption` for a threat with a linked `invalidated`
assumption. An assumption is `unconfirmed`, `valid` or `invalidated`, and only
`invalidated` flags. A model link flags no threat. Flags are never stored and
never change a threat's status.

## Tests

The suite pins the decisions the schemas and `parseModel` make over small
hand-written models: the refusals a schema holds, each model-wide rule
`parseModel` adds, and the operations, each of which leaves its input
untouched and returns a model that parses. Spread across the whole
vocabulary is the job of `modelInputArbitrary`, which the formats suite
writes and reads back ([`packages/formats`](../formats/README.md)).

`@saerskriven/model/fixtures` is the one home for the fixture helpers every
suite in the workspace shares: the id parsers (`elementId`, `diagramId`,
`threatId`, `mitigationId`, `assumptionId`), `modelInputArbitrary`, the
fast-check generator of `parseModel` input, `parsedFixture`, which throws
where a fixture document stops parsing, since that is a broken suite rather
than a case under test, `committedModel`, which reads a model under
`test-data`, and `committedDiagrams`, the diagrams the canvas and render suites
draw from those files. The subpath resolves to source and stays out of the
library build. Who may import it is a workspace rule, stated in
[`CODING.md`](../../CODING.md#tests).

[`SCHEMA.md`](SCHEMA.md) is the whole model expanded from the schemas
themselves, regenerated and checked on every test run. Snapshots are updated as
[`CODING.md`](../../CODING.md#build-targets) says.

Unit tests: `pnpm nx test @saerskriven/model`.
