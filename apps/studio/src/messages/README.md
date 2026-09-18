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
| `locale.ts`                               | The chosen language, `activeTranslator` for code outside components, `useTranslator`, `useLanguage` |
| `message.tsx`                             | `Message`, which renders a message with element parameters                                          |
| `said.ts`                                 | `Said`, text worded when it is shown, and `sentences`, which joins complete sentences               |

| Section      | The surface it words                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| `canvas`     | Announcements, clipboard reports, React Flow's text and the resize controls     |
| `commands`   | Command labels, the context each runs in, the group headings, the key reference |
| `defaults`   | The names a newly created thing is given                                        |
| `divergence` | What a codec or an import could not carry                                       |
| `enums`      | The label each stored value is shown under                                      |
| `fields`     | What a control is called, drawn or spoken                                       |
| `menu`       | The burger menu, its submenus and the diagram switcher                          |
| `notice`     | The failure notice, each refused operation, and a text field's refusal          |
| `panel`      | The threat panel, the model's properties and the record groups                  |
| `reports`    | File reports, export reports and the file types an export offers                |
| `shell`      | The language control, the browser tab's name, the version, the stopped page     |
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

Exports are not the studio's text. The SVG, PNG, Markdown, Typst and PDF an
export writes are the same bytes in every language, including the severity
letters a badge carries, and the CLI's warning about undrawn flow ends stays
in `@saerskriven/render`. The studio words that warning itself, from the
endpoints the projection returns.

## Adding a message

1. Declare it in the section's `contract.ts`, or add a section for a new
   surface and join it in `catalogues.ts`.
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

## Choosing the language

The Language item in the menu offers each locale under its own name, plus
"Follow the browser", which is the state a first visit starts in. Following
the browser negotiates `navigator.languages` through
[`negotiate`](../../../../packages/i18n/README.md#negotiation), with en-CA as
the fallback, and negotiates again on the `languagechange` event. A chosen
locale is stored in `localStorage` under `saerskrivenLanguage`
([`../language-preference.ts`](../language-preference.ts)), and a stored value
that names no supported locale, or storage that is absent or throws, follows
the browser. `document.documentElement.lang` follows the active locale, and
`index.html` declares `en-CA` until the app script runs.

A change of language re-renders every reader of a message. It changes no model
state, so it never dirties the document or reaches the undo stacks, the
recovery snapshot or the other tabs.

Browser-owned prompts are the platform's text, not the studio's: the file
picker, the download dialog and the `beforeunload` question read in the
browser's own language, whatever the studio's is. The only browser-owned text
the studio decides is a label an API accepts from it, such as a suggested file
name.
