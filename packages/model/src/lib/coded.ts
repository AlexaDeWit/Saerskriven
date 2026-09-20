import { z } from 'zod';

/** One member of a coded union that carries no data beside its code. */
export const coded = <const C extends string>(code: C) =>
  z.object({ code: z.literal(code) });

/** One member of a coded union, with the parameters that code needs. */
export const carrying = <const C extends string, const P extends z.ZodRawShape>(
  code: C,
  parameters: P,
) => z.object({ code: z.literal(code), parameters: z.object(parameters) });
