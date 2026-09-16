# Using the studio

The studio is the drawing UI: the diagram is the editor, and the threats are
recorded on the elements they attach to. It runs in the browser and keeps no
server-side state. How it is built is in the READMEs under
[`apps/studio/src`](../apps/studio/src/canvas/README.md).

## The window

The canvas fills the window. One card centred at the top holds the menu
button, the diagram switcher joined to it, and the tool modes. The threat
panel floats over the right edge while something is selected, and the zoom
controls float at the bottom right. Notices hang under the card: a refused
edit or file, and what a save or an open could not keep. Each stands until you
dismiss it or the state it describes resolves. None is removed by a timer.

A status line under the card says what an edit did where the focus does not
already show it: a deletion, a refusal, an Undo or Redo. It ends at the next
action that changes the canvas or the panel.

**Appearance** in the menu selects System, Light or Dark, and the choice
persists across reloads. The Project group links to GitHub. A released build
shows its version above the React Flow attribution, and any other build says
`development`.

## Files

**Open** reads a Threat Dragon v2 JSON or Saerskriven YAML file, whatever its
extension. **Save** writes back in the format the file was read as. Where the
browser offers the File System Access API, Save writes to the file that was
opened. Elsewhere, Firefox and Safari among them, Save downloads the file, and
**Save as** turns into a list of formats in the menu, with the file's own
format where the item stood. Saving in another format than the file was read
as is where a loss report comes from, since only the file's own format keeps
what Saerskriven does not model. A read reports too, when the file carries keys
the format's schema does not declare.

**Open** and **New model** ask before replacing unsaved work: the item turns
into Discard changes and open, or Discard changes and create new model, and a
second press confirms. A failed open keeps the current model, but its next Save
downloads native YAML rather than writing to either file.

**Import** converts an OTM or TM-BOM file into an unsaved native model
([importing a foreign model](import.md)). **Export** writes the diagram on
screen as SVG or PNG, the register as Markdown, or the whole model as Typst or
PDF, with one SVG item per diagram when the model has several. An export
proposes the open file's name with the export's extension, or `Untitled`, and
never changes which file Save writes to. An export that could not place a flow
endpoint says so after it writes. A refused PDF or PNG export writes nothing
and stands until dismissed or until a later export.

The studio keeps the current session in the browser's local storage. A reload
restores the model, whether it was saved, the file's name and format, and the
diagram on screen, without the undo history, the selection or an open field.
The browser's file handle does not survive, so the next Save downloads a copy.
While unsaved work has not reached that storage, closing the tab asks first.

Every studio tab in one browser profile shows the same model. An edit, an
undo, an open or a save in one tab reaches the others, while each tab keeps its
own selection and diagram on screen. Once another tab has changed the model,
Save in this tab downloads a copy rather than writing back to the file.

## Diagrams

The switcher names the diagram on screen and lists every diagram of the model.
**New diagram** adds an empty one and opens its title for naming. **Rename
diagram** turns the name into a field: Enter or leaving it commits and Escape
cancels. **Next diagram** and **Previous diagram**, and PageDown and PageUp
while the model has more than one diagram, step through them.

## Placing elements

The card's second row holds Select, Actor, Process, Store, Trust boundary,
Trust boundary curve, Note and Hand. A tooltip names each tool's shortcuts.

- A click with an element tool places its default size under the pointer, and
  a drag draws the box between opposite corners. A process takes the shorter
  axis of the drag. A drag under four screen pixels places the default.
- Enter places the default at the centre of the view.
- A placed element arrives selected with a placeholder name ("New actor",
  "New flow"), and its name field opens where it fits. A Note opens its text.
- The tool returns to Select after one placement. Double-click a tool to lock
  it for repeated placement, and press Escape to unlock it and return to
  Select.
- A trust boundary curve takes one waypoint per click and finishes on Enter or
  a double click once it has two. Escape drops the draft.

Hand, or H, pans with the pointer, and holding Space pans for as long as it is
held.

## Selecting

A click selects one element or flow. Shift-click, or Shift+Enter on a focused
element, adds or removes it. Control+A or Command+A selects every element in
the diagram. A drag over empty canvas in Select draws a box that takes every
element and flow wholly inside it. The box stays inside the current view, so
pan first to reach elements outside it.

A click or tap on empty canvas clears the selection, and a pan keeps it.
Empty space inside a trust boundary counts as empty canvas: select a boundary
by its outline, its name or its controls.

