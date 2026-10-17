import { z } from 'zod';
import { assumptionSchema } from './assumptions.js';
import { drawnElementSchema } from './drawn-elements.js';
import { elementSchema } from './elements.js';
import { diagramIdSchema } from './ids.js';
import { mitigationSchema } from './mitigations.js';
import { placementSchema } from './placements.js';
import { threatSchema } from './threats.js';
import { acceptedTextSchema } from './text.js';

/**
 * Facts about the model as a whole: what it covers and who answers for it.
 * Every text may be empty, so a model saves before it is described.
 * `contributors` holds one name per entry.
 */
export const modelMetadataSchema = z.object({
  title: acceptedTextSchema,
  owner: acceptedTextSchema,
  description: acceptedTextSchema,
  contributors: z.array(acceptedTextSchema),
});

/** Model metadata. */
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

/** Model metadata as {@link modelMetadataSchema} accepts it. */
export type ModelMetadataInput = z.input<typeof modelMetadataSchema>;

/** A change to model metadata: the fields it names replace the held ones. */
export const modelMetadataChangeSchema = modelMetadataSchema.partial();

/** A change to model metadata. */
export type ModelMetadataChange = z.infer<typeof modelMetadataChangeSchema>;

/**
 * One diagram: a titled canvas holding placements of the model's elements,
 * in the order they are drawn. Diagram ids must be unique across the model,
 * a placement must name an element the model holds, and an element is
 * placed at most once in the whole model. parseModel enforces all three, so
 * this schema alone accepts duplicates and dangling ids.
 */
export const diagramSchema = z.object({
  id: diagramIdSchema,
  title: acceptedTextSchema,
  placements: z.array(placementSchema),
});

/** One diagram of a model. */
export type Diagram = z.infer<typeof diagramSchema>;

/** One diagram as {@link diagramSchema} accepts it. */
export type DiagramInput = z.input<typeof diagramSchema>;

/**
 * The structural shape of a threat model root: metadata, elements, diagrams,
 * threats, mitigations, and assumptions. Every array may be empty: a model
 * saves before it is drawn or analyzed. `lastIssuedThreatNumber` is the
 * highest threat number the model has ever issued or kept by a paste, 0
 * before the first, and it counts removed threats: removing a threat leaves
 * a gap no new threat fills, and only a pasted threat carrying that number
 * can take it back (`insertFragment`). Cross-record checks (id and
 * threat-number uniqueness, placements, reference resolution, and no threat
 * number above the last issued) are parseModel's refinements, so this schema
 * alone accepts duplicates, dangling ids, and a mark below a threat it
 * holds. Internal to the package: parseModel is the only exported way a
 * Model value comes into existence.
 */
export const modelSchema = z.object({
  metadata: modelMetadataSchema,
  elements: z.array(elementSchema),
  diagrams: z.array(diagramSchema),
  threats: z.array(threatSchema),
  lastIssuedThreatNumber: z.int().nonnegative(),
  mitigations: z.array(mitigationSchema),
  assumptions: z.array(assumptionSchema),
});

/** A whole model as `parseModel` takes it, before its cross-record checks. */
export type ModelInput = z.input<typeof modelSchema>;

/** One diagram owning its elements, each with its geometry inline. */
export const drawnDiagramSchema = diagramSchema
  .omit({ placements: true })
  .extend({ elements: z.array(drawnElementSchema) });

/** One diagram as {@link drawnDiagramSchema} accepts it. */
export type DrawnDiagramInput = z.input<typeof drawnDiagramSchema>;

/**
 * A model whose diagrams own their elements, each element drawn on the one
 * diagram that holds it: the shape a file format with no shared elements
 * reads into, which `parseDrawnModel` takes.
 */
export const drawnModelSchema = modelSchema
  .omit({ elements: true })
  .extend({ diagrams: z.array(drawnDiagramSchema) });

/** A model as {@link drawnModelSchema} accepts it. */
export type DrawnModelInput = z.input<typeof drawnModelSchema>;
