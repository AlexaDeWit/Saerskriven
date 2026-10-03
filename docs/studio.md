# Using the studio

The studio is the drawing UI: the diagram is the editor, and the threats are
recorded on the elements they attach to. It runs in the browser and keeps no
server-side state. How it is built is in the READMEs under
[`apps/studio/src`](../apps/studio/src/canvas/README.md).

## The window

The canvas fills the window. One card centred at the top holds the menu
button, the diagram switcher joined to it, and the tool modes. The threat panel
floats over the right edge while something is selected, and the zoom controls
float at the bottom right. Notices hang under the card: a refused edit, file or
link, what a save or an open could not keep, and the link Share copied. Each
stands until you dismiss it or the state it describes resolves. None is removed
by a timer.

A status line under the card says what an action did wherever the control
that has focus does not already show it, such as a deletion, a refusal, a
paste or an Undo. It ends at the next action that changes the canvas or the
panel. A diagram chosen in the switcher draws no line, since focus returns to
the switcher, which names it. PageDown and PageUp do draw it.

**Appearance** in the menu selects System, Light or Dark, and the choice
persists across reloads. **Language** beside it selects English (Canada),
Français (Canada) or Svenska, and persists the same way. Until you choose
one, the studio starts in the first of those your browser asks for, or in
English (Canada) where it asks for none of them. The language decides
the studio's own words: the menus, the toolbox, the panel, every field label
and the words a stored value is shown under, such as a severity, a status or
a threat category. A model's names and descriptions are yours and are never
translated, and the file picker, the download dialog and the unsaved changes
question are the browser's own text. Key names in a shortcut, such as
`Ctrl+Shift+S`, and each language's own name in the Language list read the
same in every language.

A name the studio writes for you is written in the language you are in at the
time: Untitled, Untitled diagram, New actor, New flow, New threat and the
rest. It is part of the model from then on, so changing language later renames
nothing. The page before the app script runs, which is the loading line and
the message for a browser with JavaScript turned off, is fixed English,
because no language has been negotiated yet.

The Project group links to GitHub. A released build shows its version above
the React Flow attribution, and any other build says `development`.

## Files

**Open** reads a Saerskriven YAML, Threat Dragon v2 JSON, OTM or TM-BOM file,
whatever its extension. What Save does next depends on the format:

- Saerskriven YAML and Threat Dragon: **Save** writes back to the file in the
  format it was read as, unless the save picker is used to choose another.
