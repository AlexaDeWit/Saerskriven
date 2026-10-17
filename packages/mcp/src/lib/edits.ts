import {
  OperationFailure,
  acceptedTextSchema,
  accentSchema,
  addDiagram,
  addElement,
  boundaryShapeSchema,
  diagramIdSchema,
  diagramsNamed,
  diagramsOf,
  droppedRecords,
  droppedThreats,
  editNote,
  elementDetailsChangeSchema,
  elementIdSchema,
  mergeElements,
  mergeOutcome,
  modelMetadataChangeSchema,
  moveElement,
  placeElement,
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
  threatIdSchema,
  unplaceElement,
  waypointsSchema,
  type DiagramId,
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
  diagramNaming,
  editedProperties,
  placementEditSchema,
  placementFor,
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
  diagram: diagramIdSchema.describe(`The diagram. ${diagramNaming}`),
});

const onDiagramSchema = z.object({
  diagram: diagramIdSchema
    .optional()
    .describe(
      `The diagram whose drawing the edit changes. ${diagramNaming} Needed only for an element on more than one diagram, which the edit refuses without it.`,
    ),
});

const drawnEditSchema = elementEditSchema.extend(onDiagramSchema.shape);

/**
 * `add_*` and `replace_*` edits take whole records. Every other edit changes
 * only what it names. The threat, mitigation and assumption variants are
 * {@link registerEditSchemas}.
 */
