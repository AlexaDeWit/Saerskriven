import { z } from 'zod';

const reference = z.int().nonnegative();
const field = z.object({ name: z.string(), layout: reference });
const layout = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('object'), fields: z.array(field) }),
  z.object({ kind: z.literal('array'), element: reference }),
  z.object({ kind: z.literal('optional'), value: reference }),
  z.object({
    kind: z.literal('variant'),
    discriminator: z.string(),
    options: z.array(reference),
  }),
  z.object({ kind: z.literal('enum'), values: z.array(z.string()) }),
  z.object({
    kind: z.literal('literal'),
    value: z.union([z.string(), z.number()]),
  }),
  z.object({ kind: z.literal('string') }),
  z.object({ kind: z.literal('number') }),
  z.object({ kind: z.literal('boolean') }),
]);

/** A descriptor whose references reach only the frozen layout table. */
export type CompactLayout = z.infer<typeof layout>;
