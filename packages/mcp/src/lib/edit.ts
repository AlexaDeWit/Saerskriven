import {
  quotedForTerminal,
  retainedSource,
  writeThrough,
} from '@saerskriven/formats';
import {
  recordReferenceSchema,
  threatSchema,
  type Model,
  type RecordReference,
  type Threat,
} from '@saerskriven/model';
import { Either, pipe } from 'effect';
import { z } from 'zod';
import {
  applyEdits,
  editOps,
  modelEditSchema,
  renderRefusedEdit,
} from './edits.js';
import { threatHeadingLine } from './threat-rows.js';
import {
  namedFile,
  readBoundPhrase,
  renderWriteFailure,
  renderWriteReport,
  replacedFile,
  revisionArgumentSchema,
  serialized,
  unchangedSince,
  writeReportSchema,
} from './write.js';
import {
  readModelFile,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

/** What `saer_edit` takes: the file, the handle it was read at, and the batch. */
export const editArgumentsSchema = revisionArgumentSchema.extend({
  edits: z
    .array(modelEditSchema)
    .min(1)
    .describe(
      'The edits to apply, in order. The batch is all or nothing: the first edit the model refuses stops it and nothing is written.',
    ),
});

/** What `saer_edit` takes. */
export type EditArguments = z.infer<typeof editArgumentsSchema>;

/** What `saer_edit` answers with. */
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
      'The threats the file held before the batch that the batch culled by taking away their last element attachment, each as it stood before it went.',
    ),
});

/** What `saer_edit` answers with. */
export type EditResult = z.infer<typeof editResultSchema>;

/** What `saer_edit` tells a client it is for. */
export const editDescription = [
  'Apply a batch of edits to one Saerskriven threat model file and save the file in the format it is already in. A Saerskriven YAML file is written as version 2, whichever version it was read from.',
  'The edits are applied in order to one parsed model, and the file is written once at the end. The first edit the model refuses stops the batch: nothing is written, the file stays byte for byte as it was, and the result names the index that was refused and what the model said about it. The batch is the unit of change rather than the edit.',
  `A batch that would take the file past ${readBoundPhrase}, is refused the same way, so make a smaller change rather than retrying it.`,
  `Each edit is an object carrying \`op\` and that op's own fields. The ops are ${editOps.join(', ')}.`,
  '`add_element` appends an element to a diagram and accepts the optional security facts and declared boundary relationships of its element kind. It refuses an empty name, or one of white space alone, on every kind but a flow, as `rename_element` does, and a flow end `reconnect_flow` would refuse. On a flow, `""` or white space alone leaves the flow unlabelled, stored as an empty name. `set_element_properties` patches those security facts and relationships and nothing else: it takes the element id and a `properties` object with the element kind and the fields to change, and has no variant for a text note, which carries neither. Omitted fields stay unchanged. Its optional `unset` list names fields to clear back to not recorded. False, empty text and empty lists are recorded values. A field cannot be set and unset in the same edit.',
  '`set_element_details` takes the element id and any of `description`, `outOfScope` and `reasonOutOfScope`, on any element kind including a text note, and a field left out keeps its value. The scope flag and its reason are independent: setting `outOfScope` to false keeps the reason. `rename_element` changes the name alone and refuses an empty name, or one of white space alone, on every kind but a flow, where `""` or white space alone leaves the flow unlabelled, and `edit_note` changes the text of a text note alone. These three and `set_element_properties` keep the element at its place in its diagram\'s element list.',
  "`remove_element` keeps the flows attached to the element and frees each attached end at the removed element's anchor: the centre of an actor, process, store, text note or box boundary, the first point of a curve boundary, or a removed flow's first bend, else its first free end, else the canvas origin. `move_element` translates by `offset`, relative to where the element is, and an attached flow end stays on its element. `resize_element` sets the size of an actor, process, store, text note or box boundary, and refuses a flow or a curve boundary. `set_boundary_shape` replaces a trust boundary's shape with a box or a curve, either way round, and keeps its declared relationships, so no element moves in or out of it. `set_flow_waypoints` replaces a flow's bends whole. `reconnect_flow` attaches one end to an actor, process or store of the flow's own diagram, never to the element its other end is attached to. `set_flow_end_position` frees one end at a canvas position, or moves an end already free. `reverse_flow` swaps a flow's two ends, each with its pinned side or position, and reverses its bends, so it runs the other way along the same route. `remove_diagram` removes only an empty diagram, so remove its elements first.",
  "No edit reorders the elements of a diagram or the diagrams of a model, moves an element to another diagram, or changes an element's kind or the id of anything the model holds.",
  'Pass `revision` as the handle the last read of this file returned. A file that changed before this call is refused rather than overwritten, and the answer to that refusal is to read the file again and reconsider the edit against what the file now holds. The file is hashed again immediately before it is replaced, so a change that landed while this call was working is refused there instead of overwritten. That check is not a lock: a save landing between it and the replacement is still overwritten with neither side told, so read the file in the same turn you edit it, and expect to lose an edit where somebody is working in the same file from another tool.',
  'A mitigation is added on at least one threat, and an assumption on at least one threat or applying to the model. `link_mitigation`, `unlink_mitigation`, `link_assumption` and `unlink_assumption` take the record id and a threat id. `link_assumption_to_model` and `unlink_assumption_from_model` take the assumption id. `set_mitigation_status` and `set_assumption_status` change the status and nothing else, and never change a threat status. `add_assumption` starts an assumption `unconfirmed` and not applying to the model where those fields are left out. `replace_assumption` takes the whole record, `appliesToModel` included.',
  "`set_threat_details` changes any of a threat's `title` and `description`, `set_mitigation_details` any of a mitigation's `title` and `prose`, and `set_assumption_details` an assumption's `prose`. Each takes the record id, a field left out keeps its value, and every other field and link of the record is kept. `replace_threat`, `replace_mitigation` and `replace_assumption` take the whole record, so use the details ops to change one text.",
  "A mitigation's references are its threat links. An assumption's references are its threat links and its model link. An edit that takes a record's last reference away (removing the threat that was its last reference, unlinking it, unlinking an assumption from the model where it links no threat, or a replace that leaves it none) removes the record in the same edit. The result names under `culled`, once each, every record the file held before the batch that an edit of the batch culled, even where a later edit adds it back. A record removed by `remove_mitigation` or `remove_assumption` is not named there, and neither is one the batch itself added.",
  "A threat's references are its element attachments. An edit that takes a threat's last attachment away (`detach_threat`, `remove_element` on the element that was its last, or a `replace_threat` that leaves it none) removes the threat in the same edit, with the cascade `remove_threat` carries. A threat the file already held attached to nothing stays, and no read ever culls one. The result names culled threats under `culledThreats` on the same terms as `culled`, a threat removed by `remove_threat` not among them.",
  'A threat carries no number: the model issues one when a threat is added and holds it when the threat is replaced, so no edit renumbers a threat, and no two threats hold one number.',
  'Use this on a model that exists. Start a new one with saer_create and convert a foreign file with saer_import. What the file format cannot hold comes back in the divergences of the result rather than as a refusal, so read them after a write to a Threat Dragon file.',
].join(' ');

