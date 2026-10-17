import {
  acceptedTextSchema,
  accentField,
  accentSchema,
  autoExtent,
  autoPlacement,
  boundaryPlacementSchema,
  diagramIdSchema,
  drawnActorSchema,
  drawnFlowSchema,
  drawnProcessSchema,
  drawnStoreSchema,
  drawnTextSchema,
  drawnTrustBoundarySchema,
  elementIdSchema,
  elementPropertiesSchema,
  flowPlacementSchema,
  nodePlacementSchema,
  waypointsSchema,
  type DrawnElement,
  type ElementProperties,
  type Placement,
} from '@saerskriven/model';
import { z } from 'zod';

const creationDefaults = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema.default(''),
  outOfScope: z.boolean().default(false),
  reasonOutOfScope: acceptedTextSchema.default(''),
});

const nodeGeometrySchema = z.union([
  z.literal('auto'),
  nodePlacementSchema.pick({ position: true, size: true }),
]);

const placedDefaults = creationDefaults.extend({
  placement: nodeGeometrySchema.describe(
    'A position and size, or "auto" for the next place on the shared grid.',
  ),
});

/** Creation keeps model fields, replacing node geometry with the placement choice. */
export const addedElementSchema = z.discriminatedUnion('kind', [
  drawnActorSchema
    .omit({ position: true, size: true })
    .extend(placedDefaults.shape),
  drawnProcessSchema
    .omit({ position: true, size: true })
    .extend(placedDefaults.shape),
  drawnStoreSchema
    .omit({ position: true, size: true })
    .extend(placedDefaults.shape),
  drawnTextSchema
    .omit({ position: true, size: true })
    .extend(placedDefaults.shape),
  drawnTrustBoundarySchema.extend(creationDefaults.shape),
  drawnFlowSchema.extend(creationDefaults.shape).extend({
    waypoints: waypointsSchema.default([]),
    bidirectional: z.boolean().default(false),
  }),
]);

const propertyNames = [
  ...new Set(
    elementPropertiesSchema.options.flatMap(
      (variant) => variant.keyof().options,
    ),
  ),
].filter((name) => name !== 'kind');

/** JSON names cleared fields explicitly because it cannot encode undefined. */
export const propertyEditSchema = z.object({
  properties: elementPropertiesSchema,
  unset: z
    .array(z.enum(propertyNames))
    .optional()
    .describe(
      'Fields to clear back to not recorded. Each must belong to the element kind and must not also have a supplied value.',
    ),
});

/** Clearing uses only this kind's fields and cannot also assign them. */
export function consistentPropertyEdit(
  input: z.infer<typeof propertyEditSchema>,
): boolean {
  const allowed = new Set<string>(
    elementPropertiesSchema.options.flatMap((variant) =>
      variant.shape.kind.value === input.properties.kind
        ? variant.keyof().options
        : [],
    ),
  );
  return (input.unset ?? []).every(
    (field) => allowed.has(field) && !Object.hasOwn(input.properties, field),
  );
}

/**
 * How an edit's `diagram` names a diagram the model holds, as its
 * description closes.
 */
export const diagramNaming =
  'Named by its id or its exact title, an id tried first.';

/**
 * What `place_element` takes: an element the model holds, the diagram to
 * place it on, and its geometry and accent there. The geometry is a node's
 * as `add_element` takes it, a trust boundary's shape, or a flow's route,
 * whose ends hold what a placement's ends hold, since which element each end
 * attaches to is the flow's.
 */
export const placementEditSchema = z.object({
  element: elementIdSchema.describe(
    'The id of the element to place, which the model already holds.',
  ),
  diagram: diagramIdSchema.describe(
    `The diagram to place the element on. ${diagramNaming}`,
  ),
  placement: z
    .union([
      nodeGeometrySchema,
      boundaryPlacementSchema.pick({ shape: true }),
      flowPlacementSchema
        .pick({ source: true, target: true })
        .extend({ waypoints: waypointsSchema.default([]) }),
    ])
    .describe(
      'Where the element is drawn on that diagram, by its kind. An actor, process, store or text note takes a `position` and `size`, or "auto" for the next place on the shared grid. A trust boundary takes a `shape`. A flow takes a `source` and a `target`, and optional `waypoints`. Each end is `{}` or a pinned `side` where the element it attaches to is on that diagram, and otherwise the `position` it is drawn at.',
    ),
  accent: accentSchema
    .optional()
    .describe('The accent key the element takes on that diagram.'),
});

/** Resolves placement without discarding optional model properties. */
export function addedElement(
  input: z.infer<typeof addedElementSchema>,
  index: number,
): DrawnElement {
  if (!('placement' in input)) return input;
  const { placement, ...element } = input;
  return { ...element, ...nodeGeometry(placement, index) };
}

/**
 * The placement a `place_element` edit asks for, `"auto"` resolved to the
 * place on the shared grid an element at `index` takes, as in
 * {@link addedElement}.
 */
export function placementFor(
  edit: z.infer<typeof placementEditSchema>,
  index: number,
): Placement {
  const held = { element: edit.element, ...accentField(edit) };
  const { placement } = edit;
  return placement === 'auto' || 'position' in placement
    ? { ...held, ...nodeGeometry(placement, index) }
    : { ...held, ...placement };
}

/** Converts the explicit JSON clearing list into the model's property patch. */
export function editedProperties(
  input: z.infer<typeof propertyEditSchema>,
): ElementProperties {
  return Object.assign(
    { ...input.properties },
    Object.fromEntries((input.unset ?? []).map((field) => [field, undefined])),
  );
}

function nodeGeometry(
  choice: z.infer<typeof nodeGeometrySchema>,
  index: number,
): Exclude<z.infer<typeof nodeGeometrySchema>, 'auto'> {
  return choice === 'auto'
    ? { position: autoPlacement(index), size: autoExtent }
    : choice;
}
