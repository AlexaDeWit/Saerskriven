import type { Contract, MessageSpec, Sections } from './contract.js';
import { locales, type Locale, type PluralCategory } from './locales.js';
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

/**
 * Each entry of `T` as written where the contract accepts it, and a type it
 * cannot satisfy, naming the problem, where not. A text message names
 * exactly its parameters, a plural form names a subset of them, and a
 * message or plural form `T` lacks is a missing property. An id outside the
 * contract and a form outside the locale's plural categories are `never`.
 */
type Checked<L extends Locale, C extends Contract, T> = {
  readonly [Id in keyof T]: Id extends keyof C
    ? C[Id] extends { readonly kind: 'plural' }
      ? {
          readonly [F in keyof T[Id]]: F extends PluralCategory<L>
            ? CheckedTemplate<T[Id][F], ParameterName<C[Id]>, false>
            : never;
        } & {
          readonly [F in Exclude<PluralCategory<L>, keyof T[Id]>]: string;
        }
      : CheckedTemplate<T[Id], ParameterName<C[Id]>, true>
    : never;
} & { readonly [Id in Exclude<keyof C, keyof T>]: Entry<L, C[Id]> };

/**
 * One locale's complete catalogue for one section's contract, as
 * {@link catalogue} declares it.
 */
export type Catalogue<L extends Locale, C extends Contract> = {
  readonly locale: L;
  readonly messages: { readonly [Id in keyof C]: Entry<L, C[Id]> };
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
 * missing message, an id outside the contract, a missing or extra plural
 * form, a template whose placeholders differ from the parameters, a
 * malformed brace, and a template that is not a string literal.
 */
export const catalogue =
  <C extends Contract>(_contract: C) =>
  <L extends Locale>(locale: L) =>
  <const T extends Draft>(
    messages: T & Checked<L, C, T>,
  ): { readonly locale: L; readonly messages: T } => ({ locale, messages });

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