## Moving, resizing and arranging

Drag any selected element to move the whole selection. An arrow key moves the
selection five model units, and Shift+arrow twenty. A flow does not move on its
own, but a moved group carries its bends and free ends along.

A selected element carries a line on each side and a handle at each corner.
Drag a side to change one axis or a corner to change both, with the opposite
side fixed. Focus a control and press an arrow key to move that edge five
units, or twenty with Shift. An element is at least ten units wide and high.

**Position and size** opens an editor for exact coordinates and dimensions,
and Apply commits the whole form as one edit. **Align** (left, centres, right,
top, middles, bottom) uses the outer bounds of the selected elements, and
**Distribute** keeps the first and last elements in place and evens the gaps.
Flows follow their attached ends, and bends and free ends stay put. **Snap to
grid**, off at first, snaps dragging to the visible grid. Keyboard moves and
typed coordinates are not snapped.

## Flows

A flow runs between actors, processes and stores. Hover an element to show its
connection handles, then drag from a handle to a handle on another element.
Releasing anywhere else draws nothing. A flow cannot start and end on one
element, and cannot attach to a trust boundary, a Note or another flow.

From the keyboard, select an element and run **Start a flow**: a list of
targets opens under the card. The arrow keys and typing choose, Enter draws the
flow, and Escape cancels.

Select one flow to edit its route:

- Drag any segment to make a bend, and drag a bend to move it. Click a bend
  for Remove bend or Move bend, which takes a destination click.
- **Add bend**, or `+`, highlights a segment. Left and Right choose the
  segment, Enter starts a bend at its midpoint, the arrow keys move it five
  units or twenty with Shift, and Enter commits. Escape cancels.
- A focused bend moves with the arrow keys, and Delete or Backspace removes it.
- An end handle sits where the flow meets its element. Drag it to another side
  to pin the end there, or click it for Follow the route, Top, Right, Bottom
  and Left. A focused end handle takes an arrow key as the side it points at,
  and Delete or Backspace returns it to following the route. A pinned side is
  saved, and a Threat Dragon file carries it as a port.

**Change flow source** and **Change flow target** choose another actor,
process or store for one end, with a side to pin it to or Automatic. **Toggle
bidirectional flow** draws an arrowhead at both ends or one again. The flow
keeps its source and target either way.

## Names and Note text

Double-click an element or flow, or press Enter or F2 with one selected, to edit
its name where the diagram draws it. Enter commits and Escape keeps the old
name, and leaving the field commits too. A name the model cannot hold stays in
the field with the refused character named under it, until you correct it or
press Escape. In a Note, Enter adds a line, and Control+Enter or Command+Enter
commits.

## Copy, cut, paste and duplicate

**Copy** takes the selected elements, the attached ends of selected flows,
flows between copied elements, the threats attached to them, and the
mitigations and assumptions those threats link. The copy goes to the system
clipboard as Saerskriven YAML. **Cut** removes the selection once the copy is
written, and removes nothing if the model or the selection changed meanwhile.
**Paste** and **Duplicate** add the copy with new ids and threat
numbers, offset by a grid interval each time. A pasted mitigation or assumption
identical to one the model already holds links the pasted threats to that
record, and every other record is added as a new one. A pasted assumption does
not apply to the model. The status line counts what was linked and added, and
the links left behind. Duplicate leaves the clipboard alone. Text fields keep
their own clipboard keys.

Paste reads the clipboard within the same size, depth and alias bounds as a
file, and anything that is not a Saerskriven selection makes no edit. A
selection copied by a release whose assumptions still linked elements is
refused. Fields of the source file that the model does not hold, such as a
Threat Dragon file's extra keys, are not copied, and the status line says so.

## Deleting and undoing

Delete or Backspace removes the selection from anywhere in the studio outside a
text field. A flow attached to a removed element loses that end and keeps the
other, and a threat keeps its record and loses the link.

Every edit is one undo step: a placement, a drag, a resize, a committed field,
a paste. Undo is Command+Z on macOS and Control+Z elsewhere. Redo is
Shift+Command+Z on macOS, and Control+Shift+Z or Control+Y elsewhere. Selecting,
panning, zooming and switching diagrams add no undo step and leave the file
unmodified.

## The view

Opening a model, or switching to another diagram, fits the diagram to the
window. **Fit to view** and **Fit
selection** fit the area left of the open threat panel. The zoom controls show
the current percentage, and pressing it resets the zoom to 100%. Selecting or
dropping an element does not move the view.

