import { renderThemeSchema } from '@saerskriven/canvas';
import { z } from 'zod';

/**
 * Heading controls shared by every register writer: whether the title heading
 * is written, and the level of the first heading that is.
 */
export const registerOptionsSchema = z.object({
  title: z.boolean().optional(),
  headingLevel: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .optional(),
});

const markdownOptionsSchema = registerOptionsSchema.extend({
  theme: renderThemeSchema.optional(),
  styled: z.boolean().optional(),
  stylesheet: z.boolean().optional(),
});

/** Heading controls shared by portable and styled registers. */
export type RegisterOptions = z.infer<typeof registerOptionsSchema>;

/**
 * The Markdown register's options: the heading controls, and for styled
 * output the theme and whether the scoped stylesheet is written. None of them
 * changes what the register says.
 */
export type MarkdownOptions = z.infer<typeof markdownOptionsSchema>;
