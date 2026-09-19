# @saerskriven/i18n

Typed messages over `Intl` for the studio's and the exports' catalogues: the
supported locales, their plural categories, contract and catalogue
declarations, a translator with number and list formatting, and locale
negotiation. It imports no internal package and no React. Only an app and
`@saerskriven/render` import it, so model data and file formats stay
independent of the reader's language, and an export takes its language as a
parameter. The catalogues themselves belong to the package that shows them.

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
sections, and a message is addressed as `section.id`. The typecheck refuses
a section name holding a dot.

Each locale declares its catalogue against a contract with string literals:

```ts
export const canvasFrCA = catalogue(canvasMessages)('fr-CA')({
  'snap-on': 'Alignement sur la grille activé.',
  'diagram-shown': 'Affichage de « {title} ».',
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
  parameters
- a plural form naming a parameter the message does not declare, or leaving
  out one it does. Only the count may be left out, as in `One threat`
- a plural form missing from the locale's categories, or one the locale does
  not have: fr-CA has `one`, `many` and `other`, and en-CA and sv have `one`
  and `other`
- a brace outside a placeholder, and a template that is not a string literal
- a catalogue object written by hand instead of through `catalogue()`
- a section name holding a dot
- a wrong parameter name or type, or a missing parameter record, at a call

`src/lib/catalogue.spec.ts` keeps each refusal as an `@ts-expect-error` line,
so a change that stops refusing one fails the typecheck.

French `one` covers 0 as well as 1, so a French `one` form also serves as the
zero form. `locales.spec.ts` pins the declared categories to `Intl.PluralRules`.

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
`sameAsDefault(catalogues)` lists the fr-CA and sv templates that read exactly
as en-CA's for the same message and form, for a report rather than a refusal.

## Pseudo-locale

`pseudoTranslator(sections, catalogues)` reads the en-CA catalogues through
`pseudoText`: each literal run of a template is accented, lengthened by two
fifths and set between the `pseudoMarkers`, `⟦` and `⟧`, and each parameter
value passes through unmarked. Text shown without the markers came from
outside the catalogues or is data, and the lengthening stands in for a longer
language. It is for development: it adds no locale, and a catalogue still
compiles only when every real locale has every message. The studio reads it
when its development server is opened with `?pseudo-locale`
([the studio's messages](../../apps/studio/src/messages/README.md#adding-or-changing-a-message)).

## Negotiation

`negotiate(tags)` takes language tags in preference order. It canonicalizes
each tag and skips an invalid one. The first tag whose language subtag is
`en`, `fr` or `sv` decides, whatever its region, script or extensions, and no
match gives en-CA. Every regional variant uses its language's one catalogue:
fr-FR, fr-BE and fr-CH read fr-CA, sv-FI reads sv, and en-US and en-GB read
en-CA. There is no fallback between languages, so `nb` reads en-CA.

`supportedLocale(tag)` is `negotiate`'s per-tag match, for a caller that
needs to tell a matched tag from a default: it gives the same locale for a
matching tag and undefined rather than en-CA for one that matches nothing.
The CLI's `--lang` refuses on that undefined rather than negotiating it away.

## Limits

- A template cannot contain a literal brace.
- There is no select message and no nested plural.
- A translation pasted in English still compiles.
