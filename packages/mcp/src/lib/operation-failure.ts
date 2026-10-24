import { quotedForTerminal } from '@saerskriven/formats';
import {
  OperationFailure,
  issueLine,
  parseIssueText,
  type DiagramId,
  type Model,
  type ParseIssue,
} from '@saerskriven/model';
import { Data, Result } from 'effect';
import { noDiagramNamed } from './search.js';

/**
 * Why the server refused an edit before the model saw it: a `diagram` that
 * is no diagram's id and the exact title of more than one, naming their ids.
 */
export type EditFailure = Data.TaggedEnum<{
  AmbiguousDiagram: {
    readonly name: string;
    readonly diagramIds: readonly DiagramId[];
  };
}>;

/**
 * Constructors for {@link EditFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const EditFailure = Data.taggedEnum<EditFailure>();

/** What the server or the model said about a refused edit, as one line. */
export function describeEditRefusal(
  failure: OperationFailure | EditFailure,
): string {
  return EditFailure.$is('AmbiguousDiagram')(failure)
    ? `More than one diagram has the title ${quotedForTerminal(failure.name)} (${failure.diagramIds.map((id) => quotedForTerminal(id)).join(', ')}), and none has it as its id, so name the one this edit changes by its id.`
    : describeOperationFailure(failure);
}

