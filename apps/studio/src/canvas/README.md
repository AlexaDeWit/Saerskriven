# The studio's canvas

The diagram, interactive: React Flow mounted around the drawing primitives
in [`@saerskriven/canvas`](../../../../packages/canvas/README.md), so the studio
and the headless renderer draw one picture from one set of numbers. What a
person can do with it is in [Using the studio](../../../../docs/studio.md).

## Modules

| Module                                                                                          | What it holds                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagram-canvas.tsx`                                                                            | The React Flow mount, its handlers, and the injected `themedCanvasStylesheet`                                                                              |
| `layout.ts`                                                                                     | The laid-out diagram on screen, kept against the model and diagram it came from                                                                            |
| `nodes.ts`, `names.ts`                                                                          | The layout as React Flow's nodes and edges, and each one's accessible name                                                                                 |
| `changes.ts`                                                                                    | What React Flow reports about a gesture, turned into store actions and dispatched                                                                          |
| `live-edges.ts`, `box-selection.ts`, `background-selection.ts`                                  | Hooks for a drag's flows, a selection box extended to flows, and a stationary background press                                                             |
| `group-drag.ts`                                                                                 | A drag of the selection from inside its bounds, where the press lands on empty canvas or an element it leaves out                                          |
| `node-drag.ts`                                                                                  | React Flow's own drag of nodes, put back on a selection change or a window blur, which also lets go of a held press                                        |
| `item-focus.ts`                                                                                 | The Select tool's keys on a drawn element, flow or a control of the selection, answered so that focus lands on the element                                 |
| `tools.ts`, `elements.ts`, `placement.tsx`, `placement-preview.tsx`                             | The active mode outside the model store, the elements a tool places, the pointer and Enter gestures, and the draft drawn meanwhile                         |
| `edits.ts`                                                                                      | One function per edit a control asks for                                                                                                                   |
| `pane-shield.ts`                                                                                | Keeping a double-click's second press out of a pane its first press opened                                                                                 |
| `connecting.ts`, `flow-target-chooser.tsx`                                                      | The flow a start-flow command holds until a target is chosen, and the listbox that chooses it                                                              |
| `inline-editing.tsx`                                                                            | The inline name and Note editors, and the node and edge bodies that mount them                                                                             |
| `selection-controls.tsx`, `selection-control.ts`                                                | The controls over a selection, and the event a command opens one of them through                                                                           |
| `geometry-editor.tsx`, `endpoint-editor.tsx`                                                    | The Position and size form, and the flow end form                                                                                                          |
| `element-draft.ts`                                                                              | The preview of an edit to the selected element, and its commit as one dispatch                                                                             |
| `handle-drag.ts`, `handle-actions.tsx`, `handles.module.css`                                    | A handle's pointer drag and arrow-key step, the actions a clicked handle opens, and their styles                                                           |
| `waypoints.ts`                                                                                  | A point inserted into or moved along a flow's bends or a curve's points                                                                                    |
| `flow-bends.ts`, `flow-bend-interaction.ts`, `flow-bend-controls.tsx`, `flow-route-toolbar.tsx` | A flow's bend and end previews and model edits, their pointer and keyboard gestures, and their controls                                                    |
| `curve-points.ts`, `curve-point-controls.tsx`                                                   | A trust boundary curve's point previews and model edits, which midpoints it shows, and the handles and actions that make them                              |
| `bend-insertion.ts`                                                                             | The event connecting the Add bend command to the mounted bend controls                                                                                     |
| `clipboard.ts`, `arrangement.ts`, `snap.ts`                                                     | Copy, cut, paste and duplicate, align and distribute, and the snap setting                                                                                 |
| `stored-decimals.ts`                                                                            | How many decimals a gesture, a command and a typed form each store                                                                                         |
| `diagrams.ts`                                                                                   | Switching, adding and renaming diagrams                                                                                                                    |
| `announcements.ts`, `canvas-announcement.tsx`                                                   | What an edit said, and the status host that says it                                                                                                        |
| `move-message.tsx`                                                                              | What React Flow's live region says once an arrow key has moved the selection                                                                               |
| `keyboard-moves.ts`                                                                             | How the view's follower is told that a key press moved or resized something, and what                                                                      |
| `viewport.ts`, `view-commands.tsx`                                                              | The zoom limits, the canvas area left of the pane and the viewport that fits a box into it, and the hooks applying them                                    |
| `focus-pan.tsx`                                                                                 | The shortest pan that brings the focused item's ring, or a bend being placed, into the viewport, asked for by Tab focus and by an arrow-key move or resize |
| `toolbox.tsx`, `zoom-cluster.tsx`, `stroke-glyph.tsx`                                           | The tool modes on the chrome card, the zoom controls, and the stroke icon the toolbox and the selection cards draw                                         |

The shell mounts `toolbox.tsx` as row two of its chrome card
(`../app/chrome.tsx`), and hangs `canvas-announcement.tsx` and
`flow-target-chooser.tsx` under that card. None of the three reads a React Flow
hook, which is what lets the shell host them.

## Mounting

The canvas fills the viewport, and the chrome card, the threat panel and the
zoom cluster float inside it. The card's measured height, and the measured
height of the notices and flow chooser under it, reach the panel and the
selection controls through `--saer-pane-block-start`, with no space reserved for the hidden activity announcements.

React Flow draws the graph-paper ground at the canvas package's grid spacing,
and the studio supplies its grid and handle colours through React Flow's
custom properties from the token table
([the visual system](../../../../packages/canvas/README.md#the-visual-system)).
The diagram's own colours arrive the same way: `themedCanvasStylesheet` is the
canvas sheet written in those custom properties rather than in values, so the
drawing follows the colour scheme the app root resolved and nothing here reads
a scheme or holds a mode. The CLI embeds the resolved sheet instead.

## Rules for changes

- **React Flow is mounted controlled.** What it draws is rebuilt whole from the
  model on every render, one pass over a diagram's elements with nothing
  measured, so the canvas keeps no view of the model of its own. What it does
  keep is what React Flow reports about a gesture in flight, folded back onto
  the model's nodes as soon as the model moves.
- **A layout is handed back while the model is the same object.** Zustand reads
  a store through `useSyncExternalStore`, which refuses a snapshot that is a new
  object on every call, so the cache in `layout.ts` is what lets the canvas
  subscribe at all.
- **A gesture reaches the store once, when it settles.** A single move
  dispatches `MoveElement`, a group move `MoveElements` with one shared offset,
  a resize one `ResizeElement`, or one `SetBoundaryShape` with a trust boundary
  curve's points scaled to the new box. During a drag each flow reads its endpoint
  nodes, a flow whose block no longer follows its line is placed again clear of
  the blocks the other flows keep, and every block is placed afresh on
  pointer-up. A drag that Escape or a blurred window puts back never reaches
  the store.
- **Every edit that writes geometry names the decimals it stores.** The model
  rounds what an operation writes to the count the action carries
  ([the store](../store/README.md#stored-decimals)), and `stored-decimals.ts`
  says which count:
  - A gesture stores three decimals from a pointer and one from the keyboard
    (`gestureDecimals`). A point the arrow keys placed is the keyboard's, and
    one a click or a drag placed is the pointer's. Snap to grid acts before
    the commit, in React Flow and in `group-drag.ts`, and a grid multiple is
    the same number at any count.
  - The gesture commits are `applyChanges` for a move, where `node-drag.ts`
    tells React Flow's drag from its arrow-key move and `group-drag.ts` is a
    pointer's, `resizeNode` for a resize, whose control says which it was,
    `placeElement` and `placeBoundaryCurve` for a placement, and an element
    draft's `commit` for a bend, a flow end and a curve point.
  - A command that works geometry out stores three (`commandDecimals`): align,
    distribute, duplicate, paste, Add point, Switch boundary shape, and the
    flow ends a removal frees.
  - A form stores a typed number as typed, up to six decimals
    (`mostTypedDecimals`). Position and size stores the most decimals any of
    its fields is written with, from three to six (`typedDecimals`), so what
    it writes without showing, the elements of a group and the points of a
    trust boundary curve, keeps at least three. The flow end form stores the
    typed position itself at six, and its fields start from an attached end's
    anchor at `commandDecimals`.
  - Removing a bend or a curve point says `undefined`, since it writes only
    points already stored, and so do drawing a flow and pinning a flow end to
    a side, which write no number.
- **Settle against the store's selection, not a render's.** React Flow reports
  a click that moves the selection between a node and a flow as two
  synchronous calls with no render between them.
- **Every edit is one dispatch, so one undo step.** A selection that follows an
  edit is a second dispatch and costs no history. An edit the model refuses is
  said by the failure notice, not by the announcement.
- **`connectElements` refuses a flow end that is not an actor, process or
  store itself.** The model takes an endpoint naming any element of the
  diagram, and the layout then drops a flow it cannot place, which would leave
  a flow in the model and the saved file while it is drawn nowhere. A flow
  from an element to itself is refused too, since both ends resolve to one
  handle.
- **Connection handles are drawn on the hovered and the selected element
  only**, and a hidden handle is still a drop target, React Flow resolving the
  nearest handle within its connection radius. Which element is hovered is
  read in `diagram-canvas.module.css` rather than held as state, so hovering
  costs no render of a canvas that rebuilds every node.
- **Delete and Backspace are bound twice**, by the command registry for the
  page and by the canvas for itself. A press the canvas answered is marked
  handled, so one press is one removal ([the commands](../commands/README.md)).
- **The Select tool's keys on a canvas item or a control of the selection
  are answered by the canvas.** React Flow blurs a node or flow it unselects
  on Escape, and the controls of the selection go with it: resize controls,
  bend, end and point handles, the route toolbar, the sections marked
  `data-selection-commands`, and the frame React Flow draws around a box
  selection. So `item-focus.ts` moves focus to the element, or from the frame
  to the canvas, runs the command itself and stops the press there, short of
  React Flow and the page binding. A handle gesture's own Escape runs first
  and stops the press.
- **Which element has its name open is store state**, so the rename command
  reaches it with nothing of the canvas mounted above it
  ([the store](../store/README.md)). A name the model already holds dispatches
  nothing, on the panel's [commit rule](../panel/README.md#the-commit-rule). A
  refused name keeps its field open wherever the selection goes, and its draft
  goes only when a rename opens on another element.
- **A double-click edits the element its first press landed on**, even where
  the pane opens over that element in between. `pane-shield.ts` stops a second
  primary press in the select tool that lands in the pane within
  `doublePressInterval` (500 ms) and `placementClickDistance` of the first, so
  no pane control acts on it, and its pointer click opens the element's text
  instead. A cancelled press, a blurred window and a keyboard activation let
  the shield go.
- **The announcement speaks only where the next focus does not show the
  result.** An action whose result the focused control or React Flow's own
  message already reports, such as a placement, a rename or a keyboard move,
  announces nothing. React Flow writes its move message before the move lands,
  so `move-message.tsx` writes it once the store holds the move, in the figures
  Position and size shows. A name a person wrote is quoted through `quoted` in
  `announcements.ts`, on one line and cut past `nameQuoteLength` (40 grapheme
  clusters) or `recordQuoteLength` (24).
- **Activity announcements are hidden on every layout.** The live region keeps
  its text in the accessibility tree without occupying canvas space. Diagram
  changes also announce when focus stays on the switcher.
- **The status lives outside the model store**, since it does not belong in the
  undo stacks. The empty host stays mounted, a sequence key makes repeated
  words arrive as separate messages, and the store defines when a message ends
  ([the store](../store/README.md#the-shape)).
- **Canvas keys live in `../commands/contextual-shortcuts.ts`**, which the
  shortcut reference, the event handlers and the accessible descriptions all
  read.

## Cues

Nothing about selection or hover is carried by colour alone. A selected
element takes a dashed frame a step heavier than its outline, and a flow's own
line is heavier under the pointer and heavier again once selected. The weights
reach `diagram-canvas.module.css` as the `--saer-cue-*` properties
`tokenStylesheet` writes, so a cue is measured against the drawing's own stroke
weight. An out-of-scope flow's dots are as wide as its line, so the gap between
them grows with the cue weight and they stay apart under both cues. The canvas
package's edge body adds React Flow's invisible interaction path, and holds the
flow's name, so a click on the line, the wider path or the name selects the
flow.

React Flow z-index values are set by hand: a boundary at -1, a regular node at
0 and a selected regular node at 1, so selection keeps a regular node visible
without raising a boundary above what it encloses. A node whose resize control
holds keyboard focus rises to 2 while it does, above every other item and the
handles on a curve's points, and that control above the node's other controls,
so nothing on the canvas covers the control's ring. A boundary's interior passes
pointer events through, and its name, resize control and an invisible stroke
around its outline stay selectable. Its disabled connection handles cannot take
an outline drag.

Select rests on the arrow over the pane and nodes, a flow keeps its link
pointer and a connection handle its crosshair. Place uses a crosshair and Hand
uses `grab`, then `grabbing`. The side lines take the pointer away from the
round connection handle at each midpoint. A threat badge draws over the
selection frame and the side lines and under every control's hit area. While
its element is selected, the badge steps out past the top-right corner
([the canvas package](../../../../packages/canvas/README.md)), and the selected
node's z-index of 1 draws it above its neighbours. A selected boundary box
stays at -1, so its badge draws in React Flow's viewport portal, where the
badge layer's z-index lifts it above the nodes around it. Scaled up at low
zoom, the two right-hand corner handles grow inward from the right side, so
neither reaches the stepped-out badge. `selectionBounds` measures a selection
with each badge where it is drawn, for Fit selection and the group drag's
bounds. A trust boundary curve's corner handles sit outside its corners
instead, clear of the badge on its corner and of the handle on a point there.

Focus is the app's ring (`--saer-focus-ring`) and selection the frame and
weights above, drawn apart so they stack: an element's ring sits just inside
its frame, over its own drawing and within the bounds it was drawn at. Both are
an outline or a border rather than a shadow, so forced-colours mode keeps
them.

## The view

`fitViewport` in `viewport.ts` fits a box into the canvas extent with padding
for the floating controls, within `zoomLimits`. React Flow's default minimum
zoom of 0.5 cannot fit a large model. `FitOnOpen` fits from inside
React Flow, which holds the canvas extent, whenever `modelAsOpened` returns a
new model or the diagram on screen changes. That selector returns the present
model only while both history stacks are empty, so an open, a close or another
tab's open fits again, while an edit or a save moves nothing. Opening fits the
full canvas extent. The fit commands use `clearOfPanel`, the area left of the
pane's measured coverage, and the `panelCover` token sets only the pane's
default width.

`FocusPan` in `focus-pan.tsx` pans to bring the focused item's ring into the
viewport, React Flow's container box. Nothing over the canvas plays a part: a
ring under a pane is inside the viewport and stays where it is. It stands in
for React Flow's `autoPanOnNodeFocus`, which stays off because it centres a
node. Two things ask for the pan. `onKeyboardFocus` keeps the input modality
itself: a key press that `armsFocusPan` answers, Tab with Shift, Alt or
neither, puts the keyboard in charge until the next `pointerdown`, both heard
in the capture phase on the window. Alt is there for Safari, where Option+Tab
is the chord that reaches every item, and no browser spec runs it.
`:focus-visible` is not that test. Chromium keeps it for a script focus
after an earlier key press, including an element placed by pointer and then
named. This Playwright WebKit build clears it once a pointer press came first. A `focusin` on React Flow's container counts while the
keyboard is in charge and its target is an element, a flow, a resize control,
or a bend, flow end or curve point handle that matches `:focus-visible`. Focus
the browser hands back when the window regains it is not a move.
`onKeyboardMove` lends the handler that `keyboardMoved` in `keyboard-moves.ts`
calls, the one way the follow is told: by `KeyboardMoveMessage` once an arrow
key has moved the selection, by the arrow nudge of a bend, a free flow end and
a curve point, by a resize as it ends where its control says the keyboard made
it, and by the arrow nudge of a bend being placed. So the follow needs no Tab
first and knows nothing of how the move is stored. The caller is what knows the
input, and a pointer path never calls: a resize ends the same way by key and by
pointer, so the resize end reads its `GestureInput`. The handler infers nothing
from the window's events. It listens for `keydown` alone, to know whether the
key is held. It measures whatever holds focus then: the element, the resize
control, the handle, or the frame React Flow draws around a box selection,
whose box is the whole group's. That frame is no tab stop, so only the move
path takes it. A bend being placed is the one exception: the route toolbar
holds focus, so the call names the bend by its place among the flow's bends and
the handler measures that handle, which draws no ring. Both paths measure on
the next frame, when what the key press changed is drawn.

`offsetIntoView` works in screen pixels, from the item's box with its outline's
reach and the container's box: no move for a ring wholly inside, otherwise on
each axis the least that puts the ring `ringMargin` inside the border it had
crossed. A ring too long for the viewport on an axis moves the least that fills
the viewport with it, and not at all once it spans the viewport. `viewPanner`
hands the move to React Flow's `setViewport` as a `focusPanDuration`
transition, interpolated linearly because React Flow's default zooms out and
back over a pan. It has no duration under reduced motion, nor for the repeat of
a held arrow key, since a transition restarted at each repeat falls behind the
element. Each item is measured from where the view is at that moment and
replaces a pan still running, and one needing no move stops it, so two pans
never run against each other. A scroll, a drag or a zoom interrupts the
transition inside d3-zoom, and nothing asks for the view again until focus or
the element moves. The pan touches React Flow's store alone, so it is no edit,
no undo step and nothing another tab hears of.

## Accessibility

Every element is a tab stop with an accessible name out of model data
(`names.ts`), because the glyphs are hidden from assistive technology and a
badge would otherwise be visual alone. The badge draws one flag mark for either
flag, so the name carries which, in the wording and order of the collapsed
threat summary. The card comes before the canvas in the page, and the target
chooser exists only while the start-flow command is in progress, so it adds no
dead stop to the tab path.

React Flow writes `role="application"` on its container after any property
handed to it, so neither that role nor React Flow's DOM order, which sets the
tab order, can be changed from here. What they mean for a person is in
[Using the studio](../../../../docs/studio.md#accessibility).
