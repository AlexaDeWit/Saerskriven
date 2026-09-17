/**
 * How a parameter reaches the text: `text` as given, `number` through
 * `Intl.NumberFormat`, `list` through a conjunction `Intl.ListFormat`, and
 * `node` as a value the caller renders, such as a React element.
 */
export type ParameterKind = 'text' | 'number' | 'list' | 'node';

export type ParameterShape = { readonly [name: string]: ParameterKind };

type NoParameters = Record<never, ParameterKind>;

export type TextMessage<P extends ParameterShape = ParameterShape> = {
  readonly kind: 'text';
  readonly params: P;
};

export type PluralMessage<
  P extends ParameterShape = ParameterShape,
  C extends string = string,
> = {
  readonly kind: 'plural';
  readonly count: C;
  readonly params: P;
};

export type MessageSpec = TextMessage | PluralMessage;

/** The locale-neutral declaration of one section's messages and their parameters. */
export type Contract = { readonly [id: string]: MessageSpec };

/**
 * A contract per section. A message is addressed as `section.id`, so a
 * section name holds no dot and two sections cannot declare the same message.
 */
export type Sections = { readonly [section: string]: Contract };

/** A message with no parameters, or with the named ones. */
export function text(): TextMessage<NoParameters>;
export function text<const P extends ParameterShape>(params: P): TextMessage<P>;
export function text(params: ParameterShape = {}): TextMessage {
  return { kind: 'text', params };
}

type Counted<P extends ParameterShape, C extends string> = P & {
  readonly [K in C]: 'number';
};

/**
 * A message whose form follows the plural category of the number parameter
 * `count` names. Its forms may leave out any parameter, the count included.
 */
export function plural<const C extends string>(
  count: C,
): PluralMessage<Counted<NoParameters, C>, C>;
export function plural<const C extends string, const P extends ParameterShape>(
  count: C,
  params: P,
): PluralMessage<Counted<P, C>, C>;
export function plural(
  count: string,
  params: ParameterShape = {},
): PluralMessage {
  return { kind: 'plural', count, params: { ...params, [count]: 'number' } };
}
