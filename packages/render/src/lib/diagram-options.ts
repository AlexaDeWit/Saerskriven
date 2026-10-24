import { z } from 'zod';

/** Visibility controls for diagram exports, independent of the threat register. */
export const diagramOptionsSchema = z.object({
  showThreatLabels: z.boolean().optional(),
});

/** Diagram exports show threat labels unless explicitly disabled. */
export type DiagramOptions = z.infer<typeof diagramOptionsSchema>;
