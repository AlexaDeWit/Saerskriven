import {
  ReadFailure,
  formatNameSchema,
  keptByWriteBack,
  readOrImport,
  retainedSource,
  type Divergence,
  type FormatName,
  type ImportFormat,
  type RetainedSource,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { formatNames } from '../format-names.js';
import type { StudioMessageId } from '../messages/catalogues.js';
import { Either } from 'effect';
import {
  lossLines,
  reportedDivergence,
  type Loss,
} from '../messages/divergence/text.js';
import type { Speaker } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { FileLifecycle, nameOf } from '../store/state.js';
import { OpenOutcome, SaveOutcome, type SaveFileType } from './bridge.js';

type FormatFile = {
  readonly label: string;
  readonly mediaType: string;
  readonly extensions: readonly string[];
};

/** The first extension is proposed for saving, and every listed extension identifies the format. */
export const formatFiles = {
  'threat-dragon': {
    label: formatNames['threat-dragon'],
    mediaType: 'application/json',
    extensions: ['.json'],
  },
  'saerskriven-yaml': {
    label: formatNames['saerskriven-yaml'],
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

/** The longest title, in characters, a proposed file name carries. */
export const fileTitleLimit = 80;

const unusableCharacters = new Set('/\\:*?"<>|');

function isUnusable(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    unusableCharacters.has(character) ||
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x2028 ||
    code === 0x2029
  );
}

/**
 * A diagram's or a model's title as a file name part. Each character a file
 * name cannot hold (`/ \ : * ? " < > |`, control characters, line breaks)
 * becomes `_`, runs of white space become one space, the title is cut to
 * {@link fileTitleLimit} characters, and leading and trailing dots and
 * spaces go. Letters are kept as they are, not slugged. A title with nothing
 * left becomes `untitled`, the translated default the caller passes.
 */
export function fileTitle(title: string, untitled: string): string {
  const cleaned = Array.from(title, (character) =>
    isUnusable(character) ? '_' : character,
  )
    .join('')
    .replace(/\s+/gu, ' ');
  const cut = Array.from(cleaned).slice(0, fileTitleLimit).join('');
  const trimmed = cut.replace(/^[. ]+|[. ]+$/gu, '');
  return trimmed === '' ? untitled : trimmed;
}

/**
 * The proposed export name, derived from the open file, or `untitled` in the
 * active language while there is none. A `diagramTitle` (already cleaned by
 * {@link fileTitle}) follows the stem as ` - <title>`.
 */
export function proposedExportName(
  file: FileLifecycle,
  extension: string,
  untitled: string,
  diagramTitle?: string,
): string {
  const suffix = diagramTitle === undefined ? '' : ` - ${diagramTitle}`;
  return withExtension(
    nameOf(file, untitled),
    `${suffix}${extension}`,
    untitled,
  );
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

/**
 * Cancellation produces no action. A file in a format Saerskriven only reads
 * opens as a new model under its own stem as YAML, and `untitled` names one
 * whose stem reduces to nothing, in the active locale.
 */
export function openedBy(
  outcome: OpenOutcome,
  untitled: string,
): Action | undefined {
  return OpenOutcome.$match(outcome, {
    Chosen: ({ name, text }) => actionForText(name, text, untitled),
    TooLarge: ({ name, bound, observed }) =>
      Action.ReadFailed({
        name,
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound,
          observed,
        }),
      }),
    Unreadable: ({ reason }) =>
      Action.FileRefused({ operation: 'open', reason }),
    Cancelled: () => undefined,
    NoPicker: () => undefined,
  });
}

/**
 * The name a model read from a shared link takes: its title as a file name
 * part, or `untitled` where nothing is left, with the native extension, since
 * a link holds the native format.
 */
export function linkFileName(title: string, untitled: string): string {
  return `${fileTitle(title, untitled)}${formatFiles[nativeFormat].extensions[0]}`;
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

type LossOccasion = 'open' | 'save';

/**
 * What one open or save lost that a person reads, and the model each line
 * names its subject from: the one opened or saved. `readOnlyFormat` is the
 * format of an opened file Saerskriven does not write, which opened as a new
 * model.
 */
export type LossReport = {
  readonly occasion: LossOccasion;
  readonly model: Model;
  readonly losses: readonly Loss[];
  readonly readOnlyFormat?: ImportFormat;
};

/** The message each occasion introduces its losses with. */
export const reportHeadlines = {
  open: 'reports.opened',
  save: 'reports.saved',
} as const satisfies Record<LossOccasion, StudioMessageId>;

/**
 * A report's lines in the caller's language, one per loss. The caller
 * supplies the translator so a component rewords a standing report on a
 * change of locale.
 */
export function reportLines(
  t: Speaker,
  { model, losses }: LossReport,
): readonly string[] {
  return lossLines(t, model, losses);
}

/**
 * What a read lost, naming the model it produced. An open of a format
 * Saerskriven writes says which losses saving back to the same file keeps.
 * One of a format it only reads keeps none, and always reports, since its
 * notice stands whatever it lost.
 */
export function openReport(
  read: Extract<Action, { readonly _tag: 'Opened' | 'Imported' }>,
): LossReport | undefined {
  return Action.$is('Opened')(read)
    ? reported(
        'open',
        read.model,
        lossesOf(read.divergences, (divergence) =>
          keptByWriteBack(read.source.format, divergence),
        ),
      )
    : {
        occasion: 'open',
        model: read.model,
        losses: lossesOf(read.divergences, () => false),
        readOnlyFormat: read.format,
      };
}

/**
 * What a shared link's read lost, naming the model it produced. A link has no
 * file to save back to, so no loss is one a save keeps, and a link that lost
 * nothing reports nothing.
 */
export function linkReport(
  model: Model,
  divergences: readonly Divergence[],
): LossReport | undefined {
  return unkeptReport('open', model, divergences);
}

/** What a save of `model` lost, and nothing at all where it lost nothing. */
export function saveReport(
  model: Model,
  divergences: readonly Divergence[],
): LossReport | undefined {
  return unkeptReport('save', model, divergences);
}

function unkeptReport(
  occasion: LossOccasion,
  model: Model,
  divergences: readonly Divergence[],
): LossReport | undefined {
  return reported(
    occasion,
    model,
    lossesOf(divergences, () => false),
  );
}

function reported(
  occasion: LossOccasion,
  model: Model,
  losses: readonly Loss[],
): LossReport | undefined {
  return losses.length === 0 ? undefined : { occasion, model, losses };
}

function lossesOf(
  divergences: readonly Divergence[],
  keeps: (divergence: Divergence) => boolean,
): readonly Loss[] {
  return divergences.flatMap((divergence): Loss[] => {
    const shown = reportedDivergence(divergence);
    return shown === undefined
      ? []
      : [{ divergence: shown, kept: keeps(divergence) }];
  });
}

function actionForText(name: string, text: string, untitled: string): Action {
  return Either.match(readOrImport(text), {
    onLeft: (failure) => Action.ReadFailed({ name, failure }),
    onRight: (read) =>
      'codec' in read
        ? Action.Opened({
            model: read.model,
            name,
            source: retainedSource(read),
            divergences: read.divergences,
          })
        : Action.Imported({
            model: read.model,
            name: proposedName(name, nativeFormat, untitled),
            format: read.format,
            divergences: read.divergences,
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
