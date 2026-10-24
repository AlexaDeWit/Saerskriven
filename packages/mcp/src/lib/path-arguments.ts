import { z } from 'zod';

/**
 * Where a path argument may point, as every such argument's description says
 * it.
 */
export const pathReach =
  'Relative to the server root, or absolute. Outside-root paths require a host-listed directory.';

/**
 * What a tool description says of a `file` that falls back to the server's
 * default model.
 */
export const defaultedFileSentence =
  "Omit `file` to use the server's default model.";

/** Model path with the server default as fallback. */
export const fileArgumentSchema = z.object({
  file: z
    .string()
    .optional()
    .describe(
      `Path to the model file. ${pathReach} Omit to use the default model.`,
    ),
});
