import { Either } from 'effect';
import {
  diagramIndexOf,
  flowEndpointFailure,
  invalidRelationships,
  locatedElement,
  withDiagram,
  withElement,
  type UnknownElementFailure,
} from './diagram-edits.js';
import { anchorPoint, resized, translatedElement } from './element-geometry.js';
import {
  elementPropertiesSchema,
  type ElementProperties,
} from './element-properties.js';
import { elementSchema, type Element, type FlowEndpoint } from './elements.js';
import type { Point, Size } from './geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import { sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { toParseIssues } from './parse-issue.js';
import { elementIdsAcross, elementIdsIn, elementsById } from './references.js';
import { restrictRelationships } from './relationships.js';
import { firstRefusedCharacter, isEmptyName } from './text.js';

/** The failures {@link addElement} can produce. */
export type AddElementFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownDiagram'
      | 'DuplicateElementId'
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

/** Requires an existing diagram, a new ID and valid local endpoint and boundary references. */
export function addElement(
  model: Model,
  diagramId: DiagramId,
  element: Element,
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
          elements: [...held.elements, element],
        })),
      );
    },
  );
}

/** Removes an element and its threat and boundary references. Attached flows keep their identity and acquire free endpoints at the removed element's anchor. */
export function removeElement(
  model: Model,
  elementId: ElementId,
): Either.Either<Model, RemoveElementFailure> {
  return Either.map(locatedElement(model, elementId), (located) => {
    const freed: FlowEndpoint = {
      kind: 'free',
      position: anchorPoint(located.element),
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
    return {
      ...trimmed,
      threats: trimmed.threats.map((threat) => ({
        ...threat,
        elements: threat.elements.filter((id) => id !== elementId),
      })),
    };
  });
}

/** Translates positions, waypoints, and free endpoints. Attached endpoints keep following their elements. */
export function moveElement(
  model: Model,
  elementId: ElementId,
  offset: Point,
): Either.Either<Model, MoveElementFailure> {
  return Either.map(locatedElement(model, elementId), (located) =>
    withElement(
      model,
      located.diagramIndex,
      translatedElement(located.element, offset),
    ),
  );
}

/** Resizes an element that carries an extent. The caller supplies a schema-valid size. */
export function resizeElement(
  model: Model,
  elementId: ElementId,
  size: Size,
): Either.Either<Model, ResizeElementFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, ResizeElementFailure> => {
      const next = resized(located.element, size);
      return next
        ? Either.right(withElement(model, located.diagramIndex, next))
        : Either.left(OperationFailure.NotResizable({ elementId }));
    },
  );
}

/** Renames any element, rejecting empty names and characters refused by the model. */
export function renameElement(
  model: Model,
  elementId: ElementId,
  name: string,
): Either.Either<Model, RenameElementFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    (located): Either.Either<Model, RenameElementFailure> => {
      if (isEmptyName(name)) {
        return Either.left(OperationFailure.EmptyName({ elementId }));
      }
      const refusal = refusedCharacter(elementId, name);
      return refusal === undefined
        ? Either.right(
            withElement(model, located.diagramIndex, {
              ...located.element,
              name,
            }),
          )
        : Either.left(refusal);
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
