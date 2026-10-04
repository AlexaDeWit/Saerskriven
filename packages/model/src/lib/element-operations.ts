import { Either } from 'effect';
import {
  diagramIndexOf,
  emptyNameFailure,
  flowEndpointFailure,
  invalidRelationships,
  locatedElement,
  withDiagram,
  withElement,
  withStoredName,
  type UnknownElementFailure,
} from './diagram-edits.js';
import { storedPoint, storedSize, type Decimals } from './decimals.js';
import {
  anchorPoint,
  resized,
  sameGeometry,
  storedElement,
  translatedElement,
} from './element-geometry.js';
import {
  elementPropertiesSchema,
  type ElementProperties,
} from './element-properties.js';
import {
  elementSchema,
  type Element,
  type ElementDetailsChange,
  type FlowEndpoint,
} from './elements.js';
import type { Point, Size } from './geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import { sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { toParseIssues } from './parse-issue.js';
import { withoutId } from './records.js';
import { elementIdsAcross, elementIdsIn, elementsById } from './references.js';
import { restrictRelationships } from './relationships.js';
import { firstRefusedCharacter } from './text.js';
import { withCulledThreats } from './threat-operations.js';

/** The failures {@link addElement} can produce. */
export type AddElementFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownDiagram'
      | 'DuplicateElementId'
      | 'EmptyName'
      | 'InvalidFlowEndpoint'
      | 'InvalidElementRelationship';
  }
>;

/** The failure {@link removeElement} can produce. */
export type RemoveElementFailure = UnknownElementFailure;

/** The failure {@link moveElement} can produce. */
export type MoveElementFailure = UnknownElementFailure;

/** The failures {@link resizeElement} can produce. */
export type ResizeElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotResizable' }
>;

/** The failures {@link renameElement} can produce. */
export type RenameElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'EmptyName' | 'RefusedCharacter' }
>;

/** The failures {@link editNote} can produce. */
export type EditNoteFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotTextElement' | 'RefusedCharacter' }
>;

/** The failures {@link setElementDetails} can produce. */
export type SetElementDetailsFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'RefusedCharacter' }
>;

/** The failures {@link setElementProperties} can produce. */
export type SetElementPropertiesFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownElement'
      | 'InvalidElementProperties'
      | 'InvalidElementRelationship';
  }
>;

/**
 * Requires an existing diagram, a new ID, a name that is more than white
 * space on every kind but a flow, flow ends `reconnectFlow` would accept, and
 * valid local boundary references. A flow named with white space alone is
 * stored unlabelled, as `''`. The element's whole geometry is stored at
 * `decimals`, and as given where no count is named.
 */
export function addElement(
  model: Model,
  diagramId: DiagramId,
  element: Element,
  decimals?: Decimals,
): Either.Either<Model, AddElementFailure> {
  return Either.flatMap(
    diagramIndexOf(model, diagramId),
    (diagramIndex): Either.Either<Model, AddElementFailure> => {
      if (elementIdsAcross(model.diagrams).has(element.id)) {
        return Either.left(
          OperationFailure.DuplicateElementId({ elementId: element.id }),
        );
      }
      const diagram = model.diagrams[diagramIndex];
      const failure =
        emptyNameFailure(element) ??
        flowEndpointFailure(element, diagram) ??
        invalidRelationships(
          element,
          elementsById([...diagram.elements, element]),
        );
      if (failure !== undefined) {
        return Either.left(failure);
      }
      return Either.right(
        withDiagram(model, diagramIndex, (held) => ({
          ...held,
          elements: [
            ...held.elements,
            withStoredName(storedElement(element, decimals)),
          ],
        })),
      );
    },
  );
}

/**
 * Removes an element and its threat and boundary references. A threat the
 * element was the last reference of goes with it, carrying the cascade
 * {@link removeThreat} does, and one that applies to the model stays.
 * Attached flows keep their identity and acquire free endpoints at the
 * removed element's anchor, stored at `decimals`.
 */
export function removeElement(
  model: Model,
  elementId: ElementId,
  decimals?: Decimals,
): Either.Either<Model, RemoveElementFailure> {
  return Either.map(locatedElement(model, elementId), (located) => {
    const freed: FlowEndpoint = {
      kind: 'free',
      position: storedPoint(anchorPoint(located.element), decimals),
    };
    const detached = (endpoint: FlowEndpoint): FlowEndpoint =>
      endpoint.kind === 'attached' && endpoint.element === elementId
        ? freed
        : endpoint;
    const retained = elementIdsIn(model.diagrams[located.diagramIndex]);
    retained.delete(elementId);
    const trimmed = withDiagram(model, located.diagramIndex, (diagram) => ({
      ...diagram,
      elements: diagram.elements
        .filter((element) => element.id !== elementId)
        .map((element) => restrictRelationships(element, retained))
        .map((element) =>
          element.kind === 'flow'
            ? {
                ...element,
                source: detached(element.source),
                target: detached(element.target),
              }
            : element,
        ),
    }));
    return withCulledThreats(trimmed, (threat) => ({
      ...threat,
      elements: withoutId(threat.elements, elementId),
    }));
  });
}

/**
 * Translates positions, waypoints, and free endpoints. Attached endpoints keep
 * following their elements. Each point the move writes is stored at
 * `decimals`, so a move by a whole offset from 123.63636363636364 at one
 * decimal lands on a number of one decimal, and a size is left as stored. A
 * move that would store every number as it already is returns the same model.
 */
export function moveElement(
  model: Model,
  elementId: ElementId,
  offset: Point,
  decimals?: Decimals,
): Either.Either<Model, MoveElementFailure> {
  return Either.map(locatedElement(model, elementId), (located) => {
    const moved = translatedElement(located.element, offset, decimals);
    return sameGeometry(located.element, moved)
      ? model
      : withElement(model, located.diagramIndex, moved);
  });
}