export const modelEditSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_element'),
    diagram: diagramIdSchema.describe(
      `The diagram the element joins. ${diagramNaming}`,
    ),
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
  placementEditSchema.extend({ op: z.literal('place_element') }),
  elementEditSchema.extend({
    op: z.literal('unplace_element'),
    diagram: diagramIdSchema.describe(
      `The diagram to take the element off. ${diagramNaming}`,
    ),
  }),
  elementEditSchema.extend({
    op: z.literal('merge_elements'),
    element: elementIdSchema.describe(
      'The id of the element to merge, which the model no longer holds afterwards.',
    ),
    into: elementIdSchema.describe(
      'The id of the element of the same kind it merges into, which keeps its id, name, details and properties.',
    ),
  }),
  drawnEditSchema.extend({
    op: z.literal('move_element'),
    offset: pointSchema.describe('How far to translate the element.'),
  }),
  drawnEditSchema.extend({
    op: z.literal('resize_element'),
    size: sizeSchema,
  }),
  drawnEditSchema.extend({
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
  onDiagramSchema.extend({
    op: z.literal('set_accent'),
    elements: z
      .array(elementIdSchema)
      .min(1)
      .describe('The ids of the elements whose accent is set or cleared.'),
    accent: z
      .union([accentSchema, z.literal(noAccent)])
      .describe(
        'The accent key every named element takes, `s1` to `s4` strong or `l1` to `l4` light, or "none" to clear theirs.',
      ),
  }),
  drawnEditSchema.extend({
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
  drawnEditSchema.extend({
    op: z.literal('reconnect_flow'),
    diagram: onDiagramSchema.shape.diagram.describe(
      `The diagram whose drawing \`anchor\` pins the end on, which has to place \`endpoint\`. ${diagramNaming} Needed only for a flow on more than one diagram, which the edit refuses without it.`,
    ),
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
  drawnEditSchema.extend({
    op: z.literal('set_flow_end_position'),
    side: flowEndSchema,
    position: pointSchema.describe(
      'The canvas position the end is freed at, or moved to where it is free already.',
    ),
  }),
  elementEditSchema.extend({ op: z.literal('reverse_flow') }),
  ...registerEditSchemas,
  z.object({
    op: z.literal('add_diagram'),
    diagram: diagramIdSchema.describe('The id of the new diagram.'),
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

/** What one `merge_elements` edit of a batch moved onto the element it kept, and dropped. */
export const mergeReportSchema = z.object({
  element: elementIdSchema.describe(
    'The element merged, which the model no longer holds.',
  ),
  into: elementIdSchema.describe(
    'The element it merged into, which kept its id, name, details and properties.',
  ),
  movedOn: z
    .array(diagramIdSchema)
    .describe(
      'The diagrams whose drawing of `element` became the drawing of `into`, with its geometry and accent.',
    ),
  droppedOn: z
    .array(diagramIdSchema)
    .describe(
      'The diagrams that already drew `into`, where the drawing of `element` was dropped and its flows there attach to `into`.',
    ),
  threats: z
    .array(threatIdSchema)
    .describe('The threats attached to `element`, which attach to `into`.'),
  flows: z
    .array(elementIdSchema)
    .describe(
      'The flows with an end attached to `element`, which attach to `into`.',
    ),
});

/** What one `merge_elements` edit moved and dropped. */
export type MergeReport = z.infer<typeof mergeReportSchema>;

/**
 * A batch applied: the model it produced, the records and threats it culled,
 * and what each merge of it moved and dropped.
 */
export type AppliedBatch = {
  readonly model: Model;
  readonly culled: readonly RecordReference[];
  readonly culledThreats: readonly Threat[];
  readonly merged: readonly MergeReport[];
};

/**
 * Applies a batch in order and returns its first refusal. `culled` names,
 * once each, every record an edit other than `remove_mitigation` or
 * `remove_assumption` took out of the model, and `culledThreats` every
 * threat an edit other than `remove_threat` did, in both cases where the
 * model the batch started from held it. `merged` reports each
 * `merge_elements` edit in order, read from the model the edit applied to.
 * The caller owns file writes.
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
              merged:
                edit.op === 'merge_elements'
                  ? [...batch.merged, mergeReport(batch.model, edit)]
                  : batch.merged,
            }),
          }),
        ),
      Either.right({ model, culled: [], culledThreats: [], merged: [] }),
    ),
    (batch) => ({
      model: batch.model,
      culled: firstOfEach(batch.culled, recordKey, heldRecords),
      culledThreats: firstOfEach(
        batch.culledThreats,
        (threat) => threat.id,
        heldThreats,
      ),
      merged: batch.merged,
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
  given: ModelEdit,
): Either.Either<Model, OperationFailure> {
  if (isRegisterEdit(given)) {
    return applyRegisterEdit(model, given);
  }
  const edit = onDiagramNamed(model, given);
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
    case 'place_element':
      return placeElement(
        model,
        edit.diagram,
        placementFor(edit, placementIndex(model, edit.diagram)),
      );
    case 'unplace_element':
      return unplaceElement(model, edit.diagram, edit.element);
    case 'merge_elements':
      return mergeElements(model, edit.element, edit.into);
    case 'move_element':
      return onItsDiagram(model, edit, (diagram) =>
        moveElement(model, diagram, edit.element, edit.offset),
      );
    case 'resize_element':
      return onItsDiagram(model, edit, (diagram) =>
        resizeElement(model, diagram, edit.element, edit.size),
      );
    case 'set_boundary_shape':
      return onItsDiagram(model, edit, (diagram) =>
        setBoundaryShape(model, diagram, edit.element, edit.shape),
      );
    case 'rename_element':
      return renameElement(model, edit.element, edit.name);
    case 'edit_note':
      return editNote(model, edit.element, edit.text);
    case 'set_element_details':
      return setElementDetails(model, edit.element, edit);
    case 'set_accent':
      return accented(model, edit);
    case 'set_flow_waypoints':
      return onItsDiagram(model, edit, (diagram) =>
        setFlowWaypoints(model, diagram, edit.element, edit.waypoints),
      );
    case 'set_flow_direction':
      return setFlowDirection(model, edit.element, edit.bidirectional);
    case 'reconnect_flow':
      return onItsDiagram(model, edit, (diagram) =>
        reconnectFlow(
          model,
          diagram,
          edit.element,
          edit.side,
          edit.endpoint,
          edit.anchor,
        ),
      );
    case 'set_flow_end_position':
      return onItsDiagram(model, edit, (diagram) =>
        setFlowEndPosition(
          model,
          diagram,
          edit.element,
          edit.side,
          edit.position,
        ),
      );
    case 'reverse_flow':
      return reverseFlow(model, edit.element);
    case 'add_diagram':
      return addDiagram(model, { id: edit.diagram, title: edit.title });
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

function onDiagramNamed<
  Edit extends {
    readonly op: string;
    readonly diagram?: DiagramId | undefined;
  },
>(model: Model, edit: Edit): Edit {
  if (edit.op === 'add_diagram' || edit.diagram === undefined) {
    return edit;
  }
  const [named] = diagramsNamed(model.diagrams, edit.diagram);
  return named === undefined ? edit : { ...edit, diagram: named.id };
}

function placementIndex(model: Model, diagramId: string): number {
  return (
    model.diagrams.find((diagram) => diagram.id === diagramId)?.placements
      .length ?? 0
  );
}

function onItsDiagram(
  model: Model,
  { element: elementId, diagram: named }: z.infer<typeof drawnEditSchema>,
  edit: (diagramId: DiagramId) => Either.Either<Model, OperationFailure>,
): Either.Either<Model, OperationFailure> {
  if (named !== undefined) {
    return edit(named);
  }
  const diagrams = diagramsOf(model, elementId);
  const [diagram] = diagrams;
  if (diagram === undefined) {
    return Either.left(OperationFailure.UnknownElement({ elementId }));
  }
  return diagrams.length === 1
    ? edit(diagram.id)
    : Either.left(
        OperationFailure.ElementOnSeveralDiagrams({
          elementId,
          diagramIds: diagrams.map(({ id }) => id),
        }),
      );
}

function accented(
  model: Model,
  edit: Extract<ModelEdit, { op: 'set_accent' }>,
): Either.Either<Model, OperationFailure> {
  const accent = edit.accent === noAccent ? undefined : edit.accent;
  return edit.elements.reduce<Either.Either<Model, OperationFailure>>(
    (outcome, element) =>
      Either.flatMap(outcome, (current) =>
        onItsDiagram(current, { element, diagram: edit.diagram }, (diagram) =>
          setAccent(current, diagram, [element], accent),
        ),
      ),
    Either.right(model),
  );
}

function mergeReport(
  model: Model,
  { element, into }: Extract<ModelEdit, { op: 'merge_elements' }>,
): MergeReport {
  const outcome = mergeOutcome(model, element, into);
  return {
    element,
    into,
    movedOn: outcome.moved.map(({ id }) => id),
    droppedOn: outcome.dropped.map(({ id }) => id),
    threats: [...outcome.threats],
    flows: [...outcome.flows],
  };
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
