import type { Catalogues, ParameterName } from './catalogue.js';
import type {
  Contract,
  MessageSpec,
  ParameterKind,
  Sections,
} from './contract.js';
import type { Locale } from './locales.js';
import { templateParts } from './template.js';

/** Every `section.id` the sections declare. */
export type MessageId<S extends Sections> = {
  readonly [K in keyof S & string]: `${K}.${keyof S[K] & string}`;
}[keyof S & string];

/** The declaration of the message `Id` addresses. */
export type MessageOf<
  S extends Sections,
  Id extends string,
> = Id extends `${infer K}.${infer M}`
  ? K extends keyof S
    ? M extends keyof S[K]
      ? S[K][M]
      : never
    : never
  : never;

type Value<K extends ParameterKind, Node> = K extends 'text'
  ? string
  : K extends 'number'
    ? number
    : K extends 'list'
      ? readonly string[]
      : Node;

/** The parameter record a message takes, `node` parameters typed as `Node`. */
export type ParameterValues<M extends MessageSpec, Node> = {
  readonly [P in ParameterName<M>]: Value<M['params'][P], Node>;
};

/** The arguments after the id: none for a message without parameters, its record otherwise. */
export type MessageArguments<M extends MessageSpec, Node> = [
  ParameterName<M>,
] extends [never]
  ? []
  : [params: ParameterValues<M, Node>];

/** Ids of the messages that resolve to a string: those without a `node` parameter. */
export type TextMessageId<S extends Sections> = {
  readonly [Id in MessageId<S>]: 'node' extends MessageOf<
    S,
    Id
  >['params'][keyof MessageOf<S, Id>['params']]
    ? never
    : Id;
}[MessageId<S>];

/** Messages resolved in one locale, with its number and list formatting. */
export type Translator<S extends Sections> = {
  readonly locale: Locale;
  /** The message as text. */
  readonly t: <Id extends TextMessageId<S>>(
    id: Id,
    ...args: MessageArguments<MessageOf<S, Id>, never>
  ) => string;
  /**
   * The message as literal and formatted text, with each `node` parameter as
   * given, for a renderer that places nodes. A message without parameters
   * takes `{}`.
   */
  readonly parts: <Id extends MessageId<S>>(
    id: Id,
    params: ParameterValues<MessageOf<S, Id>, unknown>,
  ) => readonly unknown[];
  readonly number: (value: number) => string;
  readonly list: (items: readonly string[]) => string;
};

type Forms = { readonly other: string } & Partial<
  Record<Intl.LDMLPluralRule, string>
>;

type Values = Readonly<Record<string, unknown>>;

const isText = (value: unknown): value is string => typeof value === 'string';

const addressed = (
  id: string,
): { readonly section: string; readonly message: string } => {
  const dot = id.indexOf('.');
  return { section: id.slice(0, dot), message: id.slice(dot + 1) };
};

type DotFree<S> = {
  readonly [K in keyof S]: K extends `${string}.${string}`
    ? { readonly 'a section name holds no dot': never }
    : S[K];
};

/**
 * The translator for `locale` over complete catalogues. Parameter values are
 * inserted as they are and never read as template syntax.
 */
export function translator<S extends Sections>(
  sections: S & DotFree<S>,
  catalogues: Catalogues<S>,
  locale: Locale,
): Translator<S> {
  const numbers = new Intl.NumberFormat(locale);
  const lists = new Intl.ListFormat(locale, { type: 'conjunction' });
  const plurals = new Intl.PluralRules(locale);
  const contracts: Readonly<Record<string, Contract>> = sections;
  const entries: Readonly<
    Record<
      string,
      { readonly messages: Readonly<Record<string, string | Forms>> }
    >
  > = catalogues[locale];

  const number = (value: number): string => numbers.format(value);
  const list = (items: readonly string[]): string => lists.format(items);

  const formatted = (
    kind: ParameterKind | undefined,
    value: unknown,
  ): unknown =>
    kind === 'number' && typeof value === 'number'
      ? number(value)
      : kind === 'list' && Array.isArray(value)
        ? list(value.filter(isText))
        : value;

  const template = (id: string, values: Values): string => {
    const { section, message } = addressed(id);
    const spec = contracts[section][message];
    const entry = entries[section].messages[message];
    if (typeof entry === 'string') {
      return entry;
    }
    const count = spec.kind === 'plural' ? values[spec.count] : undefined;
    return (
      entry[plurals.select(typeof count === 'number' ? count : 0)] ??
      entry.other
    );
  };

  const parts = (id: string, values: Values): readonly unknown[] => {
    const { section, message } = addressed(id);
    const kinds: Readonly<Record<string, ParameterKind | undefined>> =
      contracts[section][message].params;
    return templateParts(template(id, values)).map((part, index) =>
      index % 2 === 0 ? part : formatted(kinds[part], values[part]),
    );
  };

  const t = (id: string, values: Values = {}): string =>
    parts(id, values)
      .map((part) => (isText(part) ? part : ''))
      .join('');

  return { locale, number, list, parts, t };
}
