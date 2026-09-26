import { z } from 'zod';

/** One member of a coded union that carries no data beside its code. */
export const coded = <const C extends string>(code: C) =>
  z.object({ code: z.literal(code) });

/** One member of a coded union, with the parameters that code needs. */
export const carrying = <const C extends string, const P extends z.ZodRawShape>(
  code: C,
  parameters: P,
) => z.object({ code: z.literal(code), parameters: z.object(parameters) });

/** Every code a union of {@link coded} and {@link carrying} members declares, in order. */
export const codesOf = <const C extends string>(union: {
  readonly options: readonly {
    readonly shape: { readonly code: { readonly value: C } };
  }[];
}): C[] => union.options.map((option) => option.shape.code.value);
