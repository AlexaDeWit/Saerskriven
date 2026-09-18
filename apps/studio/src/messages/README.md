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
| `locale.ts`                               | The chosen language, `activeTranslator` for code outside components, `useTranslator`, `useLanguage` |
| `message.tsx`                             | `Message`, which renders a message with element parameters                                          |

The sections so far are `canvas` (announcements), `notice` (the failure
notice) and `shell` (the language control and the browser tab's name). Most
studio text is still written in place in English.

## Adding a message

1. Declare it in the section's `contract.ts`, or add a section for a new
   surface and join it in `catalogues.ts`.
2. Write it in all three catalogues in the same change. The typecheck fails
   until every locale has it with the declared parameters and plural forms.
3. Mark new French and Swedish text in the pull request for review by a
   fluent speaker.

A sentence is one message with named parameters, never English fragments
joined together.

## Reading a message

A component reads `useTranslator().t(id, params)`, or renders
`<Message id params>` where a parameter is an element. Code outside a
component calls `activeTranslator().t(id, params)` when the text is needed.
Neither may run at module load, where the text would stay in the locale of
that moment.

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
