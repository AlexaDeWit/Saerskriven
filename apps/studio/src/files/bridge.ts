import { Data } from 'effect';
import { reasonOf } from '../reason.js';

/** The browser File fields needed for a bounded read. */
export type ChosenFile = {
  readonly name: string;
  readonly size: number;
  text(): Promise<string>;
};

/**
 * Chosen text is within the byte bound but still needs codec validation.
 * `Gone` and `Declined` answer a reopen whose file is no longer there, or
 * whose permission the person declined.
 */
export type OpenOutcome = Data.TaggedEnum<{
  Chosen: { readonly name: string; readonly text: string };
  TooLarge: {
    readonly name: string;
    readonly bound: number;
    readonly observed: number;
  };
  Unreadable: { readonly reason: string };
  Cancelled: {};
  NoPicker: {};
  Gone: { readonly name: string };
  Declined: {};
}>;

/** Constructors and matching helpers for open outcomes. */
export const OpenOutcome = Data.taggedEnum<OpenOutcome>();

/** Written names the file that received the text, which can differ from the proposed name. */
export type SaveOutcome = Data.TaggedEnum<{
  Written: { readonly name: string };
  Cancelled: {};
  Refused: { readonly reason: string };
}>;

/** Constructors and matching helpers for save outcomes. */
export const SaveOutcome = Data.taggedEnum<SaveOutcome>();

/** A format offered through the File System Access API. */
export type SaveFileType = {
  readonly description: string;
  readonly accept: Readonly<Record<string, readonly string[]>>;
};

/** Produces text after the chosen file name determines its format. */
export type SaveText = (name: string) => string;

/** Text or binary content the studio can place outside its open file. */
export type FileContent = string | Uint8Array;

/** Settle once before dispatch, retaining the candidate handle or releasing the association. */
export type FileResult<Outcome> = {
  readonly outcome: Outcome;
  settle(retain: boolean | 'unchanged'): boolean;
};

/** A file the recent list names, by the key a reopen asks for it with. */
export type RecentFile = { readonly key: string; readonly name: string };

/**
 * Only the latest request can settle its handle, and Close invalidates every
 * pending result. `adopted` hears each handle a settlement takes up in place
 * of the one held, which is how a file joins the recent list: a write back to
 * the held file, and a refused save, adopt nothing.
 */
export function fileOwnership<Handle>(
  adopted: (handle: Handle) => void = () => undefined,
) {
  let owner: symbol | undefined;
  let held: Handle | undefined;
  return {
    current: (): Handle | undefined => held,
    begin: () => {
      const operation = Symbol();
      owner = operation;
      return <Outcome>(
        outcome: Outcome,
        candidate: Handle | undefined,
      ): FileResult<Outcome> => ({
        outcome,
        settle: (retain) => {
          if (owner !== operation) {
            return false;
          }
          owner = undefined;
          if (retain === 'unchanged') {
            return true;
          }
          const next = retain ? candidate : undefined;
          if (next !== undefined && next !== held) {
            adopted(next);
          }
          held = next;
          return true;
        },
      });
    },
    release: (): void => {
      owner = undefined;
      held = undefined;
    },
  };
}

/**
 * File operations defer handle adoption until settlement. Exports never
 * change the association. `keepsRecent` says whether the platform keeps a
 * reference to a file that a later visit can reopen. Where it keeps none, the
 * recent list is empty.
 */
export type FileBridge = {
  open(maxBytes: number): Promise<FileResult<OpenOutcome>>;
  received(
    file: ChosenFile,
    maxBytes: number,
  ): Promise<FileResult<OpenOutcome>>;
  reopen(file: RecentFile, maxBytes: number): Promise<FileResult<OpenOutcome>>;
  keepsRecent(): boolean;
  recentFiles(): Promise<readonly RecentFile[]>;
  clearRecent(): Promise<void>;
  save(name: string, text: string): Promise<FileResult<SaveOutcome>>;
  saveAs(
    name: string,
    types: readonly SaveFileType[],
    text: SaveText,
  ): Promise<FileResult<SaveOutcome>>;
  exportFile(
    name: string,
    type: SaveFileType,
    content: FileContent,
  ): Promise<SaveOutcome>;
  asksWhere(): boolean;
  writesBack(): boolean;
  release(): void;
};

/** Refuses an oversized file before requesting its text. */
export async function readWithin(
  file: ChosenFile,
  maxBytes: number,
): Promise<OpenOutcome> {
  if (file.size > maxBytes) {
    return OpenOutcome.TooLarge({
      name: file.name,
      bound: maxBytes,
      observed: file.size,
    });
  }
  try {
    return OpenOutcome.Chosen({ name: file.name, text: await file.text() });
  } catch (cause) {
    return OpenOutcome.Unreadable({ reason: reasonOf(cause) });
  }
}
