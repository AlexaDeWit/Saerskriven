import { z } from 'zod';
import { elementIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/** The facts every element holds, whatever its kind. */
export const elementBaseSchema = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema,
  outOfScope: z.boolean(),
  reasonOutOfScope: acceptedTextSchema,
});
