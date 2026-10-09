import {
  OperationFailure,
  acceptedTextSchema,
  accentSchema,
  addDiagram,
  addElement,
  boundaryShapeSchema,
  diagramIdSchema,
  droppedRecords,
  droppedThreats,
  editNote,
  elementDetailsChangeSchema,
  elementIdSchema,
  modelMetadataChangeSchema,
  moveElement,
  pointSchema,
  reconnectFlow,
  removeDiagram,
  removeElement,
  renameDiagram,
  renameElement,
  resizeElement,
  reverseFlow,
  setAccent,
  setBoundaryShape,
  setFlowDirection,
  setFlowEndPosition,
  setFlowWaypoints,
  setModelMetadata,
  setElementDetails,
  setElementProperties,
  sideSchema,
  sizeSchema,
  waypointsSchema,
  type Model,
  type RecordReference,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  addedElement,
  addedElementSchema,
  consistentPropertyEdit,
  editedProperties,
  propertyEditSchema,
} from './element-edits.js';
import { flowEndSchema } from './element-rows.js';
import {
  describeOperationFailure,
  unappliedEdit,
} from './operation-failure.js';
import {
  applyRegisterEdit,
  isRegisterEdit,
  registerEditSchemas,
} from './register-edits.js';

const noAccent = 'none';

const elementEditSchema = z.object({
  element: elementIdSchema.describe('The id of the element to edit.'),
});

const diagramEditSchema = z.object({
  diagram: diagramIdSchema.describe('The id of the diagram.'),
});

/**
 * `add_*` and `replace_*` edits take whole records. Every other edit changes
 * only what it names. The threat, mitigation and assumption variants are
 * {@link registerEditSchemas}.
 */
export const modelEditSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_element'),
    diagram: diagramIdSchema.describe('The diagram the element joins.'),
    element: addedElementSchema,
  }),
  elementEditSchema
    .extend(propertyEditSchema.shape)
    .extend({
      op: z.literal('set_element_properties'),
    })
    .refine(consistentPropertyEdit, {
      message:
        'Unset fields must belong to the element kind and cannot also have a value.',
    }),
  elementEditSchema.extend({ op: z.literal('remove_element') }),
  elementEditSchema.extend({
    op: z.literal('move_element'),
    offset: pointSchema.describe('How far to translate the element.'),
  }),
  elementEditSchema.extend({
    op: z.literal('resize_element'),
    size: sizeSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('set_boundary_shape'),
    shape: boundaryShapeSchema.describe(
      'A box with its position and size, or a curve through at least two points, replacing the shape the trust boundary has whichever of the two it is.',
    ),
  }),
  elementEditSchema.extend({
    op: z.literal('rename_element'),
    name: acceptedTextSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('edit_note'),
    text: acceptedTextSchema,
  }),
  elementEditSchema
    .extend(elementDetailsChangeSchema.shape)
    .extend({ op: z.literal('set_element_details') }),
  z.object({
    op: z.literal('set_accent'),
    elements: z
      .array(elementIdSchema)
      .min(1)
      .describe('The ids of the elements whose accent is set or cleared.'),
    accent: z
      .union([accentSchema, z.literal(noAccent)])
      .describe(
        'The accent key every named element takes, or "none" to clear theirs.',
      ),
  }),
  elementEditSchema.extend({
    op: z.literal('set_flow_waypoints'),
    waypoints: waypointsSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('set_flow_direction'),
    bidirectional: z
      .boolean()
      .describe(
        'Whether data moves both ways along the flow. The flow keeps its id, so the threats attached to it stay attached.',
      ),
  }),
  elementEditSchema.extend({
    op: z.literal('reconnect_flow'),
    side: flowEndSchema,
    endpoint: elementIdSchema.describe(
      'The actor, process or store the end moves to.',
    ),
    anchor: sideSchema
      .optional()
      .describe(
        'The side of the endpoint the flow fastens to. Left out, the renderer chooses.',
      ),
  }),
  elementEditSchema.extend({
    op: z.literal('set_flow_end_position'),
    side: flowEndSchema,
    position: pointSchema.describe(
      'The canvas position the end is freed at, or moved to where it is free already.',
    ),
  }),
  elementEditSchema.extend({ op: z.literal('reverse_flow') }),
  ...registerEditSchemas,
  diagramEditSchema.extend({
    op: z.literal('add_diagram'),
    title: acceptedTextSchema,
  }),
  diagramEditSchema.extend({
    op: z.literal('rename_diagram'),
    title: acceptedTextSchema,
  }),
  diagramEditSchema.extend({ op: z.literal('remove_diagram') }),
  modelMetadataChangeSchema
    .extend({ op: z.literal('set_model_metadata') })
    .describe(
      'Sets any of the model title, owner, description and contributors. A field left out keeps its value, and `contributors` replaces the whole list.',
    ),
]);

/** One edit of a batch. */
export type ModelEdit = z.infer<typeof modelEditSchema>;

/** Edit names follow the schema so tool documentation cannot omit a variant. */
export const editOps: readonly ModelEdit['op'][] = modelEditSchema.options.map(
  (option) => option.shape.op.value,
);

/** Which edit of a batch the model refused, and why. */
export type RefusedEdit = {
  readonly index: number;
  readonly failure: OperationFailure;
};

