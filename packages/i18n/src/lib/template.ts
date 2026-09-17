/** The parameter names a template's `{name}` placeholders use. */
export type Placeholders<T extends string> =
  T extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

type HasBrace<T extends string> = T extends
  | `${string}{${string}`
  | `${string}}${string}`
  ? true
  : false;

/**
 * `true` for a template with a brace outside a `{name}` placeholder, or with
 * an empty or nested placeholder, the templates {@link templateParts} cannot
 * split the way {@link Placeholders} reads them.
 */
export type MalformedTemplate<T extends string> =
  T extends `${infer Before}{${infer Name}}${infer After}`
    ? HasBrace<Before> extends true
      ? true
      : Name extends ''
        ? true
        : HasBrace<Name> extends true
          ? true
          : MalformedTemplate<After>
    : HasBrace<T>;

const placeholder = /\{([^{}]+)\}/u;

/** A template split into literal text at even indexes and parameter names at odd ones. */
export function templateParts(template: string): readonly string[] {
  return template.split(placeholder);
}

/** Whether every brace in `template` belongs to a `{name}` placeholder. */
export function wellFormedTemplate(template: string): boolean {
  return templateParts(template).every(
    (part, index) => index % 2 === 1 || !/[{}]/u.test(part),
  );
}
