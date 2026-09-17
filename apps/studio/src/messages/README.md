# The studio's messages

The studio's text in en-CA, fr-CA and sv, declared through
[`@saerskriven/i18n`](../../../../packages/i18n/README.md). Framing is
translated and content is not: model data, names, descriptions and anything a
person typed reach a message as parameters and pass through unchanged.

## Modules

| Module                                    | What it holds                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `<section>/contract.ts`                   | One surface's messages and their parameters                                        |
| `<section>/en-CA.ts`, `fr-CA.ts`, `sv.ts` | That surface's catalogue in each locale                                            |
| `catalogues.ts`                           | The sections joined into the studio's contract, and every catalogue, bundled       |
| `locale.ts`                               | The active locale, `activeTranslator` for code outside components, `useTranslator` |
| `message.tsx`                             | `Message`, which renders a message with element parameters                         |

The sections so far are `canvas` (announcements) and `notice` (the failure
notice). Most studio text is still written in place in English.

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

The locale is negotiated from `navigator.languages` on first use, with en-CA
as the fallback, and `chooseLocale` changes it. The studio has no control
that calls `chooseLocale` yet.
