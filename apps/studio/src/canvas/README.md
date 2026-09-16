# The studio's canvas

The diagram, interactive: React Flow mounted around the drawing primitives
in [`@saerskriven/canvas`](../../../../packages/canvas/README.md), so the studio
and the headless renderer draw one picture from one set of numbers. What a
person can do with it is in [Using the studio](../../../../docs/studio.md).

## Modules

| Module                                                                | What it holds                                                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `diagram-canvas.tsx`                                                  | The React Flow mount, its handlers, and the injected `themedCanvasStylesheet`                                                      |
| `layout.ts`                                                           | The laid-out diagram on screen, kept against the model and diagram it came from                                                    |
| `nodes.ts`, `names.ts`                                                | The layout as React Flow's nodes and edges, and each one's accessible name                                                         |
| `changes.ts`                                                          | What React Flow reports about a gesture, turned into store actions and dispatched                                                  |
| `live-edges.ts`, `box-selection.ts`, `background-selection.ts`        | Hooks for a drag's flows, a selection box extended to flows, and a stationary background press                                     |
| `tools.ts`, `elements.ts`, `placement.tsx`, `placement-preview.tsx`   | The active mode outside the model store, the elements a tool places, the pointer and Enter gestures, and the draft drawn meanwhile |
| `edits.ts`                                                            | One function per edit a control asks for                                                                                           |
| `connecting.ts`, `flow-target-chooser.tsx`                            | The flow a start-flow command holds until a target is chosen, and the listbox that chooses it                                      |
| `inline-editing.tsx`                                                  | The inline name and Note editors, and the node and edge bodies that mount them                                                     |
| `selection-controls.tsx`, `selection-control.ts`                      | The controls over a selection, and the event a command opens one of them through                                                   |
| `geometry-editor.tsx`, `endpoint-editor.tsx`, `side-labels.ts`        | The Position and size form, the flow end form, and the words each side is called                                                   |
| `flow-bends.ts`, `flow-bend-interaction.ts`, `flow-bend-controls.tsx` | A flow's bend and end-side previews and model edits, their pointer and keyboard gestures, and their controls                       |
| `bend-insertion.ts`                                                   | The event connecting the Add bend command to the mounted bend controls                                                             |
| `clipboard.ts`, `arrangement.ts`, `snap.ts`                           | Copy, cut, paste and duplicate, align and distribute, and the snap setting                                                         |
| `diagrams.ts`                                                         | Switching, adding and renaming diagrams                                                                                            |
| `announcements.ts`, `canvas-announcement.tsx`                         | What an edit said, and the status host that says it                                                                                |
| `viewport.ts`, `view-commands.tsx`                                    | The zoom limits, the canvas area left of the pane and the viewport that fits a box into it, and the hooks applying them            |
| `toolbox.tsx`, `zoom-cluster.tsx`                                     | The tool modes on the chrome card, and the zoom controls                                                                           |

The shell mounts `toolbox.tsx` as row two of its chrome card
(`../app/chrome.tsx`), and hangs `canvas-announcement.tsx` and
`flow-target-chooser.tsx` under that card. None of the three reads a React Flow
hook, which is what lets the shell host them.

## Mounting

The canvas fills the viewport, and the chrome card, the threat panel and the
zoom cluster float inside it. The card's measured height, and the measured
height of the notices and flow chooser under it, reach the panel and the
selection controls through `--pn-pane-block-start`, which adds a fixed
two-line slot for the announcement.

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
  a resize one `ResizeElement`. During a drag each flow reads its endpoint
  nodes, and the collision search for names and badges runs when the pointer
  pauses and once more on pointer-up.
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
- **Which element has its name open is store state**, so the rename command
  reaches it with nothing of the canvas mounted above it
  ([the store](../store/README.md)). A name the model already holds dispatches
  nothing, on the panel's [commit rule](../panel/README.md#the-commit-rule). A
  refused name keeps its field open wherever the selection goes, and its draft
  goes only when a rename opens on another element.
- **The announcement speaks only where the next focus does not show the
  result**: canvas and threat deletion, refused text, and Undo or Redo.
  Placement, connection, renaming, field edits and keyboard moves rely on the
  focused control or React Flow's own message. A name a person wrote is quoted
  through `quoted` in `announcements.ts`, on one line and cut past
  `nameQuoteLength` (40 grapheme clusters) or `recordQuoteLength` (24). While a
  pane or a selection editor is open the announcement stops at two lines on
  screen, and the accessible names stay whole.
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
reach `diagram-canvas.module.css` as the `--pn-cue-*` properties
`tokenStylesheet` writes, so a cue is measured against the drawing's own stroke
weight. The canvas package's edge body adds React Flow's invisible interaction
path, and holds the flow's name, so a click on the line, the wider path or the
name selects the flow.

React Flow z-index values are set by hand: a boundary at -1, a regular node at
0 and a selected regular node at 1, so selection keeps a regular node visible
without raising a boundary above what it encloses. A boundary's interior passes
pointer events through, and its name, resize control and an invisible stroke
around its outline stay selectable. Its disabled connection handles cannot take
an outline drag.

Select rests on the arrow over the pane and nodes, a flow keeps its link
pointer and a connection handle its crosshair. Place uses a crosshair and Hand
uses `grab`, then `grabbing`. The side lines take the pointer away from the
round connection handle at each midpoint. A threat badge draws over the
selection frame and the side lines and under every control's hit area. The
top-right resize handle keeps clear of the badge at every zoom, and on an
element too narrow for that it stops beside the top-left handle and can meet
the badge ([the canvas package](../../../../packages/canvas/README.md)).

Focus is the app's ring (`--pn-focus-ring`) and selection the frame and
weights above, drawn apart so they stack. Both are an outline or a border
rather than a shadow, so forced-colours mode keeps them.

## The view

`fitViewport` in `viewport.ts` fits a box into the canvas extent with padding
for the floating controls, within `zoomLimits`. React Flow's default minimum
zoom of 0.5 cannot fit the full Écluse model. `FitOnOpen` fits from inside
React Flow, which holds the canvas extent, whenever `modelAsOpened` returns a
new model or the diagram on screen changes. That selector returns the present
model only while both history stacks are empty, so an open, a close or another
tab's open fits again, while an edit or a save moves nothing. Opening fits the
full canvas extent. The fit commands use `clearOfPanel`, the area left of the
pane's measured coverage, and the `panelCover` token sets only the pane's
default width.

## Accessibility

Every element is a tab stop with an accessible name out of model data
(`names.ts`), because the glyphs are hidden from assistive technology and a
badge would otherwise be visual alone. The badge draws one flag mark for either
flag, so the name carries which, in the wording and order of the collapsed
threat summary. The card comes before the canvas in the page, and the target
chooser exists only while the start-flow command is in progress, so it adds no
dead stop to the tab path.

React Flow's container carries `role="application"`, which turns off a screen
reader's browse mode inside the canvas. React Flow writes the role after any
property handed to it, so it cannot be overridden from here. Tab order follows
React Flow's DOM order, with every flow before every node.

An unplaced flow has no drawn bounds, so Select All and box selection leave it
out.