/**
 * The batch applied and the file written, or the lines saying why nothing
 * was written. The file is read, checked against the revision the call
 * quoted, and edited in memory, so every refusal down to the write happens
 * before anything reaches the disk. The write checks the handle once more
 * against the file itself, and what that leaves open is on
 * {@link replacedFile}.
 */
export function editModel(
  workspace: ModelWorkspace,
  args: EditArguments,
): Either.Either<EditResult, readonly string[]> {
  return pipe(
    namedFile(workspace, args.file),
    Either.mapLeft(renderWriteFailure),
    Either.flatMap((named) =>
      Either.mapLeft(readModelFile(workspace, named), renderWorkspaceFailure),
    ),
    Either.flatMap((read) =>
      Either.mapLeft(
        unchangedSince(withinRoot(workspace, read.path), args.revision, read),
        renderWriteFailure,
      ),
    ),
    Either.flatMap((read) =>
      Either.mapBoth(applyEdits(read.read.model, args.edits), {
        onLeft: renderRefusedEdit,
        onRight: (batch) => ({ read, batch }),
      }),
    ),
    Either.flatMap(({ read, batch }) =>
      saved(workspace, read, batch.model, {
        applied: args.edits.length,
        culled: [...batch.culled],
        culledThreats: [...batch.culledThreats],
      }),
    ),
  );
}

/** The edited file as the lines its text result carries. */
export function renderEdit(result: EditResult): readonly string[] {
  return [
    `edits applied: ${String(result.applied)}`,
    'culled:',
    ...(result.culled.length === 0
      ? ['No record culled.']
      : result.culled.map(culledLine)),
    'threats culled:',
    ...(result.culledThreats.length === 0
      ? ['No threat culled.']
      : result.culledThreats.map(culledThreatLine)),
    ...renderWriteReport(result),
  ];
}

function culledLine(record: RecordReference): string {
  return `${record.kind} ${quotedForTerminal(record.id)}`;
}

function culledThreatLine(threat: Threat): string {
  return `threat ${threatHeadingLine(threat)}`;
}

function saved(
  workspace: ModelWorkspace,
  read: ReadModelFile,
  model: Model,
  batch: Pick<EditResult, 'applied' | 'culled' | 'culledThreats'>,
): Either.Either<EditResult, readonly string[]> {
  const file = withinRoot(workspace, read.path);
  return pipe(
    serialized(file, () => writeThrough(model, retainedSource(read.read))),
    Either.flatMap((written) =>
      Either.map(
        replacedFile({ file, path: read.path }, written.output, read.revision),
        (revision): EditResult => ({
          file,
          format: read.read.format,
          revision,
          ...batch,
          divergences: [...written.divergences],
        }),
      ),
    ),
    Either.mapLeft(renderWriteFailure),
  );
}
