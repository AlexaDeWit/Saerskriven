import type { Contract, MessageSpec, Sections } from './contract.js';
import {
  defaultLocale,
  locales,
  type Locale,
  type PluralCategory,
} from './locales.js';
import type { MalformedTemplate, Placeholders } from './template.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type ParameterName<M extends MessageSpec> = keyof M['params'] & string;

type Entry<L extends Locale, M extends MessageSpec> = M extends {
  readonly kind: 'plural';
}
  ? { readonly [C in PluralCategory<L>]: string }
  : string;

type PlaceholderMismatch<Expected, Found> = {
  readonly 'placeholders expected': Expected;
  readonly 'placeholders found': Found;
};

type CheckedTemplate<
  T,
  Allowed extends string,
  Exact extends boolean,
> = T extends string
  ? string extends T
    ? { readonly 'a literal template is required': never }
    : MalformedTemplate<T> extends true
      ? T & { readonly 'a brace outside a {name} placeholder': never }
      : Exact extends true
        ? Same<Placeholders<T>, Allowed> extends true
          ? T
          : T & PlaceholderMismatch<Allowed, Placeholders<T>>
        : [Placeholders<T>] extends [Allowed]
          ? T
          : T & PlaceholderMismatch<Allowed, Placeholders<T>>
  : never;

type NamesEveryParameter<T, Required extends string, Declared> = [
  Required,
] extends [Placeholders<T & string>]
  ? unknown
  : PlaceholderMismatch<Declared, Placeholders<T & string>>;

type Checked<L extends Locale, C extends Contract, T> = {
  readonly [Id in keyof T]: Id extends keyof C
    ? C[Id] extends { readonly kind: 'plural'; readonly count: infer Count }
      ? {
          readonly [F in keyof T[Id]]: F extends PluralCategory<L>
            ? CheckedTemplate<T[Id][F], ParameterName<C[Id]>, false> &
                NamesEveryParameter<
                  T[Id][F],
                  Exclude<ParameterName<C[Id]>, Count>,
                  ParameterName<C[Id]>
                >
            : never;
        } & {
          readonly [F in Exclude<PluralCategory<L>, keyof T[Id]>]: string;
        }
      : CheckedTemplate<T[Id], ParameterName<C[Id]>, true>
    : never;
} & { readonly [Id in Exclude<keyof C, keyof T>]: Entry<L, C[Id]> };

const checked: unique symbol = Symbol('catalogue');

/** What {@link catalogue} returns: the messages as written, marked as checked. */
export type DeclaredCatalogue<L extends Locale, T> = {
  readonly locale: L;
  readonly messages: T;
  readonly [checked]: true;
};

/**
 * One locale's complete catalogue for one section's contract. Only
 * {@link catalogue} makes one, so every template in it has been checked.
 */
export type Catalogue<L extends Locale, C extends Contract> = {
  readonly locale: L;
  readonly messages: { readonly [Id in keyof C]: Entry<L, C[Id]> };
  readonly [checked]: true;
};

/** Every locale's catalogue for every section. */
export type Catalogues<S extends Sections> = {
  readonly [L in Locale]: { readonly [K in keyof S]: Catalogue<L, S[K]> };
};

type Draft = {
  readonly [id: string]: string | { readonly [form: string]: string };
};

/**
 * Declares `locale`'s catalogue for `contract`. The typecheck refuses a
 * missing message, an id outside the contract, and a missing or extra plural
 * form. A text template names exactly the declared parameters. A plural form
 * names every declared parameter except the count, which it may leave out.
 * A brace outside a `{name}` placeholder and a template that is not a string
 * literal are refused too.
 */
export const catalogue =
  <C extends Contract>(_contract: C) =>
  <L extends Locale>(locale: L) =>
  <const T extends Draft>(
    messages: T & Checked<L, C, T>,
  ): DeclaredCatalogue<L, T> => ({ locale, messages, [checked]: true });

/** One template a catalogue holds, `form` naming the plural form it is. */
export type CatalogueTemplate = {
  readonly locale: Locale;
  readonly id: string;
  readonly form: string | undefined;
  readonly template: string;
};

/** Every template in `catalogues`, with the `section.id` it serves. */
export function catalogueTemplates<S extends Sections>(
  catalogues: Catalogues<S>,
): readonly CatalogueTemplate[] {
  return locales.flatMap((locale) => {
    const sections: Readonly<Record<string, { readonly messages: Draft }>> =
      catalogues[locale];
    return Object.entries(sections).flatMap(([section, { messages }]) =>
      Object.entries(messages).flatMap(
        ([message, entry]): readonly CatalogueTemplate[] => {
          const id = `${section}.${message}`;
          return typeof entry === 'string'
            ? [{ locale, id, form: undefined, template: entry }]
            : Object.entries(entry).map(([form, template]) => ({
                locale,
                id,
                form,
                template,
              }));
        },
      ),
    );
  });
}

/**
 * Every template outside the default locale that reads exactly as the en-CA
 * template for the same message and plural form, a form en-CA does not have
 * compared with its `other`. Some are right as they stand, such as a product
 * name or a word both languages share, so this is a list to read, not a
 * refusal.
 */
export function sameAsDefault<S extends Sections>(
  catalogues: Catalogues<S>,
): readonly CatalogueTemplate[] {
  const templates = catalogueTemplates(catalogues);
  const english = new Map(
    templates
      .filter(({ locale }) => locale === defaultLocale)
      .map(({ id, form, template }) => [`${id} ${form ?? ''}`, template]),
  );
  return templates.filter(
    ({ locale, id, form, template }) =>
      locale !== defaultLocale &&
      template ===
        (english.get(`${id} ${form ?? ''}`) ?? english.get(`${id} other`)),
  );
}
