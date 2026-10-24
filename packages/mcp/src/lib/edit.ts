import {
  divergenceLines,
  divergenceSchema,
  quotedForTerminal,
  retainedSource,
  unreadByThisVersion,
  writeThrough,
  writtenSaerskrivenYamlVersion,
  type DetectedRead,
  type Divergence,
} from '@saerskriven/formats';
import {
  recordReferenceSchema,
  threatSchema,
  type Model,
  type RecordReference,
  type Threat,
} from '@saerskriven/model';
import { Result, pipe } from 'effect';
import { z } from 'zod';
import {
  applyEdits,
  editOps,
  mergeReportSchema,
  modelEditSchema,
  renderRefusedEdit,
  type MergeReport,
} from './edits.js';
import { savedVersion } from './reading.js';
import { threatHeadingLine } from './threat-rows.js';
import {
  movedToVersion3Lines,
  namedFile,
  readBoundPhrase,
  renderWriteFailure,
  renderWriteReport,
  replacedFile,
  revisionArgumentSchema,
  serialized,
  unchangedSince,
  WriteFailure,
  writeReportSchema,
} from './write.js';
import {
  readModelFile,
  renderWorkspaceFailure,
  resultPath,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

export const editArgumentsSchema = revisionArgumentSchema.extend({
  edits: z
    .array(modelEditSchema)
    .min(1)
    .describe(
      'The edits to apply, in order. The batch is all or nothing: the first edit the model refuses stops it and nothing is written.',
    ),
  dropUndeclared: z
    .boolean()
    .default(false)
    .describe(
      'Whether to write a file holding what this version of saer cannot read, a key the wire schema does not declare or an accent value the model has no key for, dropping it. Left false, such a file is refused and nothing is written.',
    ),
});

export type EditArguments = z.infer<typeof editArgumentsSchema>;

export const editResultSchema = writeReportSchema.extend({
  applied: z.int().positive(),
  culled: z
    .array(recordReferenceSchema)
    .describe(
      'The mitigations and assumptions the file held before the batch that the batch culled by taking away their last reference: a threat link, or for an assumption its model link.',
    ),
  culledThreats: z
    .array(threatSchema)
    .describe(
      'The threats the file held before the batch that the batch culled by taking away their last reference, an element attachment or the model link, each as it stood before it went.',
    ),
  dropped: z
    .array(divergenceSchema)
    .describe(
      'What the file held that this version of saer cannot read and the write dropped, as `dropUndeclared` allowed: each key the wire schema does not declare, by its path, and each accent value the model has no key for, by its element.',
    ),
  merged: z
    .array(mergeReportSchema)
    .describe(
      'Each `merge_elements` edit of the batch, in order: the element merged, the element kept, the diagrams whose drawing of the merged element moved onto the kept one or was dropped where the kept one was already drawn, and the threats and flows that moved with it.',
    ),
  movedToVersion3: z
    .boolean()
    .describe(
      'Whether the batch moved a Saerskriven YAML file read as version 1 or 2 to version 3, by making the model hold what version 2 cannot. A release that reads only versions 1 and 2 refuses the file whole from then on. Always false for a file read as version 3, and for a Threat Dragon file.',
    ),
});

export type EditResult = z.infer<typeof editResultSchema>;

export const editDescription = [
  'Apply an ordered edit batch and save in the existing format. A Saerskriven YAML file is written as version 2, whichever version it was read from, while version 2 holds the model, and as version 3 once it holds what version 2 cannot: an element on more than one diagram, a flow end drawn away from its element, or a relationship list naming an element of another diagram. A release that reads only versions 1 and 2 refuses a version 3 file whole, and `movedToVersion3` in the result says when a batch moved a file read as version 1 or 2 there.',
  'Edits run on one parsed model with one final write. Any refused edit stops the batch without changing file bytes. The error names its index and reason.',
  `A batch that would take the file past ${readBoundPhrase}, is refused the same way, so make a smaller change rather than retrying it.`,
  `Each edit is an object carrying \`op\` and that op's own fields. The ops are ${editOps.join(', ')}.`,
  '`add_element` creates an element with its first placement, last on the diagram it names, and accepts the optional security facts and declared boundary relationships of its element kind. It refuses an empty name, or one of white space alone, on every kind but a flow, as `rename_element` does, and a flow end `reconnect_flow` would refuse. On a flow, `""` or white space alone leaves the flow unlabelled, stored as an empty name. `set_element_properties` patches those security facts and relationships and nothing else: it takes the element id and a `properties` object with the element kind and the fields to change, and has no variant for a text note, which carries neither. Omitted fields stay unchanged. Its optional `unset` list names fields to clear back to not recorded. False, empty text and empty lists are recorded values. A field cannot be set and unset in the same edit.',
  '`set_element_details` takes the element id and any of `description`, `outOfScope` and `reasonOutOfScope`, on any element kind including a text note, and a field left out keeps its value. The scope flag and its reason are independent: setting `outOfScope` to false keeps the reason. `rename_element` changes the name alone and refuses an empty name, or one of white space alone, on every kind but a flow, where `""` or white space alone leaves the flow unlabelled, and `edit_note` changes the text of a text note alone. These three and `set_element_properties` keep the element at its place on every diagram.',
  '`set_accent` gives every element listed in `elements` the key in `accent`, or clears theirs with `none`. A key means nothing to the model: it draws an element strong or light in one of four colours. `add_element` and `place_element` take `accent` on every kind, a text note included. Only the native YAML format holds accents and keeps one element on several diagrams: a Threat Dragon write splits such an element into a cell per diagram and reports it, and the file reads back as a separate element per cell.',
  "An element can be on more than one diagram, with its own geometry and accent on each. Its name, details, properties, note text and threats are the element's, so every other edit changes them on every diagram. `place_element` places an element the model holds on one more diagram, last there. Its `placement` is the geometry of the element's kind: an actor, process, store or text note takes a `position` and `size`, or `\"auto\"` for the next place on the shared grid, a trust boundary a `shape`, and a flow a `source` and a `target` with optional `waypoints`. Each end of a flow is `{}` or a pinned `side` where the element it attaches to is on that diagram, and otherwise the `position` it is drawn at. A flow on that diagram whose end was drawn away from the element attaches to it. It refuses an element already on that diagram, and geometry its kind does not take. `unplace_element` takes an element off one diagram. The element keeps its threats and its other placements, so nothing is culled, and a flow on that diagram attached to it stays attached, its end drawn away at the element's anchor there. It refuses the element's last diagram: remove the element with `remove_element` instead. To move an element to another diagram, keeping its id and its threats, place it there with `place_element` and take it off the first with `unplace_element`, in one batch. The flows attached to it stay attached but do not move: each stays on the diagrams it is on, with its end drawn away from the element on the first, so place a flow on the new diagram too, and take it off the first, to draw it there. `move_element`, `resize_element`, `set_boundary_shape`, `set_accent`, `set_flow_waypoints`, `reconnect_flow` and `set_flow_end_position` take an optional `diagram`, the diagram whose drawing the edit changes. It is needed only for an element on more than one diagram, which such an edit refuses without it, naming the diagrams the element is on. Every `diagram` an edit takes, except that of `add_diagram`, which is the new diagram's id, names a diagram the model holds by its id, or by its exact title where no diagram has that id. A title more than one diagram has is refused, naming their ids, since an edit changes one diagram where a read tool selects every match.",
  '`merge_elements` merges `element` into `into`, two elements of one kind that stand for the same thing, such as the copies a model made of an element for each diagram before one element could be on several. `into` keeps its id, name, details and security facts, and the model no longer holds `element`, whose own are dropped. Each boundary relationship list of `into` takes the ids of the same list of `element` after its own, once each and never naming `into`, so a copied boundary keeps the members of every diagram. Every other threat, flow end and relationship list naming `element` names `into` instead, once each. Each drawing of `element` becomes a drawing of `into`, with its geometry and accent, except on a diagram that already draws `into`, where it is dropped and the flows there attached to `element` attach to `into`. Nothing is culled. It refuses one id given as both, two kinds, a flow joining the two, and two flows that do not join the same two elements in the same direction, since a flow has the same ends on every diagram: merge the elements at their ends first. The result names under `merged`, for each merge, the diagrams its drawing moved on and was dropped on, and the threats and flows that moved. A merge that leaves `into` on more than one diagram moves a version 2 file to version 3.',
  "`remove_element` deletes the element from the model and from every diagram it is on, and culls the threats it was the last attachment of, so use `unplace_element` to take an element off one diagram and keep it on the others. It keeps the flows attached to the element and frees each attached end at the removed element's anchor on each diagram: the centre of an actor, process, store, text note or box boundary, the first point of a curve boundary, or a removed flow's first bend, else its first free end, else the canvas origin. `move_element` translates by `offset`, relative to where the element is, and an attached flow end stays on its element. `resize_element` sets the size of an actor, process, store, text note or box boundary, and refuses a flow or a curve boundary. `set_boundary_shape` replaces a trust boundary's shape with a box or a curve, either way round, and keeps its declared relationships, so no element moves in or out of it. `set_flow_waypoints` replaces a flow's bends whole. `reconnect_flow` attaches one end to an actor, process or store of the diagram the edit changes, never to the element its other end is attached to. The end reaches that element on every diagram the flow is on, and `anchor` pins it on the diagram the edit changes alone: another diagram that places the element leaves the side to the renderer, and one that does not draws the end away from it, where the end was drawn before. `set_flow_end_position` frees one end at a canvas position, or moves an end already free. An end attached to an element, on it or drawn away from it, is freed on every diagram the flow is on: at `position` on the diagram the edit changes, and where it was drawn on every other. `reverse_flow` swaps a flow's two ends, each with its pinned side or position, and reverses its bends, so it runs the other way along the same route. `remove_diagram` removes only an empty diagram, so empty it first: take an element also on another diagram off it with `unplace_element`, and remove the others with `remove_element`.",
  "No edit reorders the elements of a diagram or the diagrams of a model, or changes an element's kind or the id of anything the model holds.",
  'Pass the latest read `revision`. A changed file is refused: read again and reconsider the edit. The file is hashed again immediately before replacement. This is not a lock: a concurrent save between that check and replacement is overwritten without notice. Read in the same turn you edit. Concurrent tools can lose edits.',
  'A mitigation is added on at least one threat, and an assumption on at least one threat or applying to the model. `link_mitigation`, `unlink_mitigation`, `link_assumption` and `unlink_assumption` take the record id and a threat id. `link_assumption_to_model` and `unlink_assumption_from_model` take the assumption id. `set_mitigation_status` and `set_assumption_status` change the status and nothing else, and never change a threat status. `add_assumption` starts an assumption `unconfirmed` and not applying to the model where those fields are left out. `replace_assumption` takes the whole record, `appliesToModel` included.',
  "`set_threat_details` changes any of a threat's `title` and `description`, `set_mitigation_details` any of a mitigation's `title` and `prose`, and `set_assumption_details` an assumption's `prose`. Each takes the record id, a field left out keeps its value, and every other field and link of the record is kept. `replace_threat`, `replace_mitigation` and `replace_assumption` take the whole record, so use the details ops to change one text.",
  "A mitigation's references are its threat links. An assumption's references are its threat links and its model link. An edit that takes a record's last reference away (removing the threat that was its last reference, unlinking it, unlinking an assumption from the model where it links no threat, or a replace that leaves it none) removes the record in the same edit. The result names under `culled`, once each, every record the file held before the batch that an edit of the batch culled, even where a later edit adds it back. A record removed by `remove_mitigation` or `remove_assumption` is not named there, and neither is one the batch itself added.",
  "A threat applies to the elements it attaches to, to the model as a whole (`appliesToModel`), or to both, and those are its references. `link_threat_to_model` and `unlink_threat_from_model` take the threat id. `add_threat` starts a threat not applying to the model where that field is left out, and `replace_threat` takes the whole record, `appliesToModel` included. An edit that takes a threat's last reference away (`detach_threat`, `remove_element` on the element that was its last, `unlink_threat_from_model` where it attaches to no element, or a `replace_threat` that leaves it none) removes the threat in the same edit, with the cascade `remove_threat` carries. A threat that applies to the model stays when its last attachment goes, a threat the file already held with no reference stays, and no read ever culls one. The result names culled threats under `culledThreats` on the same terms as `culled`, a threat removed by `remove_threat` not among them.",
  'Do not supply threat numbers. The model assigns unique numbers on add and keeps them on replacement.',
  'A file holding what this version of saer cannot read, a key the wire schema does not declare or an accent value the model has no key for, both of which a read reports as divergences, is refused and nothing is written, since the write would drop them. The refusal names each one, a key by its path and an accent by its element: upgrade saer to keep them, or pass `dropUndeclared: true` to write the file without them, and the result names each one it dropped under `dropped`.',
  'Requires an existing model. Use saer_create for a new one or saer_import for a foreign file. Review result divergences after writing Threat Dragon: unsupported model data is reported there, without refusing the write.',
].join(' ');

/** Validate the revision and batch, then check the revision again before replacement. */
export function editModel(
  workspace: ModelWorkspace,
  args: EditArguments,
): Result.Result<EditResult, readonly string[]> {
  return pipe(
    namedFile(workspace, args.file),
    Result.mapError(renderWriteFailure),
    Result.flatMap((named) =>
      Result.mapError(
        readModelFile(named.workspace, named.file),
        renderWorkspaceFailure,
      ),
    ),
    Result.flatMap((read) =>
      Result.mapError(
        unchangedSince(resultPath(workspace, read.path), args.revision, read),
        renderWriteFailure,
      ),
    ),
    Result.flatMap((read) =>
      Result.mapBoth(droppable(workspace, read, args.dropUndeclared), {
        onFailure: renderWriteFailure,
        onSuccess: (dropped) => ({ read, dropped }),
      }),
    ),
    Result.flatMap(({ read, dropped }) =>
      Result.mapBoth(applyEdits(read.read.model, args.edits), {
        onFailure: renderRefusedEdit,
        onSuccess: (batch) => ({ read, batch, dropped }),
      }),
    ),
    Result.flatMap(({ read, batch, dropped }) =>
      saved(workspace, read, batch.model, {
        applied: args.edits.length,
        culled: [...batch.culled],
        culledThreats: [...batch.culledThreats],
        merged: [...batch.merged],
        dropped: [...dropped],
        movedToVersion3: movedToVersion3(read.read, batch.model),
      }),
    ),
  );
}

/** The edited file as the lines its text result carries. */
export function renderEdit(result: EditResult): readonly string[] {
  return [
    `edits applied: ${String(result.applied)}`,
    ...movedToVersion3Lines(result.movedToVersion3),
    ...(result.merged.length === 0
      ? []
      : ['merged:', ...result.merged.map(mergedLine)]),
    'culled:',
    ...(result.culled.length === 0
      ? ['No record culled.']
      : result.culled.map(culledLine)),
    'threats culled:',
    ...(result.culledThreats.length === 0
      ? ['No threat culled.']
      : result.culledThreats.map(culledThreatLine)),
    'dropped:',
    ...(result.dropped.length === 0
      ? ['Nothing dropped.']
      : divergenceLines(result.dropped)),
    ...renderWriteReport(result),
  ];
}

function mergedLine(merge: MergeReport): string {
  return `element ${quotedForTerminal(merge.element)} into ${quotedForTerminal(merge.into)}: placement moved on ${listed(merge.movedOn)}, placement dropped on ${listed(merge.droppedOn)}, threats moved ${listed(merge.threats)}, flows moved ${listed(merge.flows)}`;
}

function listed(ids: readonly string[]): string {
  return ids.length === 0
    ? 'none'
    : ids.map((id) => quotedForTerminal(id)).join(', ');
}

function culledLine(record: RecordReference): string {
  return `${record.kind} ${quotedForTerminal(record.id)}`;
}

function culledThreatLine(threat: Threat): string {
  return `threat ${threatHeadingLine(threat)}`;
}

function movedToVersion3(read: DetectedRead, model: Model): boolean {
  return (
    read.format === 'saerskriven-yaml' &&
    read.statedVersion < 3 &&
    writtenSaerskrivenYamlVersion(model) === 3
  );
}

function droppable(
  workspace: ModelWorkspace,
  read: ReadModelFile,
  drop: boolean,
): Result.Result<readonly Divergence[], WriteFailure> {
  const dropped = read.read.divergences.filter(unreadByThisVersion);
  return dropped.length === 0 || drop
    ? Result.succeed(dropped)
    : Result.fail(
        WriteFailure.WouldDrop({
          file: resultPath(workspace, read.path),
          dropped,
        }),
      );
}

function saved(
  workspace: ModelWorkspace,
  read: ReadModelFile,
  model: Model,
  batch: Pick<
    EditResult,
    | 'applied'
    | 'culled'
    | 'culledThreats'
    | 'merged'
    | 'dropped'
    | 'movedToVersion3'
  >,
): Result.Result<EditResult, readonly string[]> {
  const file = resultPath(workspace, read.path);
  return pipe(
    serialized(file, () => writeThrough(model, retainedSource(read.read))),
    Result.flatMap((written) =>
      Result.map(
        replacedFile({ file, path: read.path }, written.output, read.revision),
        (revision): EditResult => ({
          file,
          format: read.read.format,
          ...savedVersion(read.read.format, model),
          revision,
          ...batch,
          divergences: [...written.divergences],
        }),
      ),
    ),
    Result.mapError(renderWriteFailure),
  );
}
