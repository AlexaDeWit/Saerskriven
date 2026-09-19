import {
  importModel,
  ReadFailure,
  formatNameSchema,
  hasDiverged,
  saerskrivenYamlCodec,
  readAnyFormat,
  threatDragonCodec,
  type DetectedRead,
  type Divergence,
  type FormatName,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import type { StudioMessageId } from '../messages/catalogues.js';
import { Either } from 'effect';
import {
  divergenceDetail,
  divergenceLine,
} from '../messages/divergence/text.js';
import type { Speaker } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { FileLifecycle, nameOf, type RetainedSource } from '../store/state.js';
import { OpenOutcome, SaveOutcome, type SaveFileType } from './bridge.js';

type FormatFile = {
  readonly label: string;
  readonly mediaType: string;
  readonly extensions: readonly string[];
};

/** The first extension is proposed for saving, and every listed extension identifies the format. */
export const formatFiles = {
  'threat-dragon': {
    label: 'Threat Dragon JSON',
    mediaType: 'application/json',
    extensions: ['.json'],
  },
  'saerskriven-yaml': {
    label: 'Saerskriven YAML',
    mediaType: 'application/yaml',
    extensions: ['.yaml', '.yml'],
  },
} as const satisfies Record<FormatName, FormatFile>;

const nativeFormat: FormatName = 'saerskriven-yaml';

/** Which format the open file is in, and the native one while there is none. */
export function formatOf(file: FileLifecycle): FormatName {
  return FileLifecycle.$match(file, {
    NoFile: () => nativeFormat,
    Opened: ({ source }) => source.format,
  });
}

/** Offers every registered format with the current format first. */
export function formatsFrom(format: FormatName): readonly FormatName[] {
  return [
    format,
    ...formatNameSchema.options.filter((option) => option !== format),
  ];
}

/** Describes the supplied formats for a platform picker. */
export function saveTypes(
  formats: readonly FormatName[],
): readonly SaveFileType[] {
  return formats.map((option) => ({
    description: formatFiles[option].label,
    accept: { [formatFiles[option].mediaType]: formatFiles[option].extensions },
  }));
}

/** The chosen file extension determines the write codec. */
export function formatOfName(name: string): FormatName | undefined {
  const written = name.toLowerCase();
  return formatNameSchema.options.find((option) =>
    formatFiles[option].extensions.some((extension) =>
      written.endsWith(extension),
    ),
  );
}

/**
 * Replaces the extension and supplies a stem when the name has none. The
 * caller passes the stem in the active locale.
 */
export function proposedName(
  name: string,
  format: FormatName,
  untitled: string,
): string {
  return withExtension(name, formatFiles[format].extensions[0], untitled);
}

/**
 * The proposed export name, derived from the open file, or `untitled` in the
 * active language while there is none.
 */
export function proposedExportName(
  file: FileLifecycle,
  extension: string,
  untitled: string,
): string {
  return withExtension(nameOf(file, untitled), extension, untitled);
}

/** Where a save writes, and the document it merges the model onto. */
export type SaveTarget = {
  readonly name: string;
  readonly source: RetainedSource;
};

/**
 * Same-format saves retain the source document for merging. Other formats
 * project the model. The caller passes the stem an unnamed document
 * proposes, in the active locale.
 */
export function saveTarget(
  file: FileLifecycle,
  format: FormatName,
  untitled: string,
): SaveTarget {
  return FileLifecycle.$match(file, {
    NoFile: () => ({
      name: `${untitled}${formatFiles[format].extensions[0]}`,
      source: { format, document: undefined },
    }),
    Opened: ({ name, source }) =>
      source.format === format
        ? { name, source }
        : {
            name: proposedName(name, format, untitled),
            source: { format, document: undefined },
          },
  });
}

/** Pairs each retained document with the codec for its format. */
export function writeThrough(
  model: Model,
  source: RetainedSource,
): WriteResult {
  return source.format === 'threat-dragon'
    ? threatDragonCodec.write(model, source.document)
    : saerskrivenYamlCodec.write(model, source.document);
}

/** The selected read operation determines whether the source remains a save target. */
export type ReadIntent = 'open' | 'import';

/**
 * Cancellation produces no action. Import refuses without changing the
 * current file. `untitled` names an import whose own stem reduces to
 * nothing, in the active locale.
 */
export function openedBy(
  outcome: OpenOutcome,
  untitled: string,
  intent: ReadIntent = 'open',
): Action | undefined {
  const failed = intent === 'import' ? Action.ImportFailed : Action.ReadFailed;
  return OpenOutcome.$match(outcome, {
    Chosen: ({ name, text }) =>
      intent === 'import'
        ? actionForImport(name, text, untitled)
        : actionForText(name, text),
    TooLarge: ({ name, bound, observed }) =>
      failed({
        name,
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound,
          observed,
        }),
      }),
    Unreadable: ({ reason }) =>
      Action.FileRefused({ operation: intent, reason }),
    Cancelled: () => undefined,
    NoPicker: () => undefined,
  });
}

