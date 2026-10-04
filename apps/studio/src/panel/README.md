# The studio's threat panel

The threats of whatever is selected, edited where they are read. The canvas
selects, the panel follows, and an edit leaves as a store action, so the
badges on the diagram and the panel are two views of one model with nothing
synchronizing them. The same location edits one threat chosen from the Register and the model's
own fields. What a person can do with it is in
[Using the studio](../../../../docs/studio.md#the-threat-panel).

## Modules

| Module                                                             | What it holds                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `threat-overlay.tsx`                                               | The mount: which panel to draw, the drafts and pane width it retains across both, and the keyboard                                                     |
| `panel-frame.tsx`, `panel-tabs.tsx`                                | The pane either panel draws: width control, heading, close control, Escape, the coverage it reports, and the Threats and Details tabs                  |
| `threat-panel.tsx`                                                 | The panel for a selection                                                                                                                              |
| `threat-list.tsx`                                                  | The Threats tab each panel draws: add, and on an element attach, then the threat list, and where focus goes after each change                          |
| `threat-editor.tsx`, `threat-scroll.ts`                            | One expanded threat, and where an opened threat and a field Tab reaches land in the scrolling body                                                     |
| `threat-summary.tsx`, `threat-marks.tsx`                           | A collapsed threat's summary, which is also its accordion trigger's accessible name, and its severity, status and flag marks                           |
| `threat-records.tsx`, `record-row.tsx`, `records.ts`               | One record group, one record folded or open, and what differs between the two record kinds and the two targets (`RecordTarget`: a threat or the model) |
| `shown-order.ts`                                                   | Holding the order a list mounted in, which the threat list and each record group keep while they are open                                              |
| `threat-attachments.tsx`                                           | What one threat is on: its model link and the elements it names, with the controls that change them                                                    |
| `pick-existing.tsx`                                                | The listbox and control that "Link existing" and "Attach existing" share                                                                               |
| `model-panel.tsx`                                                  | The focused threat editor, and the model's title, description and assumptions on Details                                                               |
| `threat-register.tsx`, `threat-register-state.ts`                  | The threat register over the canvas, and whether it is open, the R command that opens it, a choice that closes it, and where focus goes as it closes   |
| `element-properties.tsx`, `element-property-fields.tsx`            | The element's own fields on Details: its details, then its security properties, and their field kinds                                                  |
| `element-details.tsx`                                              | An element's description, out-of-scope flag and reason, for every kind, a note included                                                                |
| `threats.ts`                                                       | `panelSubject`, `attachedThreats` and `modelThreats`, the selectors the panel binds to, and what each picker offers                                    |
| `refusals.ts`, `distinct-labels.ts`, `panel-focus.ts`, `marked.ts` | Refused drafts, option labels a person can tell apart, the focus channel, and finding a record row, threat item or register row by its id              |

The panel is mounted from `../canvas/diagram-canvas.tsx`, inside the canvas
container, which is what makes it an overlay on the diagram rather than a
column taken off it. It is on the page only while something is selected or the
model panel is shown, so the panel is the only place a threat is added from. It
is held clear of the zoom cluster rather than drawn over it, and opening it
resizes nothing: the fit commands use the coverage the pane reports ([the
canvas](../canvas/README.md#the-view)). Its default width comes from
`panelCover` in the canvas tokens, projected as `--saer-panel-cover`. At phone
widths, a selection starts as a collapsed side drawer. Its controls expand and
collapse it without unmounting the fields, so drafts remain in place.

## What it holds

The panel holds no copy of model state. `panelSubject` returns one element, a
count of several, the model while the model panel is shown, or nothing. The
threat list reads `attachedThreats`, the threats of a single selection, on an
element's panel. The model editor reads `modelThreats` for history and refusal
handling but draws only its chosen threat. A flow is an
element here because it carries threats. The panel's own state is which tab
shows, which threat is expanded, the order the list mounted in, which records
are open, where focus is being sent, and the draft a field holds after a
refusal.

Focus is sent through `panel-focus.ts`, a channel of its own rather than a
field of the store, because focus belongs in neither the model nor its undo
stacks. Focus threats, the M command, the threat register, and undo and redo
use it, each through a `handlerSlot` (`../ui/handler-slot.ts`) the mounted
panel registers with. Each list has a home control, "Add a threat" on an
element and the Threats tab on the model, where M lands, so the model's own
Add a threat is not its home. M focuses the model's. An undo that takes away
the threat holding focus sends focus home, a redo there sends it back to the
restored title, and anywhere else focus stays where it is. A threat restored
while another holds a refused draft stays collapsed, with focus left home. A
deleted threat's focus goes home too where no threat is left to take it.

The pane claims the first Escape, closing and returning focus to the element,
so one press never also clears the selection. An open listbox inside the pane
is handling Escape itself, and the press is left to it. What is closed is the
element rather than the panel: it stays closed while it is the selection,
whatever is then moved, resized or undone on it. The model panel, which clears
the selection as it opens, closes outright and hands focus to the canvas.

Refused drafts are held per list in the overlay, which outlives the panel: an
element's under its id and the model's under no element (`HeldDrafts`). A draft
goes when its text is settled, by a correction or an edit landing under it,
when the threat it named leaves the list, or when the file changes. A model
arriving with the same ids is a different sitting and starts on what the model
says. The file is identified by its name, the state carrying nothing else that
tells two sittings apart, so a save under another name starts the drafts afresh
as an open does. Drafts in an element's description, reason and security
properties use the same lifetime, and a reason's draft also goes when its field
hides, whatever hid it. The security properties' controls mount on first
opening and stay mounted through later collapses, and only a security
property's draft holds that disclosure open. The overlay skips renders its
canvas parent makes during a drag.

## The threat register

The register is mounted beside the panel in `../canvas/diagram-canvas.tsx`
and reads the coverage the pane reports, standing in the default panel width
while none is open, so it ends where the panel begins. It is a module store of
its own rather than a field of the model store, as the target chooser is: it
is per tab and never part of the file, the undo stacks or the recovery
snapshot. It is a region with a table rather than a dialog or a grid. Each row
is chosen through its title's button, whose box reaches over the title's
cell, and each element name is a button of its own, so every control is on
the Tab path and a screen reader reads the table by its column headers. The
reach and the chosen row's ring hang from the cells, since a table row is no
containing block in Safari 26.5 and earlier. The severity and status in a
cell drop the field name the summary speaks, which the column header already
gives.

The register draws over the selection cards, so the canvas holds them inert
while it is open, and a card a command opens closes the register first. In a
window too narrow for both, it covers the panel too, and hides every pane under
it. A close is committed (`flushSync`) before focus moves, since a control the
register covered takes no focus until the register has gone.

Details opens the model's metadata and closes the Register before focusing
the title. A chosen row reaches the focused editor through `openInModelPanel` in
`panel-focus.ts`. Where the model panel shows, its list opens the threat at
once. Where it does not, the request is left for the list to take as it
mounts, and the list opens on that threat. Either way the list calls back once
it has opened the threat, which is when the register marks the row and the
status says so. A list holding a refused draft on another threat refuses, as
it refuses a collapse.

A choice is committed (`flushSync`) and then asks the list what it did with
that threat where styles hide it (`hiddenInModelPanel`), which reads the
panel's computed visibility, so the width stays in the stylesheet alone. Under
the register's media query the list answers, and the register closes by its
own close. On an opened threat focus lands as it does on Escape, and the
choice is carried to the register's next opening, which marks that row. On a
refused one the commit that closes the register shows the Threats tab, focus
lands on the field holding the refused text, found by its `aria-invalid`
(`focusModelPanel('refusal')`), and nothing is carried. The threat holding a
draft is the expanded one and draws the field the draft is in, so that field
is there to land on. Where both panes show the list answers nothing, and a
refused choice opens and closes nothing. Any other close forgets the carried
choice.

The register keeps the order it opened in for the reason the list does, and
with the same `useShownOrder`. The table's columns follow the exported
Markdown register's overview, less the category, but share nothing with it:
that table is built in number order from render's own catalogue for a
generated document, and names elements by the export's rules. As in that
overview, a threat that applies to the model leads its elements with the whole
model, in the studio's own words and as text, there being no element to
select.

## Drawing a threat

The summary takes its flag wording from the studio's own catalogue, not from the
render package's report labels, which stay English for a generated register. Its
severity, status and category read from the catalogue too, so no stored value is
drawn as its own label. Its severity marker uses the canvas tone class. Each
status and each flag mark has a glyph shape of its own, so every mark stays
distinct in forced colours, where open also keeps its outline and weight. Beside
Status in an open threat a flag mark drops its outline, the only outlines there
being the fields' own, and keeps its weight. The whole summary is the accordion
control's accessible name, in drawn order, and it holds no control of its own.
Its values are drawn without their field names, which a screen reader still
hears ("Severity: High"), so the drawn label is hidden from assistive technology
and the named one is visually hidden. The model panel heads its assumptions
group with `terms.model-assumptions`.

A summary closes with what its threat is on. A threat that applies to the
model says so on a line of its own, on either list, and the elements line
follows it. On an element's panel that line names the threat's other elements
and is left out where there are none, since the panel's heading already names
the one shown. On the model's list, which shows no element, it names every
element the threat is on. An unlabelled flow reads as a noun phrase in this
line, while its labels elsewhere stay stand-alone. A threat on no element that does not apply to the
model either says it is on none there, so a threat on nothing reads as one.

The list sorts with `inReviewOrder` from `../ui/review-order.ts`, which also
orders the Status picker. Both are presentation: the model's status tuple keeps
its order.

## Record groups

A record has meaning on a threat, and an assumption also on the model, so
records get no panel, list or tab of their own. The threat editor and the
model panel's Details draw the same group, bound through a `RecordTarget` that
heads the group, says which records it shows, attaches a new record, links,
unlinks, and says where else a record is referenced.

Every group counts its records in its heading and starts every record folded to
a toggle and its status, on a threat and on the model alike. A folded record on
a threat counts the other threats holding it, and on the model, which is no
threat to be other than, names them by number as an open record does. A record
opened stays open while the group is mounted, which is until its threat
collapses or the model panel closes, and one whose field holds a refused draft
will not fold, since folding would unmount the draft. A new row that becomes a
record is marked Added until then, opens, and is announced by kind and number
(`canvas.mitigation-added`), so a kept record says so where the focused field
reads nothing new.

A group mounts its rows in the model's record order and holds that order while
it stays mounted. A record added or linked meanwhile, from this tab or
another, joins after the rows already shown, and a record that was shown
earlier in the same mount and returns takes its old slot back. The order is
the panel's alone: the model has no per-threat record order, and moving a
record in the model would move it for every other threat and in the file.

An unlink restores the body's scroll position before the frame paints, so the
rows below move up under the pointer. Browser scroll anchoring would otherwise
hold a row below the removed one in place. Anchoring stays on for every other
change, so a record arriving above the rows in view leaves them where they
are. A row that goes while it holds focus leaves focus in its group.

The empty row carries its status control and a Discard control in its name row
from the start, so nothing moves when it becomes a record and a click on Add or
Link existing lands where it was aimed. A pointer press on Discard keeps focus
in the text, so typed text is discarded rather than committed. Keyboard focus
leaving the text commits it before Discard can be reached.

Control names carry the kind and the row's position ("Mitigation 2 title",
"Unlink mitigation 2", "Link existing mitigation"), and positions renumber when
a row above is unlinked. A group's heading and the name an open row draws
already say what a control belongs to, so the drawn text is shorter and begins
the name or is contained in it: Add, Link, Unlink and Discard, and the Title
and Description placeholders of a record's fields, which draw no label. Link
stays on the Tab path while no record is chosen (`aria-disabled`, with a
description saying to choose one).

A record's fold toggle draws the headline, the record's title or the first line
of its text, while folded and the record's name while open. Its accessible name
is both in either state ("Mitigation 1, Rate limit logins",
`fields.record-toggle`), or the record's name alone where it has no headline,
so opening the record changes the toggle's expanded state and not what it is
called.

Each row is a group with no name, the empty row included. Its toggle, or the
empty row's fields ("Mitigation 2 title", "Assumption 2"), already carry the
record's name.

## Attachments

What a threat is on is edited from two places. The element's panel attaches a
threat the register already holds, offering the threats attached to no element
first and saying of each whether it applies to the model. The expanded threat
sets and clears its own model link, through the Yes and No control an
element's Out of scope uses, and attaches and detaches elements of its own.
Each change is the action of its own model operation: `AttachThreat`,
`DetachThreat`, `LinkThreatToModel` and `UnlinkThreatFromModel`, never a
`ReplaceThreat` carrying another list or flag, which is what a field commits.

The model culls a threat on the edit that takes its last reference, an element
or the model link. The list owns those dispatches because any of them can take
the threat off the list: a detach off the element whose panel it is, and a
detach or a cleared model link that takes the last reference off the model,
which leaves the group unmounted with nowhere to put focus. The focused editor
keeps a threat a detach leaves on another element, or on the model alone, and
the threat's summary follows. The group asks only for the next row when it
survives, and for its model link control where no row is left.

An edit that removes the threat says so in the shared status, as an unlinked
record does, and needs no confirmation because one undo brings the threat back
with everything the removal took. A detach the threat survives says what it
stays on: its other elements, or the whole model where it is on none. Setting
the model link, or clearing it on a threat that stays, says nothing, since the
control shows it.

A removal through the model link control moves focus at once, as a detach
does. The listbox ends an Enter press with the choice (`CappedList`), so the
threat that takes focus is not opened by it.

The model editor has an Add a threat of its own, which adds a threat that
applies to the model and names no element.

## The commit rule

One committed change is one store action carrying one model operation, so one
field is one undo step: `ReplaceThreat` for a threat's fields,
`SetModelMetadata` naming one field, `SetElementDetails` naming one of an
element's description, out-of-scope flag and reason, a record action for a
record. A listbox commits the value chosen. A text field commits what it holds
when it is left, and a title on Enter as well, rather than on every keystroke,
which would make an undo stack of single characters. A commit that changes
nothing dispatches nothing: a model operation can return a new model whatever
it was asked to do, so the store would push an undo entry and mark the file
dirty over an edit nobody made.

Text carrying a character the model's character set does not accept is not
committed at all, because the alternative is a model on screen that no codec
can write back to a file. The field says which character stopped it, under a
label that already says which field it is, and the panel announces the same
refusal with the field named, so a refusal that lands after focus has left is
not silent. The threat holding a refused draft stays expanded until the text is
corrected or cleared: Radix unmounts a collapsed item's fields, so a collapse
would take the draft with it, and the panel refuses the collapse rather than
the draft. Every request to open another threat is turned away while it does,
by one rule (`heldOnAnother` in `threat-list.tsx`): a summary press, Attach
existing, a threat register row, an undo or a redo that brings a threat back,
and Add a threat. Add a threat adds nothing and moves focus to the field
holding the refused text, in an element's list and in the model's, through the
focus move the register's close uses.

The refusal is the panel's only view state that another view can settle, so
it is dropped from both ends. The field reports every change to it, the text
included, which is what lets the draft be put back later, including the change
it makes on its own when the value under a draft moves, as an undo does. It
reports after the render rather than during it, since a parent cannot take a
report from a child that is still rendering. The panel also drops it whenever
nothing on screen holds it, which is what the threat leaving the element does.
Which field holds a refusal is kept in the item rather than the panel, so a
second field committing with no refusal does not report the first field's
draft away. It is state of the item's expanded content (`useRefusals`), which
unmounts with the fields, so no note of a refusal outlives the field that
showed it. A refusal in a new record row is noted under the row until a commit
keeps the record, and under the record from then on, so the correction that
follows settles it.

A commit always comes before a collapse: reaching the control that collapses
an item, by pointer or by Tab, takes focus out of the field, which is the
commit.

Opening a threat, by its summary, Add a threat or Attach, collapses the open
one and lands the opened threat's top at the top of the body, in the next
animation frame. The frame is the earliest point that works: Radix removes the
collapsed content in a layout effect of its own, after the panel's layout
effects have run. Collapsing a threat keeps its header where it was instead.
The open threat's header is sticky, reaching up through the body's padding,
since a sticky box stops at its scroller's padding edge, and the body's scroll
padding follows its height so the browser's own scrolling stops below it.

A Tab into the open threat scrolls the field it reaches clear of the pinned
header, with the next field in view below it where both fit (`fieldScroll` in
`threat-scroll.ts`). Only a Tab does: focus the panel moves itself, after an
add or an unlink, is left to the browser and to the record group, whose unlink
holds the scroll position.

## Saying what happened

An added threat opens expanded with focus in its title, and the focused field
reports it, so the studio adds no status message. An add turned away for a
refused draft adds none either: focus lands in the field holding the draft,
which reports the refusal. A deleted threat hands focus to the next threat,
the previous threat, or the add control. That focus does not report the
deletion, so the shared status does. A refusal uses the shared status too,
while its inline error stays beside the field. The next action that changes
canvas or panel state clears the status but not the inline error or its draft.
An unlink names the record by its title or first line, quoted and bounded as
the [canvas announcement](../canvas/README.md) quotes.

The panel sits after the canvas in the DOM, so Tab reaches it after every
element and flow. It is a region rather than a dialog: it takes no focus of its
own when it opens, traps none while it is open, and leaves every shortcut in
the studio live.
