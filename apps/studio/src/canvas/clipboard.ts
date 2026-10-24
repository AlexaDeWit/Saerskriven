import { layoutDiagram, gridSpacing } from '@saerskriven/canvas';
import { saerskrivenYamlCodec, withinTextLimit } from '@saerskriven/formats';
import {
  elementIdsAcross,
  fragmentHeldThreats,
  fragmentRecordCounts,
  generateElementId,
  remapFragment,
  selectionFragment,
  type Model,
  type Point,
  type SelectionFragmentFailure,
} from '@saerskriven/model';
import { Data, Effect, Result } from 'effect';
import { sentences, type Said, type Speaker } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { sameSelection } from '../store/selection.js';
import { activeDiagramId } from '../store/selectors.js';
import { FileLifecycle, type State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { writeClipboard } from '../system-clipboard.js';
import { describeOperation } from '../ui/failure-notice.js';
import { announce } from './announcements.js';
import { commandDecimals } from './stored-decimals.js';
import {
  deletedFromModel,
  focusCanvas,
  focusElement,
  removalCascade,
  removeSelected,
} from './edits.js';

const marker = '# Saerskriven selection v1\n';

type ClipboardFailure = Data.TaggedEnum<{
  NothingSelected: {};
  Unfragmentable: { readonly failure: SelectionFragmentFailure };
  TooLarge: {};
  WriteFailed: {};
  ReadFailed: {};
}>;
const ClipboardFailure = Data.taggedEnum<ClipboardFailure>();

type CopyReport = {
  readonly elements: number;
  readonly threats: number;
  readonly excluded: number;
  readonly sourceFields: boolean;
};

/** Copies the selection to the system clipboard and cuts only after a successful write. */
export async function copySelected(cut = false): Promise<void> {
  const state = modelStore.getState();
  const copy = selectedCopy(state);
  if (Result.isFailure(copy)) {
    announce(refusal(copy.failure));
    return;
  }
  if (Result.isFailure(await writeClipboard(copy.success.text))) {
    announce(refusal(ClipboardFailure.WriteFailed()));
    return;
  }
  const { report } = copy.success;
  if (
    cut &&
    modelStore.getState().present === state.present &&
    sameSelection(modelStore.getState().selection, state.selection)
  ) {
    const removed = removalCascade(
      state.present,
      deletedFromModel(state),
    ).threats;
    removeSelected();
    announce((t) =>
      sentences(
        t('canvas.cut'),
        copyReport(t, report),
        t('canvas.cut-threat-counts', { copied: report.threats, removed }),
        t('canvas.cut-remains'),
      ),
    );
    focusCanvas();
  } else {
    announce((t) =>
      sentences(
        t('canvas.copied'),
        copyReport(t, report),
        cut ? t('canvas.cut-abandoned') : '',
      ),
    );
  }
}

/** Duplicates without changing the clipboard or copying threats already held in the model. */
export function duplicateSelected(): void {
  const state = modelStore.getState();
  const copy = selectedCopy(state, state.present);
  if (Result.isFailure(copy)) {
    announce(refusal(copy.failure));
    return;
  }
  const { report } = copy.success;
  insertCopy(copy.success.fragment, { x: gridSpacing, y: gridSpacing }, (t) =>
    sentences(t('canvas.duplicated'), copyReport(t, report)),
  );
}

/** Reads a bounded native selection from the system clipboard before one atomic insert. */
export async function pasteSelected(
  centre: () => Point = () => ({ x: 0, y: 0 }),
): Promise<void> {
  const state = modelStore.getState();
  const read = await Effect.runPromise(
    Effect.result(
      Effect.tryPromise({
        try: () => navigator.clipboard.readText(),
        catch: () => ClipboardFailure.ReadFailed(),
      }),
    ),
  );
  if (Result.isFailure(read)) {
    announce(refusal(read.failure));
    return;
  }
  if (
    modelStore.getState().present !== state.present ||
    modelStore.getState().file !== state.file
  ) {
    announce((t) => t('canvas.paste-document-changed'));
    return;
  }
  const text = read.success;
  if (!text.startsWith(marker)) {
    announce((t) => t('canvas.paste-no-selection'));
    return;
  }
  const parsed = saerskrivenYamlCodec.read(text);
  if (
    Result.isFailure(parsed) ||
    parsed.success.divergences.length > 0 ||
    parsed.success.model.diagrams.length !== 1
  ) {
    announce((t) => t('canvas.paste-invalid'));
    return;
  }
  const fragment = parsed.success.model;
  const diagram = fragment.diagrams[0];
  if (diagram === undefined) {
    return;
  }
  const bounds = layoutDiagram(diagram, fragment).bounds;
  const at = centre();
  insertCopy(
    fragment,
    {
      x: at.x - bounds.x - bounds.width / 2,
      y: at.y - bounds.y - bounds.height / 2,
    },
    (t) => t('canvas.pasted'),
  );
}

function insertCopy(fragment: Model, offset: Point, said: Said): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined) {
    announce((t) => t('canvas.paste-no-diagram'));
    return false;
  }
  const remapped = remapFragment(
    fragment,
    generateElementId(),
    offset,
    state.present,
    commandDecimals,
  );
  if (Result.isFailure(remapped)) {
    announce((t) => t('canvas.paste-remap-failed'));
    return false;
  }
  const { linked, cloned } = fragmentRecordCounts(
    state.present,
    remapped.success,
  );
  const attached = fragmentHeldThreats(state.present, remapped.success).length;
  dispatch(Action.InsertFragment({ diagramId, fragment: remapped.success }));
  if (modelStore.getState().present === state.present) {
    return false;
  }
  const ids = remapped.success.elements.map((element) => element.id);
  dispatch(Action.Select({ elementIds: ids }));
  const first = ids[0];
  if (first !== undefined) {
    focusElement(first);
  }
  announce((t) =>
    sentences(
      said(t),
      attached > 0 ? t('canvas.threats-attached', { attached }) : '',
      t('canvas.records-counts', { linked, cloned }),
    ),
  );
  return true;
}

