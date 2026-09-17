# @saerskriven/i18n

Typed messages over `Intl` for the studio's catalogues: the supported locales,
their plural categories, contract and catalogue declarations, a translator
with number and list formatting, and locale negotiation. It imports no
internal package and no React, and only an app imports it, so model data,
file formats and rendered exports stay independent of the reader's language.
The catalogues themselves belong to the app that shows them.

## Contracts and catalogues

A contract declares each message once, without text. `text()` takes no
parameters or a record of named parameter kinds, and `plural(count, params)`
adds a number parameter whose plural category picks the form:

```ts
export const canvasMessages = {
  'snap-on': text(),
  'diagram-shown': text({ title: 'text' }),
  'threat-count': plural('count', { name: 'text' }),
} as const;
```

A parameter is `text` (inserted as given), `number` (`Intl.NumberFormat`),
`list` (a conjunction through `Intl.ListFormat`) or `node` (a value the
caller renders, such as a React element). An app groups its contracts into
sections, and a message is addressed as `section.id`. A section name holds
no dot.

Each locale declares its catalogue against a contract with string literals:

```ts
export const canvasFrCA = catalogue(canvasMessages)('fr-CA')({
  'snap-on': 'Alignement sur la grille activé.',
  'diagram-shown': 'Affichage de « {title} ».',
  'threat-count': {
    one: '{name} a {count} menace',
    many: '{name} a {count} de menaces',
    other: '{name} a {count} menaces',
  },
});
```

The typecheck refuses:

- a message the contract declares and the catalogue lacks
- a message the contract does not declare
- a text template whose `{name}` placeholders differ from the declared
  parameters, or a plural form naming a parameter the message does not declare
- a plural form missing from the locale's categories, or one the locale does
  not have: fr-CA has `one`, `many` and `other`, and en-CA and sv have `one`
  and `other`
- a brace outside a placeholder, and a template that is not a string literal
- a wrong parameter name or type, or a missing parameter record, at a call

`src/lib/catalogue.spec.ts` keeps each refusal as an `@ts-expect-error` line,
so a change that stops refusing one fails the typecheck. A catalogue must go
through `catalogue()` for its templates to be checked.

French `one` covers 0 as well as 1, so a French `one` form reads correctly for
zero. `locales.spec.ts` pins the declared categories to `Intl.PluralRules`.

## Translating

`translator(sections, catalogues, locale)` gives:

- `t(id, params)`: the message as a string. It never returns `undefined` and
  never falls back to the id. A message with a `node` parameter is refused.
- `parts(id, params)`: the literal and formatted text with each `node`
  parameter as given, for a renderer that places nodes. A message without
  parameters takes `{}`.
- `number(value)` and `list(items)` in the locale's formats.

A parameter value is inserted as text and never read as template syntax, so a
name holding `{x}` or `<b>` stays literal. Messages carry no markup: a link or
emphasis is a `node` parameter.

`catalogueTemplates(catalogues)` lists every template with its locale, id and
plural form, and `wellFormedTemplate` checks one template's braces.

## Negotiation

`negotiate(tags)` takes language tags in preference order. It canonicalizes
each tag and skips an invalid one. The first tag whose language subtag is
`en`, `fr` or `sv` decides, whatever its region, script or extensions, and no
match gives en-CA. Every regional variant uses its language's one catalogue:
fr-FR, fr-BE and fr-CH read fr-CA, sv-FI reads sv, and en-US and en-GB read
en-CA. There is no fallback between languages, so `nb` reads en-CA.

## Limits

- A template cannot contain a literal brace.
- There is no select message and no nested plural.
- A translation pasted in English still compiles.
