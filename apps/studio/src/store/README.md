# The studio's model store

One store holds the whole studio: the model, history, transient view state,
file lifecycle, last refusal, and recovery status. Outside a spec reset,
`dispatch(action)` is the only way the state moves. It applies one pure
`reduce(state, action)`. Views read through selectors.

Zustand hosts it because React Flow 12 is built on it, so the canvas and the
studio subscribe the same way and a component re-renders only when the slice
its selector returns changes. React Flow carries a zustand 4 copy of its own
for its internal store, which no code here uses. The reducer shape and the
immutable snapshots the undo stacks hold are the constraint, not something the
host provides.

## The shape

- `state.ts` holds `State`, the `FileLifecycle` and `StudioFailure` enums, the
  state a model starts in, and the placeholder model the studio opens on until
  a file is opened. The stacks hold whole models: the model's operations return
  new models sharing everything they did not change, so a snapshot is cheap.
  The placeholder is the smallest data-flow diagram, an actor, a flow and a
  store, sized on the studio's grid so no name wraps and the flow's name has
  room clear of both boxes. Its title is `untitledModel`, the name `nameOf`
  gives a model in no file, so the tab, the file controls and a saved file read
  one string.
- `actions.ts` is the `Action` union, an Effect `Data.taggedEnum`. A model edit
  carries one operation and its arguments, so an unlink that removes a record
  from its last reference is one undo step. `MoveElements` and
  `RemoveElements` fold the matching operation over one ID array, and
  `InsertFragment` and `ArrangeElements` apply a paste or an arrangement
  atomically, before history records the result. `AddDiagram` appends a
  diagram and shows it, the one edit that moves the view as well as the model.
  The other tags cover history, the diagram on screen, selection, inline
  editing, files and failures. `DismissFailure` puts `lastFailure` away and
  touches nothing else. `Saved` names a file as `Opened` does, because a first
  save is a save-as, and folding both into `file` keeps "this model lives in
  this file" one fact. `Closed` returns to the state the studio booted in,
  placeholder model and all, so nothing of the file that was open survives for
  a later save to merge onto.
- `reducer.ts` is the one pure function, beside the private helpers its arms
  share. It is total: an operation the model refuses leaves the present and
  both stacks alone and records the refusal in `lastFailure`, so no dispatch
  fails and no view handles an error. A successful edit pushes the old present
  onto `past` and clears `future`.
