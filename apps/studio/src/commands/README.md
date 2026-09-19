# The studio's commands

One home per command. Every command the studio offers is named once, in
`registry.ts`, with the words a person reads, any assigned chord, and the
dispatch it runs. A control does not hold a handler and a key press does not
hold a second copy of one. Both go through the registry, so a button and its
shortcut cannot drift apart. The keys a person uses are in
[Using the studio](../../../../docs/studio.md#keyboard), and the full list is
the in-app shortcut reference this directory renders.

## Modules

| Module                    | What it holds                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `table.ts`                | The command table and the entry builders that fill it                                                     |
| `registry.ts`             | Reading that table: `commandById`, `commandFor`, `runCommand` and the diagram export                      |
| `surface.ts`              | The command surface types: the file session, the reference and the viewport                               |
| `shortcuts.ts`            | The chord type, its builders, and how each platform writes a chord                                        |
| `binding.tsx`             | The document-level key listener, who owns a key press, and the `CommandSurface` context                   |
| `contextual-shortcuts.ts` | Keys that act only inside one control, such as bend and resize keys, with their matchers and descriptions |
| `command-button.tsx`      | `CommandButton` and `IconCommandButton`                                                                   |
| `shortcut-reference.tsx`  | The non-modal shortcut reference panel                                                                    |

## What a command is

`table.ts` is one table keyed by command id. `commandById` reads it by key,
and `commandFor` finds the one command whose chord matches a key event. Each
entry carries:

- **The label**, a message id of the `commands` section, which is what a menu,
  a toolbox tooltip or a bare `CommandButton` says once a renderer resolves it
  ([the messages](../messages/README.md)). The table stores no text, so a
  label is never fixed in the language of module load. A label that names a
  distance or a diagram carries that value beside its id.
- **The group and context**, message ids too, which place and explain it in
  the shortcut reference.
- **The shortcuts**, zero or more chords, in the order they are offered.
- **`inTextFields`**, whether the chord still fires while a person is typing.
- **`available`**, where given, the state in which the command is the studio's
  at all.
- **The run**, which it calls with the `CommandSurface`.

`CommandSurface` is what a command reaches that is not a module-level function:
the file session, which holds the fallback picker only a component can hold and
the question a close asks over unsaved work, the shortcut reference, and React
Flow's viewport, which lives as long as the canvas is mounted. The store's own
dispatches and the canvas edits need no surface, which is why a control runs
those with nothing mounted above it. The app builds the one surface, in
`../app/app.tsx`, because that is the single place holding both the file
session and the viewport. The viewport half is a hook the canvas exports, so
the fit a command runs and the fit an open runs are one calculation ([the
canvas](../canvas/README.md#the-view)).

## Chords, and how a platform writes them

A chord is a set of modifiers and one key from a closed list, so a binding
names a key the studio decided on rather than any string a keyboard can
produce, and two commands reaching for one chord is a comparison over a known
alphabet. The registry's spec fails a chord that collides with one already
bound. A command may have no chord, as the export commands do.

`Mod` is the platform's command modifier: Command on Apple hardware, Control
everywhere else. The platform is read once at load, from the user agent data
where a browser offers it and `navigator.platform` where it does not, and each
chord is then written three ways:

| Where                | Apple          | Elsewhere         |
| -------------------- | -------------- | ----------------- |
| Tooltip, menu, panel | `⇧⌘S`          | `Ctrl+Shift+S`    |
| `aria-keyshortcuts`  | `Shift+Meta+S` | `Control+Shift+S` |

The attribute is spelled as ARIA asks, since assistive technology reads the
binding from it, and stays in those key values in every language. The spelling
a person reads is in the active locale: a named key and a modifier word come
from the `commands` catalogue section (fr-CA `Ctrl+Maj+S`, sv `Ctrl+Skift+S`),
following the [key names in the glossary](../../../../packages/render/src/messages/GLOSSARY.md#key-names),
and one name serves the eye and the screen reader alike. That spelling is the
tooltip and the control's accessible description, which `CommandButton` renders beside the button rather
than inside it: inside, the accessible name of Save would read "Save Ctrl+S".
A menu item draws the chord beside its label, where a native menu draws it,
and hides it from assistive technology, which reads `aria-keyshortcuts`
instead.

Matching allows for keyboards. Ctrl+Y is an alternative Redo off macOS only,
absent from macOS matching, labels and ARIA attributes. Backspace stands in for
Delete on Mac keyboards. Zoom accepts the equals key or the produced plus
character. Shifted number-row commands also match their digit key code when the
event reports punctuation, such as `!` for Shift+1. `+` for Add bend accepts
either Shift state, because layouts differ in how they produce it, while Ctrl
or Command with it keeps its zoom binding.

`IconCommandButton` is the same control drawn as a glyph. The registry's label
becomes the accessible name, and the label with its chord is a Radix tooltip
rather than the `title` attribute its worded sibling holds, because `title` is
shown to a pointer alone and an icon has to say what it is to a keyboard as
well. The tooltip renders in place rather than through a portal, so it stays in
whichever landmark the control sits in. The zoom cluster and the toolbox draw
their commands this way. The burger menu's button is a glyph, but every command
inside it is worded.

## Who holds the keyboard

`binding.tsx` installs every chord once, on the document rather than on the
control that holds focus, which is what makes a command reachable from
wherever a person is. Three rules decide whether a press is the studio's:

- **A press a control has already acted on is not.** It arrives with its
  default prevented, which is how one Delete removes one element while the
  canvas still binds that key itself (`../canvas/diagram-canvas.tsx`).
- **A press an open overlay owns is not.** A listbox or a menu is handling the
  same keys, Escape and every letter of its typeahead among them.
- **A press typed into a control that takes characters is not**, unless the
  command is exempt: a text field, and a closed listbox trigger, whose
  typeahead is the same thing. Save, Save as, Undo and Redo are the exemptions,
  so naming an element never deletes one and a save mid-sentence still saves.
  Escape is not among them: the threat panel takes it from inside a field,
  closes and hands focus back to the element, and the second Escape runs Select
  and clears the selection ([the panel](../panel/README.md)). A refused draft
  outlives both presses.

A press that is the studio's is claimed from the browser, so a chord the
studio advertises does nothing else instead. A command with `available` is the
studio's only then: the diagram steps claim PageUp and PageDown while the model
holds more than one diagram, and leave them to scroll whatever has focus in a
model of one.

## The shortcut reference

`shortcut-reference.tsx` renders every command from `registry.ts` and every
contextual key from `contextual-shortcuts.ts`. Resize keys and distances come
from the canvas package, where the resize controls use them. The panel is
non-modal: opening it focuses its heading without trapping focus, and Escape
closes it only while focus is inside, returning focus to the opener. Complete
direction groups read as `Arrow Keys` or `Shift+Arrow`, and groups that accept
only some directions list those keys.

## Rules for changes

- Render a command through `CommandButton`, or `IconCommandButton` where the
  control is a glyph, or read `commandById` for a surface that draws its own
  control, as `../files/menu.tsx` does. Never hold a label or a chord beside a
  control: the menu, the toolbox, the panel and the zoom cluster read both from
  here.
- Add a command's words to the `commands` catalogue section in all three
  locales and store the id. A function that spells a chord or describes an
  entry takes the active translator, so the caller resolves at render.
- Bind a new command by adding an entry, not by adding a listener.
- Add a key that acts only inside one control to `contextual-shortcuts.ts`.
  Renderers, event handlers and accessible descriptions read it from there.
- The tool commands select a mode, and the toolbox reads those same entries for
  its icons, accessible names and tooltips. Space is Hand's momentary chord:
  the binding restores the prior tool on keyup, which a click has no keyup to
  answer.