Scrolling pans in both directions and a trackpad pinch zooms. A touch drag pans
in Select. A mouse drag in Select draws a selection box, while a middle-button
drag, Hand or held Space pans.

## The threat panel

The panel shows the threats of the one selected element or flow. With several
selected it says how many and offers no fields. **Focus threats**, or T, moves
focus to "Add a threat". **Widen pane** widens it and **Restore pane width**
returns it to normal, for the rest of the session. The panel covers the
diagram rather than shrinking it, so pan to reach what it covers.

Close threats, or Escape, closes the panel and returns focus to the element,
which stays selected. A second Escape clears the selection. The panel stays
closed for that element until the selection moves or Focus threats runs again.

Each threat's summary shows its number, title, severity, status, how many
mitigations and assumptions it links, and a mark for each flag it raises.
Expand one threat at a time to edit it. A field commits when you leave it, and
the title also on Enter. Text the model cannot hold stays in the field with the
refused character named, and the threat stays expanded until you correct or
clear it. That draft survives closing the panel and selecting something else,
until the file changes. Deleting a threat removes it from the model, and so
from every element it names, which the item says beside its delete control.

### Mitigations and assumptions

An expanded threat holds a Mitigations group and an Assumptions group.

- **Add** opens an empty row. The record is created when a field in the row
  commits, starting `proposed` for a mitigation or `unconfirmed` for an
  assumption. Leaving a row with every field empty, or Discard, drops it.
- **Link existing** lists the records of that kind not on this threat. Choose
  one, then Link.
- A row edits the record's text and status in place. A record on other threats
  says which ("Also on threats 4 and 25"), and an assumption that applies to
  the model says so.
- **Unlink** takes the record off this threat. Unlinking a record from its last
  reference removes it, and Undo brings it back.

A new or returning row joins the end of the group while the group is open, so
the rows you are reading keep their place.

### Model properties

**Model properties**, in the menu or on M, shows the model's Title,
Description, and the assumptions that apply to the whole model, in the panel's
place, with focus in Title. It clears the selection, and whether it is shown
belongs to each tab. Selecting anything brings the threat panel
back. Escape, Close model properties, or M again closes it.

### Security properties

Select one actor, process, store, flow or trust boundary and expand **Security
properties** above its threats. **Not recorded** leaves a fact unknown, and a
flag offers Yes and No. Protocol and privilege level distinguish an empty
recorded value from Not recorded. Relationship lists (the boundaries a flow
crosses, a boundary's contained elements and crossing flows) offer valid
targets in the same diagram, keep their order and any repeated entry until you
edit them, and Not recorded removes the list itself. The
fields' meaning is in [the format](saerskriven-yaml.md#security-facts).

## Keyboard

**Keyboard shortcuts**, in the Help menu, or ? or F1 outside a text field,
opens the reference of every command and contextual key. Every edit has a
keyboard path, and every command in the menu names its chord.

A text field keeps the keys typed into it, T, M, Escape and Backspace among
them. Save, Save as, Undo and Redo still work from inside one.

Tab reaches the card, then the diagram's flows and elements, then the panel.
Enter on a focused element selects it, and a second Enter edits its name.

## Accessibility

Every element and flow is a tab stop whose accessible name comes from the
model: its name, its kind, what its badge says, and each flag its threats
raise. A flow also names the elements it runs between. Selection is a dashed
frame and a heavier line, and focus is a separate ring, so neither depends on
colour and both survive forced colours. A badge carries its open count over a
severity letter, and a flag is a triangle marked `!`.

React Flow gives the canvas `role="application"`, which turns off a screen
reader's browse mode there: Tab reaches every element, but the reader's own
navigation keys do not.

## Current limitations

- Removing and reordering diagrams is not offered.
- Nothing pans to a newly connected flow, or out from under the panel.
- Tab order puts every flow before every element.
- Records have no list of their own: a mitigation is reached through its
  threats, and an assumption through its threats or the model properties. The
  model's explicit record removal has no control.
- Link existing has no search or filter, and the threat list has no filter,
  sort or search.
- A threat's attached elements are read-only in the panel, and its id and
  number cannot be edited.
- A custom methodology cannot be created in the studio. A threat that arrived
  with one shows it and can be moved to a listed category.
- The model's owner and contributors are not edited in the studio.
- Markdown in a description is edited as source, with no preview.
- An element under the panel cannot be clicked. The keyboard still reaches it.