/** A batch applied: the model it produced, and the records and threats it culled. */
export type AppliedBatch = {
  readonly model: Model;
  readonly culled: readonly RecordReference[];
  readonly culledThreats: readonly Threat[];
};

/**
 * Applies a batch in order and returns its first refusal. `culled` names,
 * once each, every record an edit other than `remove_mitigation` or
 * `remove_assumption` took out of the model, and `culledThreats` every
 * threat an edit other than `remove_threat` did, in both cases where the
 * model the batch started from held it. The caller owns file writes.
 */
export function applyEdits(
  model: Model,
  edits: readonly ModelEdit[],
): Either.Either<AppliedBatch, RefusedEdit> {
  const heldRecords = new Set([
    ...model.mitigations.map(({ id }) => recordKey({ kind: 'mitigation', id })),
    ...model.assumptions.map(({ id }) => recordKey({ kind: 'assumption', id })),
  ]);
  const heldThreats = new Set<string>(model.threats.map(({ id }) => id));
  return Either.map(
    edits.reduce<Either.Either<AppliedBatch, RefusedEdit>>(
      (carried, edit, index) =>
        Either.flatMap(carried, (batch) =>
          Either.mapBoth(applyEdit(batch.model, edit), {
            onLeft: (failure) => ({ index, failure }),
            onRight: (next) => ({
              model: next,
              culled: [
                ...batch.culled,
                ...(isRecordRemoval(edit)
                  ? []
                  : droppedRecords(batch.model, next)),
              ],
              culledThreats: [
                ...batch.culledThreats,
                ...(edit.op === 'remove_threat'
                  ? []
                  : droppedThreats(batch.model, next)),
              ],
            }),
          }),
        ),
      Either.right({ model, culled: [], culledThreats: [] }),
    ),
    (batch) => ({
      model: batch.model,
      culled: firstOfEach(batch.culled, recordKey, heldRecords),
      culledThreats: firstOfEach(
        batch.culledThreats,
        (threat) => threat.id,
        heldThreats,
      ),
    }),
  );
}

/** Which edit was refused and what the model said, as lines for a result. */
export function renderRefusedEdit(refused: RefusedEdit): readonly string[] {
  return [
    `The edit at index ${String(refused.index)} was refused, so none of the batch was applied and the file is as it was.`,
    describeOperationFailure(refused.failure),
  ];
}

function applyEdit(
  model: Model,
  edit: ModelEdit,
): Either.Either<Model, OperationFailure> {
  if (isRegisterEdit(edit)) {
    return applyRegisterEdit(model, edit);
  }
  switch (edit.op) {
    case 'add_element':
      return addElement(
        model,
        edit.diagram,
        addedElement(edit.element, placementIndex(model, edit.diagram)),
      );
    case 'set_element_properties':
      return setElementProperties(model, edit.element, editedProperties(edit));
    case 'remove_element':
      return removeElement(model, edit.element);
    case 'move_element':
      return moveElement(model, edit.element, edit.offset);
    case 'resize_element':
      return resizeElement(model, edit.element, edit.size);
    case 'set_boundary_shape':
      return setBoundaryShape(model, edit.element, edit.shape);
    case 'rename_element':
      return renameElement(model, edit.element, edit.name);
    case 'edit_note':
      return editNote(model, edit.element, edit.text);
    case 'set_element_details':
      return setElementDetails(model, edit.element, edit);
    case 'set_accent':
      return setAccent(
        model,
        edit.elements,
        edit.accent === noAccent ? undefined : edit.accent,
      );
    case 'set_flow_waypoints':
      return setFlowWaypoints(model, edit.element, edit.waypoints);
    case 'set_flow_direction':
      return setFlowDirection(model, edit.element, edit.bidirectional);
    case 'reconnect_flow':
      return reconnectFlow(
        model,
        edit.element,
        edit.side,
        edit.endpoint,
        edit.anchor,
      );
    case 'set_flow_end_position':
      return setFlowEndPosition(model, edit.element, edit.side, edit.position);
    case 'reverse_flow':
      return reverseFlow(model, edit.element);
    case 'add_diagram':
      return addDiagram(model, {
        id: edit.diagram,
        title: edit.title,
        elements: [],
      });
    case 'rename_diagram':
      return renameDiagram(model, edit.diagram, edit.title);
    case 'remove_diagram':
      return removeDiagram(model, edit.diagram);
    case 'set_model_metadata':
      return setModelMetadata(model, edit);
    default:
      return unappliedEdit(edit);
  }
}

function placementIndex(model: Model, diagramId: string): number {
  return (
    model.diagrams.find((diagram) => diagram.id === diagramId)?.elements
      .length ?? 0
  );
}

function isRecordRemoval(edit: ModelEdit): boolean {
  return edit.op === 'remove_mitigation' || edit.op === 'remove_assumption';
}

function recordKey(record: RecordReference): string {
  return `${record.kind} ${record.id}`;
}

function firstOfEach<Culled>(
  culled: readonly Culled[],
  key: (item: Culled) => string,
  held: ReadonlySet<string>,
): Culled[] {
  return [
    ...new Map(
      culled
        .filter((item) => held.has(key(item)))
        .map((item) => [key(item), item]),
    ).values(),
  ];
}