/**
 * Resizes an element that carries an extent. The caller supplies a
 * schema-valid size, which is stored at `decimals` and is schema-valid there
 * too. The position is left as stored. A resize that would store the size the
 * element already has returns the same model.
 */
export function resizeElement(
  model: Model,
  elementId: ElementId,
  size: Size,
  decimals?: Decimals,
): Either.Either<Model, ResizeElementFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, ResizeElementFailure> => {
      const next = resized(located.element, storedSize(size, decimals));
      if (next === undefined) {
        return Either.left(OperationFailure.NotResizable({ elementId }));
      }
      return Either.right(
        sameGeometry(located.element, next)
          ? model
          : withElement(model, located.diagramIndex, next),
      );
    },
  );
}

/**
 * Renames any element, rejecting characters refused by the model and, on
 * every kind but a flow, an empty name. Clearing a flow's name, or naming it
 * with white space alone, leaves it unlabelled as `''`. A name the element
 * already holds returns the same model.
 */
export function renameElement(
  model: Model,
  elementId: ElementId,
  name: string,
): Either.Either<Model, RenameElementFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, RenameElementFailure> => {
      const renamed = withStoredName({ ...located.element, name });
      const refusal =
        emptyNameFailure(renamed) ?? refusedCharacter(elementId, name);
      if (refusal !== undefined) {
        return Either.left(refusal);
      }
      return Either.right(
        renamed.name === located.element.name
          ? model
          : withElement(model, located.diagramIndex, renamed),
      );
    },
  );
}

/** Changes a canvas note's text. Empty text is valid. */
export function editNote(
  model: Model,
  elementId: ElementId,
  text: string,
): Either.Either<Model, EditNoteFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, EditNoteFailure> => {
      if (located.element.kind !== 'text') {
        return Either.left(OperationFailure.NotTextElement({ elementId }));
      }
      const refusal = refusedCharacter(elementId, text);
      return refusal === undefined
        ? Either.right(
            withElement(model, located.diagramIndex, {
              ...located.element,
              text,
            }),
          )
        : Either.left(refusal);
    },
  );
}

/**
 * Replaces the description and scope fields `change` names on any element
 * kind and keeps the others, returning the same model where nothing differs.
 * The scope flag and its reason are independent, so clearing the flag keeps
 * the reason. Where both texts carry a refused character, the failure
 * points into the description.
 */
export function setElementDetails(
  model: Model,
  elementId: ElementId,
  change: ElementDetailsChange,
): Either.Either<Model, SetElementDetailsFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, SetElementDetailsFailure> => {
      const refusal =
        refusedCharacter(elementId, change.description ?? '') ??
        refusedCharacter(elementId, change.reasonOutOfScope ?? '');
      if (refusal !== undefined) {
        return Either.left(refusal);
      }
      const held = located.element;
      const next = {
        ...held,
        description: change.description ?? held.description,
        outOfScope: change.outOfScope ?? held.outOfScope,
        reasonOutOfScope: change.reasonOutOfScope ?? held.reasonOutOfScope,
      };
      return Either.right(
        next.description === held.description &&
          next.outOfScope === held.outOfScope &&
          next.reasonOutOfScope === held.reasonOutOfScope
          ? model
          : withElement(model, located.diagramIndex, next),
      );
    },
  );
}

/**
 * Validates a property edit for the existing element kind. Unknown values
 * clear only explicitly named fields. The edited element's text and its
 * relationship targets are validated, and every field the patch does not name
 * keeps its value.
 */
export function setElementProperties(
  model: Model,
  elementId: ElementId,
  properties: ElementProperties,
): Either.Either<Model, SetElementPropertiesFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, SetElementPropertiesFailure> => {
      const patch = elementPropertiesSchema.safeParse(properties);
      if (!patch.success) {
        return Either.left(
          OperationFailure.InvalidElementProperties({
            elementId,
            issues: toParseIssues(patch.error.issues, properties),
          }),
        );
      }
      if (patch.data.kind !== located.element.kind) {
        return Either.left(
          OperationFailure.InvalidElementProperties({
            elementId,
            issues: [
              { path: ['kind'], detail: { code: 'element-kind-changed' } },
            ],
          }),
        );
      }
      if (!patchChanges(located.element, patch.data)) {
        return Either.right(model);
      }
      const patched = patchedElement(located.element, patch.data);
      const next = elementSchema.safeParse(patched);
      if (!next.success) {
        return Either.left(
          OperationFailure.InvalidElementProperties({
            elementId,
            issues: toParseIssues(next.error.issues, patched),
          }),
        );
      }
      const failure = invalidRelationships(
        next.data,
        elementsById(model.diagrams[located.diagramIndex].elements),
      );
      return failure === undefined
        ? Either.right(withElement(model, located.diagramIndex, next.data))
        : Either.left(failure);
    },
  );
}

function refusedCharacter(
  elementId: ElementId,
  text: string,
): Extract<OperationFailure, { _tag: 'RefusedCharacter' }> | undefined {
  const at = firstRefusedCharacter(text);
  return at === undefined
    ? undefined
    : OperationFailure.RefusedCharacter({ elementId, at });
}

function patchChanges(held: Element, patch: ElementProperties): boolean {
  const previous = new Map<string, unknown>(Object.entries(held));
  return Object.entries(patch).some(([key, value]) => {
    const current = previous.get(key);
    return Array.isArray(value) && Array.isArray(current)
      ? !sameItems<unknown>(value, current)
      : value !== current;
  });
}

function patchedElement(held: Element, patch: ElementProperties): object {
  const candidate = { ...held, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      Reflect.deleteProperty(candidate, key);
    }
  }
  return candidate;
}