/** What the model said about a refused edit, as one line of a result. */
export function describeOperationFailure(failure: OperationFailure): string {
  return OperationFailure.$match(failure, {
    InvalidElementProperties: ({ issues }) =>
      `The element properties were refused: ${issueLines(issues)}`,
    InvalidElementRelationship: ({ issues }) =>
      `The element has invalid boundary relationships: ${issueLines(issues)}`,
    InvalidFragment: ({ issues }) =>
      `The edit does not apply to this model: ${issueLines(issues)}.`,
    UnknownDiagram: ({ diagramId }) => noDiagramNamed(diagramId).join(' '),
    DuplicateDiagramId: ({ diagramId }) =>
      `The model already holds a diagram ${quotedForTerminal(diagramId)}.`,
    EmptyTitle: ({ diagramId }) =>
      `Diagram ${quotedForTerminal(diagramId)} cannot be left without a title.`,
    RefusedTitleCharacter: ({ diagramId, at }) =>
      `The title for diagram ${quotedForTerminal(diagramId)} carries a character the model does not accept, at index ${String(at)}.`,
    DiagramNotEmpty: ({ diagramId, elements }) =>
      `Diagram ${quotedForTerminal(diagramId)} still holds ${String(elements)} ${elements === 1 ? 'element' : 'elements'}, and only an empty diagram is removed. Take an element also on another diagram off it with unplace_element, and remove the others with remove_element.`,
    UnknownElement: ({ elementId }) =>
      `The model holds no element ${quotedForTerminal(elementId)}.`,
    ElementNotOnDiagram: ({ elementId, diagramId }) =>
      `Diagram ${quotedForTerminal(diagramId)} does not draw element ${quotedForTerminal(elementId)}.`,
    ElementAlreadyOnDiagram: ({ elementId, diagramId }) =>
      `Diagram ${quotedForTerminal(diagramId)} already draws element ${quotedForTerminal(elementId)}, and an element is drawn at most once on each diagram.`,
    LastPlacement: ({ elementId, diagramId }) =>
      `Diagram ${quotedForTerminal(diagramId)} is the last one drawing element ${quotedForTerminal(elementId)}, and every element is drawn on a diagram: remove the element with remove_element instead.`,
    InvalidPlacement: ({ elementId, diagramId }) =>
      `The placement of element ${quotedForTerminal(elementId)} on diagram ${quotedForTerminal(diagramId)} is refused: it holds geometry the element's kind does not take, or a flow end the diagram cannot draw. An end attached to an element the diagram draws holds no position, and every other end holds one.`,
    ElementOnSeveralDiagrams: ({ elementId, diagramIds }) =>
      `Element ${quotedForTerminal(elementId)} is drawn on more than one diagram (${diagramIds.map((id) => quotedForTerminal(id)).join(', ')}), so name the one this edit applies to in \`diagram\`.`,
    MergeIntoItself: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is named as both \`element\` and \`into\`, and an element merges only into another one.`,
    MergeKindsDiffer: ({ elementId, elementKind, intoId, intoKind }) =>
      `Element ${quotedForTerminal(elementId)} is of kind ${elementKind} and element ${quotedForTerminal(intoId)} of kind ${intoKind}, and only two elements of one kind merge.`,
    MergeJoinedByFlow: ({ elementId, intoId, flowId }) =>
      `Flow ${quotedForTerminal(flowId)} joins element ${quotedForTerminal(elementId)} to element ${quotedForTerminal(intoId)}, and merging them would leave it joining one element to itself: remove or reconnect the flow first.`,
    MergeFlowEndsDiffer: ({ elementId, intoId }) =>
      `Flows ${quotedForTerminal(elementId)} and ${quotedForTerminal(intoId)} do not join the same two elements in the same direction, and two flows merge only where they do, since a flow's ends are the same on every diagram: merge the elements at their ends first, or reverse one with reverse_flow.`,
    UnknownThreat: ({ threatId }) =>
      `The model holds no threat ${quotedForTerminal(threatId)}.`,
    UnknownMitigation: ({ mitigationId }) =>
      `The model holds no mitigation ${quotedForTerminal(mitigationId)}.`,
    UnknownAssumption: ({ assumptionId }) =>
      `The model holds no assumption ${quotedForTerminal(assumptionId)}.`,
    DuplicateElementId: ({ elementId }) =>
      `The model already holds an element ${quotedForTerminal(elementId)}. To draw it on one more diagram, use place_element.`,
    DuplicateThreatId: ({ threatId }) =>
      `The model already holds a threat ${quotedForTerminal(threatId)}.`,
    DuplicateMitigationId: ({ mitigationId }) =>
      `The model already holds a mitigation ${quotedForTerminal(mitigationId)}.`,
    DuplicateAssumptionId: ({ assumptionId }) =>
      `The model already holds an assumption ${quotedForTerminal(assumptionId)}.`,
    RecordWithoutThreat: ({ record }) =>
      `The ${record.kind} ${quotedForTerminal(record.id)} links no threat, and a ${record.kind} is added on a threat.`,
    AssumptionWithoutReference: ({ assumptionId }) =>
      `The assumption ${quotedForTerminal(assumptionId)} links no threat and does not apply to the model.`,
    ReusedThreatNumber: ({ number }) =>
      `Threat number ${String(number)} was issued already, and a number is issued once.`,
    ChangedThreatNumber: ({ threatId, number }) =>
      `Threat ${quotedForTerminal(threatId)} cannot take number ${String(number)}, and no edit renumbers a threat.`,
    InvalidFlowEndpoint: ({ side, reference }) =>
      `The flow's ${side} names ${quotedForTerminal(reference)}, and a flow end attaches only to an actor, process or store of the diagram the edit draws it on, never to the element its other end is attached to.`,
    FlowEndNotAway: ({ elementId, diagramId, side }) =>
      `The ${side} of flow ${quotedForTerminal(elementId)} is not drawn away from its element on diagram ${quotedForTerminal(diagramId)}, so it has no point of its own there to move.`,
    NotResizable: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} has no size to set.`,
    NotTextElement: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is not a canvas note.`,
    NotFlowElement: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is not a flow.`,
    NotTrustBoundaryElement: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is not a trust boundary.`,
    EmptyName: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} cannot be left without a name.`,
    RefusedCharacter: ({ elementId, at }) =>
      `The text for element ${quotedForTerminal(elementId)} carries a character the model does not accept, at index ${String(at)}.`,
    RefusedMetadataCharacter: ({ field, at }) =>
      `The model ${field} carries a character the model does not accept, at index ${String(at)}.`,
    RefusedContributorCharacter: ({ contributor, at }) =>
      `Entry ${String(contributor)} of the contributors carries a character the model does not accept, at index ${String(at)}.`,
  });
}

/**
 * The refusal for an edit no case of a switch applies. The parameter is
 * `never`, so only a switch that handles every op compiles against it.
 */
export function unappliedEdit(
  _edit: never,
): Result.Result<Model, OperationFailure> {
  return Result.fail(
    OperationFailure.InvalidFragment({
      issues: [{ path: ['op'], detail: { code: 'operation-unknown' } }],
    }),
  );
}

function issueLines(issues: readonly ParseIssue[]): string {
  return issues.map((issue) => issueLine(issue, parseIssueText)).join(', ');
}
