# The studio's messages

The studio's text in en-CA, fr-CA and sv, declared through
[`@saerskriven/i18n`](../../../../packages/i18n/README.md). Framing is
translated and content is not: model data, names, descriptions and anything a
person typed reach a message as parameters and pass through unchanged.

## Modules

| Module                                    | What it holds                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `<section>/contract.ts`                   | One surface's messages and their parameters                                                         |
| `<section>/en-CA.ts`, `fr-CA.ts`, `sv.ts` | That surface's catalogue in each locale                                                             |
| `catalogues.ts`                           | The sections joined into the studio's contract, and every catalogue, bundled                        |
| `enum-labels.ts`                          | The message each stored value of the model is shown under                                           |
| `locale.ts`                               | The language: `activeLocale`, `activeTranslator` outside components, `useTranslator`, `useLanguage` |
| `message.tsx`                             | `Message`, which renders a message with element parameters                                          |
| `said.ts`                                 | `Said`, text worded when it is shown, and `sentences`, which joins complete sentences               |

| Section      | The surface it words                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| `canvas`     | Announcements, clipboard reports, React Flow's text and the resize controls     |
| `commands`   | Command labels, the context each runs in, the group headings, the key reference |
| `defaults`   | The names a newly created thing is given                                        |
| `divergence` | What a codec or an import could not carry                                       |
| `enums`      | The label of each stored value only the studio shows                            |
| `fields`     | What a control is called, drawn or spoken                                       |
| `menu`       | The burger menu, its submenus and the diagram switcher                          |
| `notice`     | The failure notice, each refused operation, and a text field's refusal          |
| `panel`      | The threat panel, the model's properties and the record groups                  |
| `reports`    | File reports, export reports and the file types an export offers                |
| `shell`      | The language control, the browser tab's name, the version, the stopped page     |
| `terms`      | Render's words for the stored values an export shows, and the badge marks       |
| `tools`      | The controls drawn over the canvas: zoom, placement, routes and endpoints       |

`divergence/text.ts` maps each divergence code `@saerskriven/formats` records
to its message, with the codec's parameters passed through. A divergence line
takes other messages' text as parameters: the subject, the detail and the
reason are each a complete phrase, and the `line` message owns their order
and punctuation. The canvas does the same with a name: `canvas.quoted` sets a
person's text in the reader's quotation marks, and an element without a name
is called by its kind (`enums.the-actor` and the like), so an announcement
takes either as one noun phrase.

## What stays in English

`../../index.html` is served before any script runs, so no language has been
negotiated when a reader sees it. Its `<title>`, its meta description, the
loading line "Loading the threat modelling studio." and the no-JavaScript line
"Enable JavaScript to use the interactive studio." are fixed en-CA. The app
replaces the title with `shell.landing-title` once it runs.

The starter document in [`../store/state.ts`](../store/state.ts) is the other
exception. It is built at module load, before a locale is negotiated, and what
it holds is model content the moment it exists: the `Untitled` model, its
`Untitled diagram`, the two elements it draws and the threat on them stay
en-CA, under the rule that a written name is never rewritten. A model the
studio starts from a file or a recovery snapshot carries that file's own
names, and everything created afterwards is named in the active language.

A file format's name, a path, a model's own names and descriptions, and
anything a person typed are data: they reach a message as parameters and pass
through unchanged. So do ids, a read limit's name, and the file name an open
or an import was given.

Some diagnostic text has no code to translate from, and a notice shows it as a
literal line under a headline in the reader's language:

- A model or schema parse issue (`issueLine` from `@saerskriven/model`): its
  path and the issue's own message, until #488 gives the issues codes.
- Text a browser raised: a refused file read or write, a refused storage
  access, a failed fetch of a compiler or font, and the error an unexpected
  render failure carries on the stopped page.
- Text a parser or compiler raised: the JSON or YAML parser's message for
  malformed text, the Typst compiler's sentences, and the rasterizer's.

