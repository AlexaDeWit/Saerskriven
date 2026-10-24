import { z } from 'zod';

export const pathReach =
  'Relative to the server root, or absolute. Outside-root paths require a host-listed directory.';

export const defaultedFileSentence =
  "Omit `file` to use the server's default model.";

export const fileArgumentSchema = z.object({
  file: z
    .string()
    .optional()
    .describe(
      `Path to the model file. ${pathReach} Omit to use the default model.`,
    ),
});