/** Uses the written name and identifies save refusals so the existing file remains available for retry. */
export function savedBy(
  outcome: SaveOutcome,
  source: RetainedSource,
): Action | undefined {
  return SaveOutcome.$match(outcome, {
    Written: ({ name }) => Action.Saved({ name, source }),
    Cancelled: () => undefined,
    Refused: ({ reason }) => Action.FileRefused({ operation: 'save', reason }),
  });
}

/**
 * A report's lines in the caller's language, one per divergence. The caller
 * supplies the translator so a component re-words a standing report on a
 * change of locale. An import charges every entry to the model, so its lines
 * carry the detail alone.
 */
export function reportLines(
  t: Speaker,
  divergences: readonly Divergence[],
  occasion?: LossOccasion,
): readonly string[] {
  return occasion === 'import'
    ? divergences.map(({ detail }) => divergenceDetail(t, detail))
    : divergences.map((divergence) => divergenceLine(t, divergence));
}

type LossOccasion = 'open' | 'save' | 'import';

/** What one open or one save cost, and which of the two it was. */
export type LossReport = {
  readonly occasion: LossOccasion;
  readonly divergences: readonly Divergence[];
};

/** The message each occasion introduces its report with. */
export const reportHeadlines = {
  open: 'reports.opened',
  import: 'reports.imported',
  save: 'reports.saved',
} as const satisfies Record<LossOccasion, StudioMessageId>;

/** Reports losses from reading, including fields absent from the retained document. */
export function openReport(
  divergences: readonly Divergence[],
  occasion: ReadIntent = 'open',
): LossReport | undefined {
  return reported(occasion, divergences);
}

/** What a save cost, and nothing at all where it carried everything. */
export function saveReport(
  divergences: readonly Divergence[],
): LossReport | undefined {
  return reported('save', divergences);
}

function retainedSource(read: DetectedRead): RetainedSource {
  return read.format === 'threat-dragon'
    ? { format: 'threat-dragon', document: read.source }
    : { format: 'saerskriven-yaml', document: read.source };
}

function reported(
  occasion: LossOccasion,
  divergences: readonly Divergence[],
): LossReport | undefined {
  return hasDiverged(divergences) ? { occasion, divergences } : undefined;
}

function actionForText(name: string, text: string): Action {
  return Either.match(readAnyFormat(text), {
    onLeft: (failure) => Action.ReadFailed({ name, failure }),
    onRight: (read) =>
      Action.Opened({
        model: read.model,
        name,
        source: retainedSource(read),
        divergences: read.divergences,
      }),
  });
}

function actionForImport(name: string, text: string, untitled: string): Action {
  return Either.match(importModel(text), {
    onLeft: (failure) => Action.ImportFailed({ name, failure }),
    onRight: ({ model, divergences }) =>
      Action.Imported({
        model,
        name: proposedName(name, nativeFormat, untitled),
        divergences,
      }),
  });
}

function withExtension(
  name: string,
  extension: string,
  fallback: string,
): string {
  const stem = name.replace(/\.[^./\\]*$/u, '').trim();
  return `${stem === '' ? fallback : stem}${extension}`;
}
