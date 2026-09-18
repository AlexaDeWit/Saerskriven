import { gridSpacing } from '@saerskriven/canvas';
import { saerskrivenYamlCodec, withinTextLimit } from '@saerskriven/formats';
import {
  elementIdsAcross,
  elementsAcross,
  fragmentRecordCounts,
  generateElementId,
  remapFragment,
  selectionFragment,
  type Model,
  type SelectionFragmentFailure,
} from '@saerskriven/model';
import { Data, Effect, Either } from 'effect';
import { sentences, type Said, type Speaker } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { sameSelection } from '../store/selection.js';
import { activeDiagramId } from '../store/selectors.js';
import { FileLifecycle, type State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { describeOperation } from '../ui/failure-notice.js';
import { announce } from './announcements.js';
import { focusCanvas, focusElement, removeSelected } from './edits.js';

const marker = '# Saerskriven selection v1\n';
let lastPaste = '';
let pasteCount = 0;

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
  if (Either.isLeft(copy)) {
    announce(refusal(copy.left));
    return;
  }
  const written = await Effect.runPromise(
    Effect.either(
      Effect.tryPromise({
        try: async () => {
          await navigator.clipboard.writeText(copy.right.text);
        },
        catch: () => ClipboardFailure.WriteFailed(),
      }),
    ),
  );
  if (Either.isLeft(written)) {
    announce(refusal(written.left));
    return;
  }
  if (
    cut &&
    modelStore.getState().present === state.present &&
    sameSelection(modelStore.getState().selection, state.selection)
  ) {
    removeSelected();
    announce((t) =>
      sentences(
        t('canvas.cut'),
        copyReport(t, copy.right.report),
        t('canvas.cut-remains'),
      ),
    );
    focusCanvas();
  } else {
    announce((t) =>
      sentences(
        t('canvas.copied'),
        copyReport(t, copy.right.report),
        cut ? t('canvas.cut-abandoned') : '',
      ),
    );
  }
}

/** Duplicates through the same copy rules without changing the system clipboard. */
export function duplicateSelected(): void {
  const copy = selectedCopy(modelStore.getState());
  if (Either.isLeft(copy)) {
    announce(refusal(copy.left));
    return;
  }
  const { report } = copy.right;
  insertCopy(copy.right.fragment, gridSpacing, (t) =>
    sentences(t('canvas.duplicated'), copyReport(t, report)),
  );
}

/** Reads a bounded native selection from the system clipboard before one atomic insert. */
export async function pasteSelected(): Promise<void> {
  const state = modelStore.getState();
  const read = await Effect.runPromise(
    Effect.either(
      Effect.tryPromise({
        try: () => navigator.clipboard.readText(),
        catch: () => ClipboardFailure.ReadFailed(),
      }),
    ),
  );
  if (Either.isLeft(read)) {
    announce(refusal(read.left));
    return;
  }
  if (
    modelStore.getState().present !== state.present ||
    modelStore.getState().file !== state.file
  ) {
    announce((t) => t('canvas.paste-document-changed'));
    return;
  }
  const text = read.right;
  if (!text.startsWith(marker)) {
    announce((t) => t('canvas.paste-no-selection'));
    return;
  }
  const parsed = saerskrivenYamlCodec.read(text);
  if (
    Either.isLeft(parsed) ||
    parsed.right.divergences.length > 0 ||
    parsed.right.model.diagrams.length !== 1
  ) {
    announce((t) => t('canvas.paste-invalid'));
    return;
  }
  const count = text === lastPaste ? pasteCount + 1 : 1;
  if (
    insertCopy(parsed.right.model, gridSpacing * count, (t) =>
      t('canvas.pasted'),
    )
  ) {
    lastPaste = text;
    pasteCount = count;
  }
}

function insertCopy(fragment: Model, distance: number, said: Said): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined) {
    announce((t) => t('canvas.paste-no-diagram'));
    return false;
  }
  const remapped = remapFragment(
    fragment,
    generateElementId(),
    { x: distance, y: distance },
    state.present,
  );
  if (Either.isLeft(remapped)) {
    announce((t) => t('canvas.paste-remap-failed'));
    return false;
  }
  const { linked, cloned } = fragmentRecordCounts(
    state.present,
    remapped.right,
  );
  dispatch(Action.InsertFragment({ diagramId, fragment: remapped.right }));
  if (modelStore.getState().present === state.present) {
    return false;
  }
  const ids = elementsAcross(remapped.right.diagrams).map(
    (element) => element.id,
  );
  dispatch(Action.Select({ elementIds: ids }));
  const first = ids[0];
  if (first !== undefined) {
    focusElement(first);
  }
  announce((t) =>
    sentences(said(t), t('canvas.records-counts', { linked, cloned })),
  );
  return true;
}

function selectedCopy(state: State): Either.Either<
  {
    readonly fragment: Model;
    readonly text: string;
    readonly report: CopyReport;
  },
  ClipboardFailure
> {
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined || state.selection.length === 0) {
    return Either.left(ClipboardFailure.NothingSelected());
  }
  return Either.flatMap(
    Either.mapLeft(
      selectionFragment(state.present, diagramId, state.selection),
      (failure) => ClipboardFailure.Unfragmentable({ failure }),
    ),
    (fragment) => {
      const text = marker + saerskrivenYamlCodec.write(fragment).output;
      const limit = withinTextLimit(text);
      if (Either.isLeft(limit)) {
        return Either.left(ClipboardFailure.TooLarge());
      }
      const copiedIds = elementIdsAcross(fragment.diagrams);
      const excluded = externalLinkCount(state.present, fragment, copiedIds);
      return Either.right({
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
): number {
  const copiedThreats = new Set<string>(
    fragment.threats.map((threat) => threat.id),
  );
  const uncopied = (
    records: readonly {
      readonly id: string;
      readonly threats: readonly string[];
      readonly appliesToModel?: boolean;
    }[],
    copies: readonly { readonly id: string }[],
  ): number => {
    const copied = new Set(copies.map((copy) => copy.id));
    return records
      .filter((record) => copied.has(record.id))
      .reduce(
        (count, record) =>
          count +
          record.threats.filter((id) => !copiedThreats.has(id)).length +
          (record.appliesToModel === true ? 1 : 0),
        0,
      );
  };
  return (
    present.threats
      .filter((threat) => copiedThreats.has(threat.id))
      .reduce(
        (count, threat) =>
          count + threat.elements.filter((id) => !copiedIds.has(id)).length,
        0,
      ) +
    uncopied(present.mitigations, fragment.mitigations) +
    uncopied(present.assumptions, fragment.assumptions)
  );
}
