import type {
  DetectionFailure,
  ReadFailure,
  RetainedSource,
} from '@saerskriven/formats';
import type { ShareLinkFailure } from '@saerskriven/formats/share-link';
import {
  emptyModel,
  parseModel,
  type DiagramId,
  type ElementId,
  type Model,
  type OperationFailure,
} from '@saerskriven/model';
import { Data, Either } from 'effect';
import type { AssetFailure } from '../asset-failure.js';
import type { RecoveryProblem } from './recovery-storage.js';

/** The file name and source stay outside model history. */
export type FileLifecycle = Data.TaggedEnum<{
  NoFile: {};
  Opened: { readonly name: string; readonly source: RetainedSource };
}>;

/**
 * Constructors for {@link FileLifecycle}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const FileLifecycle = Data.taggedEnum<FileLifecycle>();

/**
 * Why a shared link opened no model: the link codec's refusal, the native
 * read's refusal of the text the link held, or the module that decodes links
 * not loading.
 */
export type LinkFailure = Data.TaggedEnum<{
  Codec: { readonly failure: ShareLinkFailure };
  Read: { readonly failure: ReadFailure };
  Module: { readonly failure: AssetFailure };
}>;

/**
 * Constructors for {@link LinkFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const LinkFailure = Data.taggedEnum<LinkFailure>();

/** Why the studio refused an operation or could not keep its data. */
export type StudioFailure = Data.TaggedEnum<{
  Operation: { readonly failure: OperationFailure };
  Read: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  File: { readonly reason: string };
  Link: { readonly failure: LinkFailure };
  StoredRecoveryRejected: { readonly problem: RecoveryProblem };
  RecoveryUnavailable: { readonly problem: RecoveryProblem };
}>;

/**
 * Constructors for {@link StudioFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const StudioFailure = Data.taggedEnum<StudioFailure>();

/** The field open over one canvas element. */
export type InlineEditor = {
  readonly kind: 'name' | 'note';
  readonly elementId: ElementId;
};

/**
 * The model, history, transient view state, file, and recovery status.
 * `activeDiagram` is undefined until a diagram is chosen, and
 * `modelPanel` is whether the panel shows the model rather than the selection.
 * `recoveryUnread` is whether the snapshot found at startup could not be read
 * and no recovery write has replaced it since.
 */
export type State = {
  readonly present: Model;
  readonly past: readonly Model[];
  readonly future: readonly Model[];
  readonly saved: Model;
  readonly activeDiagram: DiagramId | undefined;
  readonly selection: readonly ElementId[];
  readonly modelPanel: boolean;
  readonly inlineEditor: InlineEditor | undefined;
  readonly file: FileLifecycle;
  readonly lastFailure: StudioFailure | undefined;
  readonly recoveryCurrent: boolean;
  readonly recoveryUnread: boolean;
};

/** The name the placeholder model carries, before any locale is chosen. */
export const untitledModel = 'Untitled';

/**
 * The open file's name, or `untitled` while there is none. A caller with a
 * translator passes the name in the active locale.
 */
export function nameOf(
  file: FileLifecycle,
  untitled: string = untitledModel,
): string {
  return FileLifecycle.$match(file, {
    NoFile: () => untitled,
    Opened: ({ name }) => name,
  });
}

/** The title the placeholder diagram carries, before any locale is chosen. */
export const untitledDiagram = 'Untitled diagram';

const placeholderDocument = {
  metadata: {
    title: untitledModel,
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: 'placeholder-diagram',
      title: untitledDiagram,
      elements: [
        {
          kind: 'actor',
          id: 'placeholder-actor',
          name: 'Actor',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 100, height: 50 },
        },
        {
          kind: 'store',
          id: 'placeholder-store',
          name: 'Store',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 280, y: 40 },
          size: { width: 100, height: 50 },
        },
        {
          kind: 'flow',
          id: 'placeholder-flow',
          name: 'Records',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'placeholder-actor' },
          target: { kind: 'attached', element: 'placeholder-store' },
          waypoints: [],
          bidirectional: false,
        },
      ],
    },
  ],
  threats: [
    {
      id: 'placeholder-threat',
      number: 1,
      title: 'The actor sends records nothing has checked',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'medium',
      status: 'open',
      description: '',
      elements: ['placeholder-actor'],
      appliesToModel: false,
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [],
  assumptions: [],
};

/** The editable model shown before a file or recovery snapshot opens. */
export const placeholderModel: Model = Either.getOrElse(
  parseModel(placeholderDocument),
  () => emptyModel,
);

/** Starts a clean session with empty history and transient state. */
export function initialState(model: Model): State {
  return {
    present: model,
    past: [],
    future: [],
    saved: model,
    activeDiagram: undefined,
    selection: [],
    modelPanel: false,
    inlineEditor: undefined,
    file: FileLifecycle.NoFile(),
    lastFailure: undefined,
    recoveryCurrent: false,
    recoveryUnread: false,
  };
}
