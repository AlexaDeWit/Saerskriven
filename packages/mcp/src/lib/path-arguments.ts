import { z } from 'zod';

/**
 * Where a path argument may point, as every such argument's description says
 * it.
 */
export const pathReach =
  'Relative to the server root, or absolute. A path outside the root is accepted only inside a directory the host lists.';

/**
 * What a tool description says of a `file` that falls back to the server's
 * default model.
 */
export const defaultedFileSentence =
  'Pass `file` as the path to the model, or leave it out where the server was started with a default model.';

/**
 * The `file` argument of every tool that reads a model, which each such
 * tool's own argument schema extends. `saer_create` and `saer_import` name
 * their files with arguments of their own.
 */
export const fileArgumentSchema = z.object({
  file: z
    .string()
    .optional()
    .describe(
      `Path to the model file. ${pathReach} Optional when the server was started with a default file.`,
    ),
});
