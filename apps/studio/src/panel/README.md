# The studio's threat panel

The threats of whatever is selected, edited where they are read. The canvas
selects, the panel follows, and an edit leaves as a store action, so the
badges on the diagram and the panel are two views of one model with nothing
synchronizing them. The same location shows the model's own properties. What
a person can do with it is in
[Using the studio](../../../../docs/studio.md#the-threat-panel).

## Modules

| Module                                                  | What it holds                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `threat-overlay.tsx`                                    | The mount: which panel to draw, the drafts and pane width it retains across both, and the keyboard                          |
| `panel-frame.tsx`                                       | The pane either panel draws: width control, heading, close control, Escape, and the coverage it reports to the canvas       |
| `threat-panel.tsx`, `threat-editor.tsx`                 | The panel for a selection, and one expanded threat                                                                          |
| `kept-header.ts`                                        | Keeping a pressed threat header in view when the accordion swaps                                                            |
| `threat-summary.tsx`                                    | A collapsed threat's summary, which is also its accordion trigger's accessible name                                         |
| `threat-records.tsx`, `records.ts`                      | One record group, and what differs between the two record kinds and the two targets (`RecordTarget`: a threat or the model) |
| `threat-attachments.tsx`                                | The elements one threat names, with the controls that attach and detach them                                                |
| `pick-existing.tsx`                                     | The listbox and control that "Link existing" and "Attach existing" share                                                    |
| `model-properties.tsx`                                  | The panel for the model: title, description and the model's assumptions                                                     |
| `element-properties.tsx`, `element-property-fields.tsx` | The security properties editor and its field kinds                                                                          |
| `threats.ts`                                            | `panelSubject` and `attachedThreats`, the selectors the panel binds to, and what each picker offers                         |
| `refusals.ts`, `distinct-labels.ts`, `panel-focus.ts`   | Refused drafts, option labels a person can tell apart, and the focus channel                                                |

The panel is mounted from `../canvas/diagram-canvas.tsx`, inside the canvas
container, which is what makes it an overlay on the diagram rather than a
column taken off it. It is on the page only while something is selected or the
model's properties are shown, so the panel is the only place a threat is added
from. It is held clear of the zoom cluster rather than drawn over it, and
opening it resizes nothing: the fit commands use the coverage the pane reports
([the canvas](../canvas/README.md#the-view)). Its default width comes from
`panelCover` in the canvas tokens, projected as `--saer-panel-cover`.

## What it holds

The panel holds no copy of model state. `panelSubject` returns one element, a
count of several, the model while its properties are shown, or nothing, and
`attachedThreats` returns threats only for a single selection. A flow is an
element here because it carries threats. The panel's own state is which threat
is expanded, where focus is being sent, and the draft a field holds after a
refusal.

Focus is sent through `panel-focus.ts`, a channel of its own rather than a
field of the store, because focus belongs in neither the model nor its undo
stacks. Focus threats and undo and redo use it: an undo that takes away the
threat holding focus sends focus to "Add a threat", a redo there sends it back
to the restored title, and anywhere else focus stays where it is.

The pane claims the first Escape, closing and returning focus to the element,
so one press never also clears the selection. An open listbox inside the pane
is handling Escape itself, and the press is left to it. What is closed is the
element rather than the panel: it stays closed while it is the selection,
whatever is then moved, resized or undone on it.

Refused drafts are held per element in the overlay, which outlives the panel.
A draft goes when its text is settled, by a correction or an edit landing
under it, when the threat it named leaves the element, or when the file
changes. A model arriving with the same ids is a different sitting and starts
on what the model says. The file is identified by its name, the state carrying
nothing else that tells two sittings apart, so a save under another name starts
the drafts afresh as an open does. Security property drafts use the same
lifetime, and their controls mount on first opening and stay mounted through
later collapses. The overlay skips renders its canvas parent makes during a
drag.

## Drawing a threat

The summary takes its flag wording from the studio's own catalogue, not from
the render package's report labels, which stay English for a generated
register. Its severity and status read from the catalogue too, so no stored
value is drawn as its own label. Its severity marker uses the canvas tone
class. Each
flag mark has a glyph shape of its own, an outline and its label as text, all
in the text colour, so severity and every mark stay distinct in forced colours.
The whole summary, counts and marks included, is the accordion control's
accessible name, in drawn order, and it holds no control of its own. The
model's properties head their assumptions group with `terms.model-assumptions`.

## Record groups

A record has meaning on a threat, and an assumption also on the model, so
records get no panel, list or tab of their own. The threat editor and the
model's properties draw the same group, bound through a `RecordTarget` that
heads the group, says which records it shows, attaches a new record, links,
unlinks, and says where else a record is referenced.

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

The empty row carries its status control and a Discard control from the start,
so nothing moves when it becomes a record and a click on Add or Link existing
lands where it was aimed. A pointer press on Discard keeps focus in the text,
so typed text is discarded rather than committed. Keyboard focus leaving the
text commits it before Discard can be reached.

Control names carry the kind and the row's position ("Mitigation 2 title",
"Unlink mitigation 2", "Link existing mitigation"), and positions renumber when
a row above is unlinked. The card's group name already says which record a
control belongs to, so the drawn text is shorter and begins the name or is
contained in it: Title, Description, Add, Link, Unlink and Discard. Link stays
on the Tab path while no record is chosen (`aria-disabled`, with a description
saying to choose one).

## Attachments

Which elements a threat names is edited from two places. The element's panel
attaches a threat the register already holds, offering the threats attached to
no element first, since a file can be read with one and nothing else reaches
them. The expanded threat attaches and detaches elements of its own. Both go
through `AttachThreat` and `DetachThreat`, never through a `ReplaceThreat`
carrying a shorter list: the model culls a threat on the detach that takes its
last element, and a replacement naming no element does not.

The panel owns both dispatches because a detach can take the threat off the
element whose panel it is, which leaves the group unmounted with nowhere to
put focus. The group asks only for the next row when it survives. A detach
that removes the threat says so in the shared status, as an unlinked record
does, and needs no confirmation because one undo brings the threat back with
everything the removal took.

## The commit rule

One committed change is one store action carrying one model operation, so one
field is one undo step: `ReplaceThreat` for a threat's fields,
`SetModelMetadata` naming one field, a record action for a record. A listbox
commits the value chosen. A text field commits what it holds when it is left,
and a title on Enter as well, rather than on every keystroke, which would make
an undo stack of single characters. A commit that changes nothing dispatches
nothing: a model operation returns a new model whatever it was asked to do, so
the store would push an undo entry and mark the file dirty over an edit nobody
made.

Text carrying a character the model's character set does not accept is not
committed at all, because the alternative is a model on screen that no codec
can write back to a file. The field says which character stopped it, under a
label that already says which field it is, and the panel announces the same
refusal with the field named, so a refusal that lands after focus has left is
not silent. The threat holding a refused draft stays expanded until the text is
corrected or cleared: Radix unmounts a collapsed item's fields, so a collapse
would take the draft with it, and the panel refuses the collapse rather than
the draft.

The refusal is the panel's only view state that another view can settle, so
it is dropped from both ends. The field reports every change to it, the text
included, which is what lets the draft be put back later, including the change
it makes on its own when the value under a draft moves, as an undo does. It
reports after the render rather than during it, since a parent cannot take a
report from a child that is still rendering. The panel also drops it whenever
nothing on screen holds it, which is what the threat leaving the element does.
Which field holds a refusal is kept in the item rather than the panel, so a
second field committing with no refusal does not report the first field's
draft away.

A commit always comes before a collapse: reaching the control that collapses
an item, by pointer or by Tab, takes focus out of the field, which is the
commit.

Expanding a threat collapses the open one, and when that one sits above, the
body could no longer scroll as far and the header just pressed would land out
of view. `kept-header.ts` measures that header before the swap and scrolls the
body in the next animation frame so the header is back where it was, moved only
as far as it takes to show it whole, or to show its top where it is taller than
the body. The frame is the earliest point that works: Radix removes the
collapsed content in a layout effect of its own, after the panel's layout
effects have run. Browser scroll anchoring does not hold the header on its own,
since its anchor is often a row of the content that goes.

## Saying what happened

An added threat opens expanded with focus in its title, and the focused field
reports it, so the studio adds no status message. A deleted threat hands focus
to the next threat, the previous threat, or the add control. That focus does
not report the deletion, so the shared status does. A refusal uses the shared
status too, while its inline error stays beside the field. The next action
that changes canvas or panel state clears the status but not the inline error
or its draft. An unlink names the record by its title or first line, quoted
and bounded as the [canvas announcement](../canvas/README.md) quotes.

The panel sits after the canvas in the DOM, so Tab reaches it after every
element and flow. It is a region rather than a dialog: it takes no focus of its
own when it opens, traps none while it is open, and leaves every shortcut in
the studio live.