## Exports and render's terms

An export is framed in the language active at the moment it runs. The SVG,
PNG, Markdown, Typst and PDF it writes are worded by `@saerskriven/render` in
that locale, and there is no language control at export time. The canvas
badges draw render's marks for the active locale, so the screen matches the
export, and a change of language redraws them. The studio words the
undrawn-flow warning itself, from the endpoints the projection returns.

The `terms` section is render's own catalogue, `termMessages` and
`termCatalogues`, joined to the studio's contract: a stored value an export
also shows, such as a severity, a status or a category, is labelled from
there, so each term has one home. `enums` keeps the labels only the studio
shows. Saving YAML or JSON writes the same bytes in every language, because
the wire formats keep the model's own values.

## Adding a message

1. Declare it in the section's `contract.ts`, or add a section for a new
   surface and join it in `catalogues.ts`. A term an export also shows goes
   in render's `terms` section instead.
2. Write it in all three catalogues in the same change. The typecheck fails
   until every locale has it with the declared parameters and plural forms.
3. Mark new French and Swedish text in the pull request for review by a
   fluent speaker.

A sentence is one message with named parameters, never English fragments
joined together. A stored value of the model is never drawn as its own label:
`enum-labels.ts` names the message each one is shown under, and `EnumField`
requires a `labelOf`.

## Reading a message

A component reads `useTranslator().t(id, params)`, or renders
`<Message id params>` where a parameter is an element. Code outside a
component calls `activeTranslator().t(id, params)` when the text is needed.
Neither may run at module load, where the text would stay in the locale of
that moment.

Text that stands after the event that made it, an announcement, a refusal or
a notice, is kept as data or as a `Said` and worded when it is shown, so a
change of language rewords it. `announce` takes a `Said`, a failure notice
and an export report are data that `describeFailure` and
`describeExportNotice` word on render, and a text field's refusal carries a
`Said` for what it shows and what it announces.

## Naming what is created

A default name is written in the active language at the moment the thing is
created, through `activeTranslator()`, and is model content from then on. A
later change of language renames nothing. `defaults` holds those names, and
`canvas/elements.ts`, `canvas/diagrams.ts` and `panel/threats.ts` resolve one
at creation.

The stem a save or export proposes for an unnamed document is not model
content, so it is not written once: `files/file-commands.ts` and
`files/export-commands.ts` resolve `defaults.untitled-file` and
`defaults.untitled-model` again each time a picker opens, and a later change
of language changes the next proposal.

`defaults.untitled-file` is a bare file stem in every locale: no path
separator, no dot, and none of the characters `< > : " / \ | ? *`, which some
platform's file picker refuses. An accented letter stays: the File System
Access API's `suggestedName` and the `download` attribute both accept one
without refusal, and `defaults.untitled-model`'s fr-CA and sv text already
reaches a file name the same way.

## Choosing the language

The Language item in the menu offers en-CA, fr-CA and sv, each under its own
name. A first visit has no stored locale, so the studio prefills the active
locale by negotiating `navigator.languages` through
[`negotiate`](../../../../packages/i18n/README.md#negotiation), with en-CA as
the fallback. That prefill is read once at start-up and is never written to
storage. A locale a reader picks from the menu is stored in `localStorage`
under `saerskrivenLanguage`
([`../language-preference.ts`](../language-preference.ts)) and wins over the
prefill from then on. A stored value that names no supported locale, or
storage that is absent or throws, prefills from the browser instead.
`document.documentElement.lang` follows the active locale, and `index.html`
declares `en-CA` until the app script runs.

A change of language re-renders every reader of a message. It changes no model
state, so it never dirties the document or reaches the undo stacks, the
recovery snapshot or the other tabs.

Browser-owned prompts are the platform's text, not the studio's: the file
picker, the download dialog and the `beforeunload` question read in the
browser's own language, whatever the studio's is. The only browser-owned text
the studio decides is a label an API accepts from it, such as a suggested file
name.
