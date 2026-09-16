# Studio UI components

Behaviour comes from [Radix](https://www.radix-ui.com/) headless primitives,
imported from the single `radix-ui` package, and nothing here adopts a
component kit. Styling is a CSS module per component, drawing every colour,
space and radius from the design tokens, with Radix state read through its own
`data-state` and `data-highlighted` attributes rather than through classes a
component would have to keep in step. No CSS-in-JS, no Tailwind, and no second
stylesheet.

## Tokens

The values are the canvas package's `tokens.ts`
([the visual system](../../../../packages/canvas/README.md#the-visual-system)),
projected as the `--pn-*` custom properties `tokenStylesheet` writes into the
document head through [`../../initial-page.mts`](../../initial-page.mts). The
browser receives that sheet before the app script, so the loading indicator
and the diagram use the same canvas ground. A blocking script beside the sheet
applies a saved Light or Dark choice before the first paint, and
[`../theme.tsx`](../theme.tsx) applies later choices by setting
`data-pn-colour-mode` on the document root. The choice persists in
`localStorage` under `saerskrivenColourMode`, and invalid or unavailable stored
data selects System. A colour written into another stylesheet is a failing
spec, `../theme.spec.tsx`, which walks the production files of this app and of
the canvas package for one.

Every colour token is declared for the light table, again under
`prefers-color-scheme: dark` from the dark table, and again under each forced
mode. That is the whole of dark mode: a control reads the same property either
way and no component asks which mode it is in. The type scale, spacing, radius
and focus ring are declared once. Every colour role has a property whether a
control reads it yet or not, so the light and the dark blocks stay one list.

Several properties are read by both the chrome and the diagram: the raised
surface is a panel in the chrome and the fill inside every element outline,
the canvas colour is the ground and the halo cut under a flow name, and the
two inks letter both. The actor and process washes, the badge ground and the
severity tones are the diagram's own, and the threat summary uses the same
tone classes as the canvas. `--pn-chrome-block-size` and
`--pn-chrome-reports-block-size` are placeholders the chrome card
(`../app/chrome.tsx`) overwrites with the measured heights of the card and the
notices under it, and `--pn-pane-block-start` adds those to the fixed
`--pn-announcement-slot`.

A control never suppresses the focus indicator and never invents its own: it
applies the focus tokens in `:focus-visible`, swapping the ring's colour only
where the accent is the background it would be drawn on.

## Adding a control

1. Take the primitive from `radix-ui`, and read its options from the model
   rather than retyping them.
2. Add a CSS module beside it, built from the tokens.
3. Give it a visible `<label>` tied to the primitive's own control element.
4. Keep an overlay inside the control's own element rather than letting the
   primitive send it to the document body, so it sits in whichever landmark
   the panel declares.
5. Add a spec beside it.

## What a composed control owes

The primitive underneath is not the bar, the component here is. Every control
carries a label association, a keyboard path from Tab through commit, and the
role a screen reader expects, and a spec proves all three. `jsx-a11y` in
`.oxlintrc.json` is the static half of that, and the axe-core run in
`apps/studio-e2e` is the runtime half, auditing the page at rest and every
open overlay in its own scope.

A control takes its value as a prop and reports an edit through one commit
callback, so the edit becomes a store action and is undoable. No form library
holds it and no control holds model state of its own. A commit that would not
change the value dispatches nothing ([the commit
rule](../panel/README.md#the-commit-rule)).

`EnumField` is the worked example, and `SeverityField`, `StatusField` and
`CategoryField` are it three times: each reads its options from a model
schema, so the field offers what the model names and nothing else. It accepts
a `labelOf` function when an option stores an ID but shows a name, and that
function can return an `OptionText`: a `suffix` that tells two like labels
apart, drawn on its own line so the cut below cannot hide it, and a `detail`
line under the option that becomes its accessible description. The trigger
and each option draw at most two lines of their label, so a long label cannot
grow the trigger past the room its listbox needs, and a caller can cut the
trigger shorter. The accessible name is still the whole label and its suffix.
A field with no `value` shows its `placeholder`, and its first option keeps
the listbox's tab stop. The listbox is placed and sized within the box the
field scrolls in, the panel body, so it opens clear of the chrome card and the
pane header.

`EnumField`, `TextField` and `ProseField` take a `shownLabel` that draws a
shorter label, or none, where the surroundings already say what the field is.
The control keeps `label` as its accessible name, and a refusal still names
the field by it.

A text field is the one control that holds anything: what is typed is its own
until it is committed, which is what keeps text the model refuses on screen to
be corrected. It commits when it is left rather than as it is typed, and it
follows the value it is given whenever that value moves, which is how an undo
lands in a field a person is looking at. Every change to whether the model is
refusing what it holds is reported through a second callback, because a
refusal shown in the field alone is one nothing announces and nothing can keep
on screen. The field shows the character clause alone, the label above it
already naming the field, and the sentence the callback carries names the
field and goes with the text. A field can be opened on a draft reported that
way, which is how the threat panel puts a refused draft back after the panel
itself has been unmounted ([the panel](../panel/README.md)).

`ProseField` starts at eight lines and grows with its text to 24, or starts at
two and grows to ten when `compact`, as the record cards use it. Past its bound
it scrolls, and it keeps manual vertical resizing. CSS `field-sizing: content`
does the growing where the browser supports it (`sizesFieldsToContent`).
Elsewhere, Firefox among them, `growUnlessResized` sets the height from the
text after each render through `growToContent`, which the canvas rename field
also uses, under the same CSS bounds. Once a person drags the resize handle,
the field keeps that height and stops growing.

## What is here that is not a control

`LiveRegion` is the one way anything here announces. An unnamed use is an
atomic polite status whose empty host stays mounted before and after each
message, so assistive technology observes later content changes. A transient
edit status ends at the next action that moves canvas or panel state, on the
store's subscription ([the store](../store/README.md#the-shape)), and repeated
words use a new sequence key to announce again. A named use holds durable
feedback.

`FailureNotice` renders `StudioFailure` inside a named region, whatever
produced it, so one region shows the model refusing an edit, a codec refusing a
file, and the platform refusing to hand one over. It words every variant, and
keeps a codec's paths because they say which line of a file was refused. Its
Dismiss button dispatches `Action.DismissFailure` rather than taking a
callback. Several paths fold behind a disclosure naming how many there are
(`DetailLines`, which the file reports use too), so a refusal naming a path per
line does not fill a phone screen. `FailureNotice`, inline field errors and the
loss report stand until the state they describe resolves or the person
dismisses them, never on a timer.

`ErrorBoundary` is the last stop for a throw from anywhere below it, and is a
class because React offers no other way to catch one. It holds the only
component state in this directory for that reason, and needs no live region,
because it replaces the tree it was guarding rather than announcing into it.

`external-store.ts` is the subscription helper every module-level store in the
studio shares: the module holds a value, calls `notify` after it moves, and
components read it through `use`, which wraps `useSyncExternalStore`.
`close-focus.ts` keeps a closed Radix dropdown from taking focus back to its
trigger once focus has moved on, and `measure.ts` reads an element's size in a
layout effect and on every resize.