- OTM and TM-BOM: Saerskriven reads these and does not write them, so the file
  opens as a new, unsaved model under a notice saying so, and no Save ever
  writes to it. Save makes a Saerskriven YAML file under the file's stem, as
  `example.yaml` for `example.json`: the save picker proposes that name, and a
  browser without one downloads under it. What each format becomes is in
  [OTM and TM-BOM](#otm-and-tm-bom).

Where the browser offers the File System Access API, Save writes to the file
that was opened or last saved as, without asking. With no such file, as for a
new model or an OTM or TM-BOM file, Save asks where in the browser's save
picker, proposing the same name and formats as **Save as**, and later Saves
write to the file chosen there.
Dismissing the picker, from Save or Save as, leaves the work unsaved in every
tab. Elsewhere, Firefox and Safari among them, Save downloads the file under its
name, and **Save as** turns into a list of formats in the menu, with the file's
own format where the item stood. The page cannot tell whether a download went
through, so a download counts as saved even where the browser's own download
dialog was cancelled. Saving in another format than the file was read as is
where most of a save's report, **Not kept by this save**, comes from, since
only the file's own format keeps what Saerskriven does not model. Opening a
file reports too, under **Not shown in the studio**: keys the format's schema
does not declare, and values the studio holds less exactly than the file,
such as a Threat Dragon Elevation of Privilege card, with "Saving back keeps
it." where a save to the same file keeps them. Each line names a threat by its
number and title, and anything else by the name the studio shows, and lines
that read the same are shown once with their count. A report leaves out what
loses nothing, such as a raised threat number mark, which the command line
still prints. An OTM or TM-BOM report names what the reading converted and
the source fields that hold a value the model has no place for. It leaves out
a default or a layout Saerskriven supplied where the file held none, which
`saer convert` and the MCP server still name. Nothing of that file is kept for
a later save, so keep it where what the report names matters.

**Open** and **New model** ask before replacing unsaved work: the item turns
into Discard changes and open, or Discard changes and create new model, and a
second press confirms. A failed open keeps the current model but lets go of its
file, so its next Save treats it as a new model rather than writing to either
file.

**Export** writes the diagram on screen as SVG or PNG, the register as
Markdown, or the whole model as Typst or PDF. An export proposes the open
file's name with the export's extension, or `Untitled`, and never changes
which file Save writes to. When the model has several diagrams, the SVG and
PNG names add the diagram's title, as `payments - Checkout.svg`: characters a
file name cannot hold become `_`, runs of white space collapse, leading and
trailing dots and spaces go, the title is cut to 80 characters, and an empty
one reads as the untitled diagram. Diagrams with the same title propose the
same name. An export that could not place a flow endpoint says so after it
writes. A refused PDF or PNG export writes nothing and stands until dismissed
or until a later export.

**Share as link** copies to the clipboard a link holding the whole model, for a
chat, a ticket or an email, and reports how long the link is. Anyone who holds
the link can read the whole model, and nothing can take it back, since the
model is in the link itself. The model travels after the link's `#`, which the
browser never sends to a server, so it stays out of server logs and `Referer`
headers. It still lands in browser history, in browser sync and in every chat
log the link passes through. A link holds at most 1,048,576 characters, the
most Firefox opens, and a model whose link would be longer is refused with a
pointer to Save, so it can be shared as a file instead. The report stands until
dismissed or until a later Share.

Opening a link, in a new tab or pasted into the address bar of an open one,
loads the model it holds as an unsaved model named after its title. Over
unsaved work, the menu opens with Share as link turned into Discard changes and
open the link, focused, and Cancel under it, as Open asks. A session whose
stored recovery snapshot could not be read counts as unsaved work until the
studio next writes one, since loading the link would replace it. Either answer,
or closing the menu, takes the link out of the address, so a reload neither
asks again nor loads it over later edits. A link that was cut off, is too long,
holds no model, or was written by a later release opens nothing, and the notice
says which.

The studio keeps the current session in the browser's local storage. A reload
restores the model, whether it was saved, the file's name and format, and the
diagram on screen, without the undo history, the selection or an open field.
The browser's file handle does not survive, so the next Save asks where to
write, or downloads a copy where the browser cannot ask.
While unsaved work has not reached that storage, closing the tab asks first.

Every studio tab in one browser profile shows the same model. An edit, an undo,
an open or a save in one tab reaches the others, while each tab keeps its own
selection and diagram on screen. Once another tab has changed the model, Save
in this tab asks where to write, or downloads a copy, rather than writing back
to the file.

### OTM and TM-BOM

Open reads an OTM or TM-BOM file into a new native model, and so do
`saer convert` ([usage](../README.md#usage)) and the MCP server's
`saer_import` ([the MCP server](mcp.md)). Content decides the format, in JSON
or YAML syntax alike, and the reading passes the same size, depth and alias
bounds as any other file. Ids Saerskriven generates use an ASCII alphabet the
canvas can address.

#### OTM 0.2.0

Open reads a file stamped `otmVersion: 0.2.0`. All components become process
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
remain in the description and are read as open. Each mitigation an occurrence
names becomes a record linked to that occurrence's threat. Mitigations marked
implemented or verified retain that status. Other mitigation states are read
as proposed, with the source state kept in prose and differences reported. A
mitigation definition no occurrence names would link no threat, so it becomes
a line of the model description holding its name and description, with a
report line.

Threat severity remains undecided. OTM numeric risk values and category
lists have no exact core equivalent and appear in the omission report.
Threats receive an unspecified custom category. Numeric mitigation
reductions, asset risk assessments, tags, and extension attributes are also
reported as omissions.

#### TM-BOM 1.0.1 and 1.0.2

A TM-BOM file needs a `$schema` URI naming either supported release of the
OWASP Threat Model Library schema. The model's own `version` is not a schema
version. Later schema versions are refused.

Actors, components, data stores, and flows become their corresponding DFD
kinds. Saerskriven generates a diagram grouped by declared trust-zone
membership. Boxes show those zones, but membership is only drawn. Embedded
Graphviz, Mermaid, PlantUML, and SVG sources are reported as omissions.
Saerskriven does not execute or interpret them.

Flow encryption and sensitivity values remain in the flow descriptions.
Data-set names and descriptions appear on the stores named by their
placements. TM-BOM has no direct data-set reference on a flow, so none is
inferred. Shared data identity and other data-set properties are reported as
losses.

Threats preserve their declared component attachments and event descriptions.
They are read as open, with undecided severity and an unspecified category.
Separate risk records and threat personas are reported as omissions.
Controls become mitigations linked to the threats they name. Active controls
become implemented mitigations. Suggested controls become proposed
mitigations. Other pending states remain in prose and are read as proposed.
A control naming no threat would link no threat, so it becomes a line of the
model description holding its title, its description and its mapped status,
with a report line. Retired and declined controls are reported as omissions
whether or not they name a threat.

TM-BOM assumptions name no threat, so every assumption becomes an assumption
that applies to the model, with its description as prose. Confirmed, rejected
and unconfirmed assumptions map to the valid, invalidated and unconfirmed
states. Topic links are reported as omissions.

## Diagrams

The switcher names the diagram on screen and lists every diagram of the model.
**New diagram** adds an empty one and opens its title for naming. **Rename
diagram** turns the name into a field: Enter or leaving it commits and Escape
cancels. PageDown and PageUp step to the next and previous diagram while the
model has more than one.

## Placing elements

The card's second row holds Select, Actor, Process, Store, Trust boundary,
Trust boundary curve, Note and Hand. A tooltip names each tool's shortcuts.

- A click with an element tool places its default size under the pointer, and
  a drag draws the box between opposite corners. A drag under four screen
  pixels places the default.
- A process draws an ellipse filling its box, a circle when the box is square.
  Its name wraps to the width of the rectangle inside the ellipse, so a wider
  process takes more of its name on each line.
- Enter places the default at the centre of the view.
- A placed element arrives selected with a placeholder name ("New actor", "New
  flow"), and its name field opens where it fits. A Note opens its text.
- The tool returns to Select after one placement. Double-click a tool to lock
  it for repeated placement, and press Escape to unlock it and return to
  Select.
- A trust boundary curve takes one waypoint per click and finishes on Enter or
  a double click once it has two. Escape drops the draft. Freehand drawing is
  not offered.

Hand, or H, pans with the pointer, and holding Space pans for as long as it is
held.

## Selecting

A click selects one element or flow. Shift-click, or Shift+Enter on a focused
element, adds or removes it. Select all selects every element and flow the
diagram draws. A drag in Select that starts on empty canvas draws a box that
takes every element and flow wholly inside it, unless it starts inside the
bounds of a selection that holds an element, which moves the selection instead.
The box stays inside the current view, so pan first to reach elements outside
it. A flow whose end names something the canvas cannot draw it to is not drawn,
so neither Select all nor a box selects it.

A click or tap on empty canvas clears the selection, and a pan keeps it. Select
a trust boundary by its outline, its name or its controls: the space inside a
boundary that is not selected is empty canvas.

## Moving, resizing and arranging

Drag any selected element to move the whole selection. Where the selection
holds an element, a drag that starts anywhere else inside the bounds of the
selection, a few pixels around them included, moves the selection too: on empty
canvas, inside a selected trust boundary, or on an element the selection leaves
out. A click there without a drag clears the selection, or selects that element
alone. With Shift held, or by touch, a press there acts as it does outside the
selection. An arrow key moves the selection five model units, and Shift+arrow
twenty, or one grid interval and four with Snap to grid on, snapped as a drag
is. A flow does not move on its own, but a moved group carries its bends
and free ends along. After each arrow key a screen reader hears where Position
and size now places the selection, in the figures it shows. Pressing Escape,
or leaving the browser window, before the release puts every dragged element
back where it was, with no undo step. Escape also clears the selection, as it
does anywhere.

A selected element carries a line on each side and a handle at each corner.
Drag a side to change one axis or a corner to change both, with the opposite
side fixed. Focus a control and press an arrow key to move that edge five
units, or twenty with Shift. An element is at least ten units wide and high. On
a trust boundary curve the same controls scale its points
([Trust boundaries](#trust-boundaries)).

While an element with a threat badge is selected, the badge steps out past its
top-right corner, so the handle there stays on the corner, and it draws above
neighbouring elements and flow names. The bounds a drag starts in and **Fit
selection** fits include it there. Deselected, the badge sits back on the
corner, and an export always draws it there.

Position and size opens an editor for exact coordinates and dimensions, and
Apply commits the whole form as one edit. Cancel or Escape leaves the model
alone. **Align** (left, centres, right, top, middles, bottom) uses the outer
bounds of the selected elements, and **Distribute** keeps the first and last
elements in place and evens the gaps. Flows follow their attached ends, and
bends and free ends stay put. **Snap to grid**, off at first, snaps dragging
and arrow-key moves to the visible grid. Typed coordinates are not snapped.

## Flows

A flow runs between actors, processes and stores. Hover an element to show its
connection handles, then drag from a handle to a handle on another element.
Releasing anywhere else draws nothing. The flow keeps the sides of the two
handles it was drawn between, so moving either element leaves it on them. A
flow cannot start and end on one element, and cannot attach to a trust
boundary, a Note or another flow.

From the keyboard, select an element and run Start a flow: a list of targets
opens under the card. The arrow keys and typing choose, Enter draws the
flow, and Escape cancels. A flow started this way follows the route at both
ends.

Select one flow to edit its route. While one flow is selected with the Select
tool and no name or note is open for editing, the **Flow route** toolbar at the
bottom centre of the canvas holds Add bend and says what the current gesture
expects.

- Drag any segment to make a bend, and drag a bend to move it. Click a bend for
  Remove bend or Move bend, which takes a destination click.
- **Add bend** highlights a segment. Left and Right choose the segment, Enter
  starts a bend at its midpoint, the arrow keys move it five units or twenty
  with Shift, and Enter commits. Escape, Tab or leaving the browser window
  cancels it without an edit.
- A focused bend moves with the arrow keys, and Delete or Backspace removes it.
- An end handle sits where the flow meets its element. Drag it to another side
  of that element to pin the end there, onto another actor, process or store
  to attach the end there, following the route, or onto empty canvas to free
  the end where it is dropped. Dropped on the element the other end holds, or
  on a Note, it changes nothing. Click it for Follow the route, Top, Right,
  Bottom and Left. A focused end handle takes an arrow key as the side it
  points at, and Delete or Backspace returns it to following the route. A
  pinned side is saved, and a Threat Dragon file carries it as a port.
- A free end has a handle too. Drag it, or focus it and press an arrow key to
  move it five units or twenty with Shift, and drop it on an actor, process or
  store to attach it there. Delete or Backspace on it leaves the end where it
  is and says so: select the flow itself to delete it.

While one flow is selected with the Select tool and no name or note is open for
editing, the **Reconnect flow** card pinned at the top left, under the chrome
card, holds one row of icons: **Change flow source** (a dot at the start of an
arrow), **Change flow target** (an arrow ending on a dot), **Toggle
bidirectional flow** (a two-headed arrow, drawn pressed while the flow runs
both ways) and **Reverse flow** (two opposed arrows). A tooltip names each
command and its shortcut, as in the toolbox. The first two choose another actor,
process or store for one end, with a side to pin it to or Automatic, or Free
point, first in the list, which frees the end at the X and Y typed, starting
from where the end is drawn. Toggle bidirectional flow draws an arrowhead at both ends or one again,
and the flow keeps its source and target either way. Reverse flow swaps the
source and the target and runs the bends the other way, so the flow keeps its
route, its threats and whether it runs both ways. Escape on a focused icon
closes its tooltip first, and a second Escape clears the selection.

## Trust boundaries

While one trust boundary is selected with the Select tool and no name is open
for editing, the **Trust boundary** card, in the Reconnect flow card's place,
holds **Switch boundary shape**, an icon of the two Trust boundary tools' shapes,
the box over the curve, with its name and shortcut in a tooltip. It turns a box
into the arch the Trust boundary curve tool draws in that box, and a curve into
the box around its points, at least ten units each way. A box at least ten
units each way, turned into a curve and back, is the same box.
The boundary keeps its name, its threats and the elements and flows it declares.

A selected trust boundary curve carries a handle on each of its points, and a
smaller midpoint handle halfway along the curve between each point and the
next, wherever that stretch is drawn at least twice as long as a point handle.
Drag a point, or focus it and press an arrow key to move it five units or
twenty with Shift. Drag a midpoint handle to pull a new point out of the curve
there. A press anywhere else on the curve's line moves the whole boundary.
Escape drops either drag before its release, and each edit is one undo step.
The handles stand aside while the curve itself is moved or scaled, and the
midpoint handles while a point is dragged.

Click a point for Remove point and Add point, or press Delete or Backspace with
the point focused to remove it. A curve keeps at least two points. Add point
puts a new point halfway along the curve to the next point, or from the last
point, halfway back to the one before it, and focuses the new point so the
arrow keys move it. For a midpoint handle and Add point alike, halfway is
measured along the curve's length and the new point lies on the curve, so the
curve stays close to its shape.

A selected curve also carries a box's side lines and corner handles around its
points, each corner handle just outside its corner so that a point there keeps
its own handle, and so that its threat badge, unlike an element's, stays on the
corner while the curve is selected. Dragging a control, or pressing an arrow key
on a focused one, scales every point against the opposite side or corner as one
undo step, and the boundary keeps its name and its threats. Width and height in
Position and size scale the points the same way, to no less than ten units. A
curve whose points all lie on one horizontal or vertical line has only the two
side lines that lengthen it, and the form shows only the width or the height
that does.

## Names and Note text

Double-click an element or flow, or press Enter or F2 with one selected, to edit
its name where the diagram draws it. A double click edits and does not zoom,
and a quick one still edits where its first click opens the threat panel over
the element. Enter commits and Escape keeps the old name, and leaving the field
commits too. A name the model cannot hold stays in the field with the refused
character named under it, until you correct it or press Escape. In a Note,
Enter adds a line, and Command+Enter on macOS or Control+Enter elsewhere
commits.

A flow may be left unlabelled: clear its name, or leave only spaces, and commit.
The diagram and its exports draw no label for it, and the threat panel's lists
and notices name it from its ends instead, such as "Flow from Shopper to Web
shop", "Flow between Shopper and Web shop" for a flow that runs both ways, or
"a free point" for an end attached to nothing. Every other element keeps a
name, and its field refuses an empty one.

## Copy, cut, paste and duplicate

Copy takes the selected elements, the attached ends of selected flows, flows
between copied elements, the threats attached to them, and the mitigations and
assumptions those threats link. The copy goes to the system clipboard as
Saerskriven YAML. Cut removes the selection once the copy is written, and
removes nothing if the model or the selection changed meanwhile. A threat the
cut leaves attached to no element goes with it, and the notice counts the
threats copied and how many of them went. Paste and Duplicate add the copy with
new ids, offset by a grid interval each time. A pasted threat keeps its number
when no threat in the model holds it, so pasting after a cut restores a removed
threat under its own number. Otherwise it takes a new number, as a copy or a
duplicate does while its original stays. A pasted mitigation or assumption
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
form field (a text box or a drop-down list). A flow attached to a removed
element loses that end and keeps the other, and a threat loses the link. A
threat the deletion leaves attached to no element goes with it, together with
the mitigations and assumptions left on no threat. The notice counts the flows
detached, the links dropped from the threats that stay, and the threats
removed, so a threat that goes is reported once. One Delete stays one undo
step, whatever it took.

Every edit is one undo step: a placement, a drag, a resize, a committed field,
a paste. Selecting, panning, zooming and switching diagrams add no undo step
and leave the file unmodified.

## The view

Opening a model, or switching to another diagram, fits the diagram to the
window. **Fit to view** and **Fit selection** fit the area left of the open
threat panel. The zoom controls show the current percentage, and pressing it
resets the zoom to 100%. Selecting or dropping an element does not move the
view.

Scrolling pans in both directions and a trackpad pinch zooms. Holding Control
(or Command on macOS) turns scrolling into zoom. A touch drag pans in Select. A
mouse drag in Select draws a selection box, or moves the selection where it
starts inside the bounds of a selection that holds an element, while a
middle-button drag, Hand or held Space pans.

## The threat panel

The panel shows the one selected element or flow, headed by its name, on two
tabs: **Threats**, which carries the element's threat count, and **Details**,
which holds its description, scope and security properties. Every selection
opens on Threats, and the arrow keys move between the tabs. With several
selected the panel says how many and offers no fields. Focus threats shows the
Threats tab and moves focus to "Add a threat". Selecting alone never moves focus
into the panel. **Widen pane** widens it and **Restore pane width** returns it
to normal, for the rest of the session. The panel covers the diagram rather than
shrinking it, so pan to reach what it covers.

Close threats, or Escape, closes the panel and returns focus to the element,
which stays selected. A second Escape clears the selection. The panel stays
closed for that element until the selection moves or Focus threats runs again.

**Attach existing threat** sits beside Add a threat and lists every threat in
the register that this element does not already name, the ones attached to no
element first. Choose one, then Attach. The threat opens expanded unless
another threat is holding a refused draft, which keeps the open one where it
is, and an undo takes the attachment back.

Each threat's summary is two lines: its number and title, then its severity, its
status with a glyph of its own, its category, and a mark for each flag it
raises. Open is the one status drawn as a filled pill. A third line names the
other elements the threat is on, where there are any. Threats are listed by how
much risk is still live: open, accepted risk, transferred, mitigated, avoided,
eliminated, then not applicable, each status from critical down to undecided and
equal threats by number. The order is set when the panel opens or the selection
moves, and holds while the panel stays open, so a threat whose status changes
keeps its place and a new one joins the end. The Status picker lists the
statuses in the same order.

Expand one threat at a time to edit it. Opening a threat scrolls it to the top
of the panel, and its summary stays pinned there while any of the threat is in
view. Tab keeps the field it reaches below the summary, with the next field in
view under it. The fields run Title, Category, Description, the mitigations and
assumptions, then Severity and Status side by side with any raised flag beside
Status, then the attached elements and Delete. A field commits when you leave
it, and the title also on Enter. A description starts at two lines and grows
with its text, so the panel is the one thing that scrolls. Text the model
cannot hold stays in the field with the refused character named, and the threat
stays expanded until you correct or clear it. That draft survives closing the
panel and selecting something else, until the file changes. Deleting a threat
removes it from the model, and so from every element it names, which the item
says beside its delete control.

### Attached elements

An expanded threat lists the elements it names, across every diagram, as one
row of names each with its own Detach control, and an **Attach existing
element** picker under them that offers the elements it does not name. Attach
and Detach are one undo step each.

Detaching the last element removes the threat, with the mitigations and
assumptions left on no threat, and the notice says so. There is no
confirmation: Undo brings the threat back with everything the removal took, as
unlinking a record's last threat does. Detaching the element whose panel you
are reading takes the threat off that panel, so focus moves to the threat that
takes its place, or to Add a threat.

### Mitigations and assumptions

An expanded threat holds a Mitigations group and an Assumptions group, each
headed by how many records it holds. Nothing done to a record changes a
threat's status.

- Every record starts folded to one row: its title, or the start of its text
  where it has none, and its status, which you can change there. A record on
  other threats adds a line saying how many ("Also on 3 other threats"), and
  an assumption that applies to the model says so.
- Activating the row opens the record in place: its status and Unlink in its
  name row, the threats it is also on by number ("Also on threats 4 and 25"),
  then its title and text, which show no label of their own. The same control
  folds it again. An opened record stays open until its threat closes, and a
  field holding refused text keeps it open.
- **Add** opens an empty row with focus in its first field. The record is
  created when a field in the row commits, Enter in a mitigation's title or
  leaving a field that holds text, starting `proposed` for a mitigation or
  `unconfirmed` for an assumption. It is then marked **Added** until its threat
  closes, its Discard becomes Unlink, the group's count goes up, and a screen
  reader hears it was added. Leaving a row with every field empty, or Discard,
  drops it. From the keyboard, Tab out of typed text commits it, so clear the
  text to discard it.
- **Link existing** lists the records of that kind not on this threat. Choose
  one, then Link, and the record joins folded.
- **Unlink** takes the record off this threat. A record left with no threat,
  and for an assumption no model link either, is removed, and Undo brings it
  back.

A new or returning row joins the end of the group while the group is open, so
the rows you are reading keep their place.

### The model panel

**Model**, in the menu or M, shows the model panel in the threat panel's place,
headed by the model's title, on two tabs: **Threats**, which carries the
model's threat count, and **Details**. It opens on Threats with focus on that
tab, and clears the selection. Whether it is shown belongs to each browser tab.
Selecting anything brings the threat panel back. Escape, Close model panel, or
running the command again closes it and moves focus to the canvas.

Threats lists every threat in the model, a threat on no element included, in
the order above and with the same summaries. Each summary adds a line naming
the elements the threat is on, or "On no element". A threat opens and is
edited as on an element's panel. There is no Add a threat or Attach existing
threat here, so add a threat on an element. A detach that leaves the threat on
another element keeps it in the list, and detaching its last element removes
it, as on an element's panel. Focus then moves to the threat that takes its
place, or to the Threats tab.

Details holds the model's Title and Description, then the assumptions that
apply to the whole model. The assumptions group works as a threat's does, bound
to the model, and a folded assumption names the threats it is also on by
number. Add creates an assumption that applies to the model and links no
threat. Link existing lists the assumptions that do not yet apply to the model.
Unlink stops an assumption applying to the model, and removes it only where it
links no threat.

### Description and scope

The **Details** tab holds the selected element's **Description**, **Out of
scope** and **Reason out of scope**, above its security properties, for every
element and flow, a Note included. Each field commits when you leave it, as one
undo step. Out of scope offers Yes and No. The reason shows while Out of scope
is Yes or while the element holds a reason, and the two are independent:
clearing Out of scope keeps the reason. Text the model cannot hold stays in the
field with the refused character named, as in a threat's fields, until you
correct or clear it, and survives closing the panel and selecting something
else.

On the canvas and in exported drawings, an element out of scope has its
outline dashed and drawn in the muted ink. A flow out of scope has its line
dashed and drawn in the muted ink, and its arrowhead filled with it. Names and
badges are drawn as they are in scope. The dash is not a colour, so it survives
forced colours. A Note, which has no outline, is not marked, and a trust
boundary, already dashed, is marked by a shorter dash alone.

### Security properties

Select one actor, process, store, flow or trust boundary, show its Details tab,
and expand **Security properties**. **Not recorded** leaves a fact unknown, and
a flag offers Yes and No. Protocol and privilege level distinguish an empty
recorded value from Not recorded. Relationship lists (the boundaries a flow
crosses, a boundary's contained elements and crossing flows) offer valid targets
in the same diagram, keep their order and any repeated entry until you edit
them, and Not recorded removes the list itself. The fields' meaning is in
[the format](saerskriven-yaml.md#security-facts).

## The threat register

**Threat register**, in the View menu or R outside a form field, opens a table
of every threat in the model over the canvas, left of the panel, with focus on
its first row. It has the panel's top and height, and keeps room for the
panel while none is open, so the panel opens beside it. Where the window
leaves too little room beside the panel, as on a phone, the register takes
the window's width and hides the panel under it until it closes, and the
table scrolls sideways inside it. R while the register is open moves focus
back into it, to the row last chosen.

Each row gives a threat's number, title, elements, severity and status. The
rows are in the threat list's order, by how much risk is still live, and hold
that order while the register stays open: an edit updates its row in place
and a new threat joins the end. A threat on no element reads "No element".
There is no filter or search.

Choosing a row by its title opens that threat on the model panel's Threats
tab, landed at the top as if it were opened there, and shows the model panel
where something else was in its place. The register stays open with the row
marked and focus on its title, and the status line says which threat opened.
A threat holding refused text in the model panel stays open there, and
another row chosen meanwhile is not marked.

Where the register hides the panel under it, choosing a row closes the
register instead, and focus moves to that threat in the model panel, as it
does on Escape. The register then opens with that row marked and focus on
it, until it is closed another way. A row chosen while another threat holds
refused text leaves the register open.

Each element name in a row selects that element, on whichever diagram draws
it, and closes the register, with focus on the element.

Escape, or Close threat register, closes it and leaves the model panel open.
Focus moves to the threat open in the model panel, or to its Threats tab where
none is, and without the model panel back to where it was before the register
opened.

The register covers the cards over a selection, such as Reconnect flow, which
Tab skips while it is open. Position and size, Change flow source and Change
flow target close the register as they open their card.

## Keyboard

**Keyboard shortcuts**, in the Help menu, or ? or F1 outside a form field,
toggles the shortcut reference: every command and every key that acts inside a
control. It overlays the left edge on a wide screen and the lower part of a
narrow one, and does not trap focus. It starts as collapsed category cards
showing their entry counts. Enter or Space expands a card, the arrow keys move
between card headers, and several cards can stay open. Escape closes it while
focus is inside.

Every edit has a keyboard path. Below, Mod is Command on macOS and Control
elsewhere. Whether a chord acts depends on where keyboard focus is: Save, Save
as, Undo and Redo also work while focus is in a form field, the rest only
outside one, and none works while focus is inside an open menu or list.

| Command                                | Keys                                         | Also on             |
| -------------------------------------- | -------------------------------------------- | ------------------- |
| Open, Save, Save as                    | Mod+O, Mod+S, Mod+Shift+S                    | Menu                |
| New model                              | Mod+Shift+X                                  | Menu                |
| Undo                                   | Mod+Z                                        | Menu                |
| Redo                                   | Mod+Shift+Z, or Control+Y off macOS          | Menu                |
| Copy, Cut, Paste, Duplicate            | Mod+C, Mod+X, Mod+V, Mod+D                   | Keyboard only       |
| Select all                             | Mod+A                                        | Keyboard only       |
| Delete selection                       | Delete or Backspace                          | Keyboard only       |
| Rename selection                       | F2, or Enter with one selected               | Menu                |
| Position and size                      | Shift+P                                      | Keyboard only       |
| Change flow source, Change flow target | Shift+S, Shift+T                             | Reconnect flow card |
| Toggle bidirectional flow              | Shift+D                                      | Reconnect flow card |
| Reverse flow                           | Shift+R                                      | Reconnect flow card |
| Switch boundary shape                  | Shift+B                                      | Trust boundary card |
| Align left, right, top, bottom         | Mod+Shift+Left, Right, Up, Down              | Menu, Arrange       |
| Align centres, Align middles           | Mod+Shift+H, Mod+Shift+V                     | Menu, Arrange       |
| Distribute horizontally, vertically    | Mod+Shift+D, Mod+Shift+B                     | Menu, Arrange       |
| Model                                  | M                                            | Menu                |
| Threat register                        | R                                            | Menu                |
| Focus threats                          | T                                            | Keyboard only       |
| Start a flow                           | F                                            | Keyboard only       |
| Add bend                               | `+`                                          | Flow route toolbar  |
| Snap to grid                           | Mod+Shift+G                                  | Menu                |
| Fit selection                          | Mod+Shift+0                                  | Menu, zoom controls |
| Fit to view                            | Mod+0                                        | Zoom controls       |
| Zoom in, Zoom out                      | Mod+= or Mod++, Mod+-                        | Zoom controls       |
| Reset zoom to 100%                     | Mod+1                                        | Zoom controls       |
| Next diagram, Previous diagram         | PageDown, PageUp, with more than one diagram | Keyboard only       |
| Select                                 | V, 1 or Escape                               | Toolbox             |
| Actor, Process, Store                  | A or 2, P or 3, S or 4                       | Toolbox             |
| Trust boundary, Trust boundary curve   | B or 5, C or 6                               | Toolbox             |
| Note                                   | N or 7                                       | Toolbox             |
| Hand                                   | H, or hold Space                             | Toolbox             |
| Keyboard shortcuts                     | ? or F1                                      | Menu                |

Enter on a focused element selects it, and a second Enter edits its name.

## Accessibility

Tab reaches the card, then the diagram's flows and elements, every flow before
every element, then the threat register while it is open, then the panel. Where
the register covers the panel, in a window under 55rem, Tab skips the panel
until the register closes.

Every element and flow is a tab stop whose accessible name comes from the
model: its name, its kind, what its badge says, and each flag its threats
raise. A flow also names the elements it runs between. The inline name field is
named "Name of" the element it renames. Selection is a dashed frame and a
heavier line, and focus is a separate ring, so neither depends on colour and
both survive forced colours. A badge carries its open count over a severity
letter, and a flag is a triangle marked `!`.

A focused element or resize control that lies under the threat panel or the
Reconnect flow or Trust boundary card shows its ring under that pane, and the
canvas does not pan to bring it out.

The Position and size and flow end editors return focus to the selected
element when they close. Deleting the focused element from the canvas moves
focus to the canvas. Escape clears the selection and leaves focus on the
element or flow that had it. From a resize control, a bend or end handle, a
point handle or the route toolbar, it moves focus to the selected element or
flow, and so does the second Escape on an icon of the Reconnect flow or Trust
boundary card, once the first has closed its tooltip. Straight after a box
selection, Escape moves focus to the canvas.

React Flow gives the canvas `role="application"`, which turns off a screen
reader's browse mode there: Tab reaches every element, but the reader's own
navigation keys do not.

## Current limitations

- Removing and reordering diagrams is not offered.
- Nothing pans to a newly connected flow, or out from under the panel.
- Records have no list of their own: a mitigation is reached through its
  threats, and an assumption through its threats or the model panel's Details.
  The model's explicit record removal has no control.
- Link existing and Attach existing have no search or filter, and neither the
  threat list nor the threat register has a filter, a search, or an order but
  the one above.
- A threat's id and number cannot be edited.
- A custom methodology cannot be created in the studio. A threat that arrived
  with one shows it and can be moved to a listed category.
- The model's owner and contributors are not edited in the studio.
- Markdown in a description is edited as source, with no preview.
- An element under the panel cannot be clicked. The keyboard still reaches it.
- On a touch screen, a double tap on an element the panel opens over can land
  in the panel, since two taps rarely fall as close together as two clicks.