function selectedCopy(
  state: State,
  target?: Model,
): Result.Result<
  {
    readonly fragment: Model;
    readonly text: string;
    readonly report: CopyReport;
  },
  ClipboardFailure
> {
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined || state.selection.length === 0) {
    return Result.fail(ClipboardFailure.NothingSelected());
  }
  return Result.flatMap(
    Result.mapError(
      selectionFragment(state.present, diagramId, state.selection),
      (failure) => ClipboardFailure.Unfragmentable({ failure }),
    ),
    (fragment) => {
      const text = marker + saerskrivenYamlCodec.write(fragment).output;
      const limit = withinTextLimit(text);
      if (Result.isFailure(limit)) {
        return Result.fail(ClipboardFailure.TooLarge());
      }
      const copiedIds = elementIdsAcross(fragment.diagrams);
      const held =
        target === undefined ? [] : fragmentHeldThreats(target, fragment);
      const excluded = externalLinkCount(
        state.present,
        fragment,
        copiedIds,
        new Set(held.map((threat) => threat.id)),
      );
      return Result.succeed({
        fragment,
        text,
        report: {
          elements: copiedIds.size,
          threats: fragment.threats.length,
          excluded,
          sourceFields:
            FileLifecycle.$is('Opened')(state.file) &&
            state.file.source.format === 'threat-dragon',
        },
      });
    },
  );
}

function copyReport(t: Speaker, report: CopyReport): string {
  return sentences(
    t('canvas.copy-counts', report),
    report.sourceFields ? t('canvas.copy-source-fields') : '',
  );
}

function refusal(failure: ClipboardFailure): Said {
  return (t) =>
    ClipboardFailure.$match(failure, {
      NothingSelected: () => t('canvas.copy-nothing-selected'),
      Unfragmentable: ({ failure: refused }) =>
        sentences(t('canvas.copy-refused'), ...describeOperation(t, refused)),
      TooLarge: () => t('canvas.copy-too-large'),
      WriteFailed: () => t('canvas.clipboard-write-failed'),
      ReadFailed: () => t('canvas.clipboard-read-failed'),
    });
}

function externalLinkCount(
  present: Model,
  fragment: Model,
  copiedIds: ReadonlySet<string>,
  held: ReadonlySet<string>,
): number {
  const copiedThreats = new Set<string>(
    fragment.threats.map((threat) => threat.id).filter((id) => !held.has(id)),
  );
  const uncopied = (
    records: readonly {
      readonly id: string;
      readonly threats: readonly string[];
      readonly appliesToModel?: boolean;
    }[],
    copies: readonly {
      readonly id: string;
      readonly threats: readonly string[];
    }[],
  ): number => {
    const copied = new Set(
      copies
        .filter((copy) => copy.threats.some((id) => copiedThreats.has(id)))
        .map((copy) => copy.id),
    );
    return records
      .filter((record) => copied.has(record.id))
      .reduce(
        (count, record) =>
          count +
          record.threats.filter((id) => !copiedThreats.has(id) && !held.has(id))
            .length +
          (record.appliesToModel === true ? 1 : 0),
        0,
      );
  };
  return (
    present.threats
      .filter((threat) => copiedThreats.has(threat.id))
      .reduce(
        (count, threat) =>
          count +
          threat.elements.filter((id) => !copiedIds.has(id)).length +
          (threat.appliesToModel ? 1 : 0),
        0,
      ) +
    uncopied(present.mitigations, fragment.mitigations) +
    uncopied(present.assumptions, fragment.assumptions)
  );
}
