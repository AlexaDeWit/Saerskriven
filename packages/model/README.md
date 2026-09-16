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
`editNote`, `addDiagram` and `renameDiagram` screen the strings that an
editor commits after parsing. The other edit operations take a caller's
strings as given, a model assembled in memory being the caller's to assemble.
A boundary that renders a model escapes or replaces what its output format
forbids instead of resting on this rule.

## Operations

Operations are pure functions returning new models: graph edits (add, remove,
move, resize, rename, edit Note text, reconnect, set flow route and
direction, set security properties), diagram edits (add, rename, remove),
fragment edits (copy, remap, insert), and register edits for threats (add,
remove, replace, attach, detach), mitigations and assumptions (add, replace,
remove, link, unlink, set status). Coverage queries read a model without
changing it: elements no threat references, open threats by severity, and the
threat count of every element. `autoPlacement` gives a position to a caller
that has none to read, as the OTM and TM-BOM imports do.

A threat number is issued once and never moves: the model carries the highest
number it has ever issued, so a removed threat leaves a permanent gap and
`nextThreatNumber` never hands its number back.

`removeDiagram` refuses a diagram that still owns elements. A cascade would
delete records the caller never named, which no other operation does, so a
caller removes the elements with `removeElement` first.

Element variants hold optional security facts and declared boundary
relationships, with the absence semantics of
[the native format](../../docs/saerskriven-yaml.md#security-facts).
`setElementProperties` patches the existing kind: omitted keys keep their
values, keys set to `undefined` clear them, and a patch that changes nothing
returns the same model. Geometry edits do not change these facts.

A pasted fragment's mitigation or assumption is identical to a record the
target model holds when it has the same kind, id and content: a mitigation's
title, prose and status, or an assumption's prose and status.
`appliesToModel` is not compared.

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
an assumption's are its threat links and its model link. `removeThreat`, an
unlink, `unlinkAssumptionFromModel`, and a replace that take a record from one
or more references to none remove the record in the same operation, so one
undo step restores both. A record that already had no reference, which a file
can hold, stays through a replace or a status change, and `parseModel` keeps
it. `removeMitigation` and `removeAssumption` are explicit removals, not culls.
`droppedRecords` names the records one model holds and another does not, which
is how a caller reports what an edit culled.

`threatFlags` derives the flags a threat's records raise, as
`threatFlagSchema` values: `mitigated-without-implemented-work` for a
`mitigated` threat with no linked mitigation `implemented` or `verified`, and
`rests-on-invalidated-assumption` for a threat with a linked `invalidated`
assumption. An assumption is `unconfirmed`, `valid` or `invalidated`, and only
`invalidated` flags. A model link flags no threat. Flags are never stored and
never change a threat's status.

## Tests

The suite carries a representability gate over the whole model vocabulary.
`ecluseFixture` transcribes Écluse's real Threat Dragon model into the internal
form, and `vocabularyComplementFixture` covers what that model never reaches.
Together they must span every element kind, boundary shape, endpoint kind,
threat status, severity, mitigation status, and assumption status the schemas
declare, and every category of every enumerated methodology, so a construct
that stops being representable fails a named assertion or the type-check. The
suite holds `ecluseFixture` against
[`test-data/ecluse.model.json`](../../test-data/ecluse.model.json) as a file
snapshot, which `packages/formats` compares its own read of the vendored file
against ([test-data](../../test-data/README.md)).

`@saerskriven/model/fixtures` is the one home for the fixture helpers every
suite in the workspace shares: the id parsers (`elementId`, `diagramId`,
`threatId`, `mitigationId`, `assumptionId`), `modelInputArbitrary`, the
fast-check generator of `parseModel` input, and `parsedFixture`, which throws
where a fixture document stops parsing, since that is a broken suite rather
than a case under test. The subpath resolves to source and stays out of the
library build. Who may import it is a workspace rule, stated in
[`CODING.md`](../../CODING.md#tests).

[`SCHEMA.md`](SCHEMA.md) is the whole model expanded from the schemas
themselves, regenerated and checked on every test run. Regenerate the
snapshots with `pnpm snapshots:update @saerskriven/model`.

Unit tests: `pnpm nx test @saerskriven/model`.