- `store.ts` creates the vanilla store. `dispatch` applies the reducer, writes
  recoverable changes, publishes the state, and sends the result to the other
  tabs ([Other tabs](#other-tabs)). `useModelStore(selector)` is the React
  half. The store opens from recovery, the development model, or the
  placeholder, in that order. `onCanvasOrPanelChange(changed)` subscribes to
  the model on screen, the selection and the open inline field, which is the
  lifetime of a transient status: it ends at the next action that moves one of
  the three, never on a clock.
- `selectors.ts` derives what views show. `isDirty` is `present !== saved` by
  identity, so undoing back to the saved point clears it with no bookkeeping.
  `modelAsOpened` is the present model while both stacks are empty, which is
  how the canvas tells a model that arrived from one that was edited
  ([the canvas](../canvas/README.md#the-view)). `windowTitle` names the browser
  tab with `nameOf` the file ahead of the product name, so the tab and the menu
  cannot disagree. `showingPlaceholder` identifies the untouched opening state.
- `../reason.ts` words a thrown or rejected value, for the store's recovery
  storage and the file bridge alike, so neither imports the other.

The active diagram, the selection, whether the model's properties are shown,
the inline editor, the last refusal, and the file lifecycle stay out of the
undo stacks. `ShowModelProperties` shows the model's properties and clears the
selection, a `Select` naming an element hides them, and
`HideModelProperties` hides them. `activeDiagram` names the diagram on screen,
and nothing until one has been chosen. `SelectDiagram` sets it, clears the
selection and closes the editor, since both belong to the diagram left, and
moves neither the model nor the history. The `activeDiagram` selector falls
back to the first diagram while the model does not hold the one named, so an
open, an undo or a redo that takes the diagram away leaves the canvas on
something. `selection` is a unique, ordered array of element IDs, and an
unchanged selection keeps its array identity, so repeated canvas callbacks do
not erase the announcement for the selection change they completed. A removal
drops every removed ID from it and closes a matching editor. `inlineEditor`
names the element and whether the field edits its name or its Note text. It is
in the store because a command reaches it from the keyboard. Being total, the
reducer cannot refuse `Opened` or `Closed` over unsaved work, so those guards,
and the one on closing the tab, belong in the view
([the file bridge](../files/README.md)).

`FileLifecycle.Opened` carries the file's name and its `RetainedSource`: the
format it was read as, and the wire document that read produced. A save merges
the model onto that document, and what Saerskriven does not model survives
only that way. It rides in the store so that one dispatch settles which file
the model lives in and what a save merges onto, and it stays out of the stacks
with the rest of the file: an undo moves the model, never the file. The type is
derived from the formats package's detected-read union, so a document cannot be
filed under the wrong format.

## Recovery

`recovery-storage.ts` owns loading, replacing, and clearing one snapshot under
`saerskriven:studio:recovery` in `localStorage`. Version 2 of the snapshot
stores the model as a Saerskriven YAML wire document, with dirty status, the
file lifecycle (name, format, retained wire document), the studio version that
wrote it, and the active diagram as an optional field, so a snapshot written
before that field existed still loads. A restored active diagram the model no
longer holds is dropped.

The snapshot holds a document of [the native
format](../../../../docs/saerskriven-yaml.md) rather than the model, so it
inherits that format's compatibility contract: a session survives every
upgrade a file in that format survives, a field added to the model costs the
snapshot nothing, and a stored version 1 document, or the retained source of a
version 1 file, restores through the formats package's migration rather than
one of the snapshot's own. A document of a version this release does not know
is rejected like any malformed snapshot. The studio version in `writtenBy` is
information for a refusal, never a guard on what loads. Going through the
format costs the order of the threat register, which a restore puts in number
order as an open of the saved file does.

Version 1 of the snapshot held the model itself, and nothing maps it. It is
refused with a reason saying an earlier release wrote it, distinct from the
reason a malformed or unsupported snapshot gets, and the placeholder opens.

`dispatch` writes each changed recoverable field before it publishes the new
state, and the reducer performs no storage work. The snapshot excludes the
stacks, the selection, whether the model's properties are shown, rename state,
and the last failure. Startup bounds and parses the stored text before its
schema validates the version, document, file data, and retained source.
Missing data opens the placeholder without a report, and rejected data opens it
and records `StoredRecoveryRejected`.

A successful write marks the state recoverable. A failed write records
`RecoveryUnavailable` and leaves that mark false, and a later recoverable change
retries. The close guard reads that mark with dirty status (`needsCloseGuard`).
Close clears the snapshot, and a failed clear keeps the session open for retry.
The snapshot never holds a browser file handle.

### Other tabs

`sync.ts` carries every change that moved the model, a stack, the saved point
or the file to the other tabs of the origin over a `BroadcastChannel`, which
never delivers back to the sender, and the other tabs fold it into `Followed`.
The message is the model, both stacks, the saved point, the file and whether
the recovery storage holds it, sent by structured clone, which keeps the
references the stacks and the identity-based dirty check share. Selection, an
open field, the diagram on screen and whether the model's properties are shown
stay with the tab that made them, the first two trimmed to the elements the
adopted model still draws and the diagram falling back to the first where the
adopted model lacks it. A diagram switch writes the shared snapshot, so a
reload restores the diagram whichever tab switched last, but publishes nothing.
Following writes nothing and publishes nothing. The file session watches the
channel ([the file bridge](../files/README.md)), because a model another tab
wrote is one the handle it holds does not describe.

A message is trusted on its build alone: it comes from this origin's own code,
and the envelope carries the commit CI built the bundle from (`studioBuildId`),
so a tab left open across a deploy and a tab on the new code ignore each other.
That is what lets a message carry the model as the running code holds it, with
no format in between. State that outlives a build travels in the recovery
snapshot instead, which is why the snapshot holds a document and the channel
does not. Two tabs editing at once each adopt the other's result, so they
diverge until the next change in either, while the recovery storage holds
whichever wrote last. A tab opened later starts from the recovery snapshot,
without history.

## Rules for changes

- A reducer arm changes the model only by calling a `@saerskriven/model`
  operation and folding its `Either`. Never assign into `state.present` or
  into anything it holds: the stacks share those objects, so one write in
  place rewrites every snapshot at once and takes undo, redo and unsaved work
  down together. The spec that holds this clones the state with
  `structuredClone`, so `State` holds plain data: no function, class instance
  or ref goes in it. The state it clones has a file open, carrying the wire
  document a read retained, because a guard only covers what the clone is
  handed.
- A new mutation is a new action tag, a reducer arm, and a spec. Never a store
  method that edits the state beside the reducer, and never a copy of model
  state held in a component.
- A new kind of refusal is a `StudioFailure` member, not a second field beside
  `lastFailure`, so a view renders one value however the refusal arose.
- `reduce` folds the action with Effect's `$match`, whose cases object is typed
  by the union, so a tag with no arm does not compile and an arm for a tag the
  union does not declare does not either. Keep it that way.
- The spec tables are typed over every model tag too, so a new operation cannot
  land without its happy-path case, its refusal, its undo round-trip and its
  purity case.
- Views read by selector. A selector that builds a fresh array or object needs
  zustand's `useShallow` at the call site, or the component re-renders on every
  dispatch.
- A high-frequency gesture reaches the store once, at its end. React Flow keeps
  positions during a drag, and a drop dispatches one `MoveElement` or one
  `MoveElements` for the full selection.
