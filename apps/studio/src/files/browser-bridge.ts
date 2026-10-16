import {
  OpenOutcome,
  SaveOutcome,
  fileOwnership,
  readWithin,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type FileResult,
  type RecentFile,
  type SaveFileType,
  type SaveText,
} from './bridge.js';
import {
  indexedRecentStore,
  recentLimit,
  type RecentStore,
} from './recent-store.js';
import { reasonOf } from '../reason.js';

type OpenPicker = (options: {
  readonly id: string;
  readonly multiple: false;
  readonly startIn: FileSystemFileHandle | undefined;
}) => Promise<readonly FileSystemFileHandle[]>;

type SavePicker = (options: {
  readonly id?: string;
  readonly startIn?: FileSystemFileHandle;
  readonly suggestedName: string;
  readonly types: readonly SaveFileType[];
}) => Promise<FileSystemFileHandle>;

declare global {
  interface Window {
    showOpenFilePicker?: OpenPicker;
    showSaveFilePicker?: SavePicker;
  }
  interface FileSystemHandle {
    requestPermission?(descriptor: {
      readonly mode: 'readwrite';
    }): Promise<PermissionState>;
  }
}

/** The ids under which the browser remembers the folder each picker last used. */
export const pickerIds = { open: 'open-model', save: 'save-model' } as const;

const dismissed = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

const missing = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'NotFoundError';

async function sameEntry(
  kept: FileSystemFileHandle,
  handle: FileSystemFileHandle,
): Promise<boolean> {
  try {
    return await kept.isSameEntry(handle);
  } catch {
    return false;
  }
}

async function readPermitted(
  handle: FileSystemFileHandle,
  maxBytes: number,
): Promise<OpenOutcome> {
  try {
    const permission =
      (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (permission !== 'granted') {
      return OpenOutcome.Declined();
    }
    return await readWithin(await handle.getFile(), maxBytes);
  } catch (cause) {
    return missing(cause)
      ? OpenOutcome.Gone({ name: handle.name })
      : OpenOutcome.Unreadable({ reason: reasonOf(cause) });
  }
}

function asksWhere(): boolean {
  return window.showSaveFilePicker !== undefined;
}

function keepsRecent(): boolean {
  return window.showOpenFilePicker !== undefined;
}

async function writeTo(
  handle: FileSystemFileHandle,
  name: string,
  content: FileContent,
): Promise<SaveOutcome> {
  try {
    const stream = await handle.createWritable();
    await stream.write(
      typeof content === 'string' ? content : new Uint8Array(content),
    );
    await stream.close();
    return SaveOutcome.Written({ name });
  } catch (cause) {
    return SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

function download(
  name: string,
  content: FileContent,
  mediaType: string,
): SaveOutcome {
  const url = URL.createObjectURL(
    new Blob(
      [typeof content === 'string' ? content : new Uint8Array(content)],
      { type: mediaType },
    ),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
  return SaveOutcome.Written({ name });
}

function mediaTypeOf(type: SaveFileType): string {
  return Object.keys(type.accept)[0] ?? 'application/octet-stream';
}

/**
 * The browser's bridge, keeping its recent list in `store`. Only settlement
 * adopts or drops a handle, and Close releases it and invalidates pending
 * operations. Each handle a settlement adopts goes to the top of the list,
 * and the list's reads and writes run one at a time, in the order asked. A
 * reopen that does not open its file has the next open picker start in that
 * file's folder, and an export's picker starts beside the file held.
 */
export function browserBridge(store: RecentStore): FileBridge {
  let pending: Promise<unknown> = Promise.resolve();
  let listed = new Map<string, FileSystemFileHandle>();
  let beside: FileSystemFileHandle | undefined;

  const inTurn = <Value>(work: () => Promise<Value>): Promise<Value> => {
    const next = pending.then(work);
    pending = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const remember = (handle: FileSystemFileHandle): Promise<void> =>
    inTurn(async () => {
      const entries = await store.read();
      const same = await Promise.all(
        entries.map((entry) => sameEntry(entry.handle, handle)),
      );
      const matched = new Set(
        entries.filter((_, index) => same[index]).map(({ key }) => key),
      );
      const fresh = crypto.randomUUID();
      await store.update((current) => {
        const key =
          current.find((entry) => matched.has(entry.key))?.key ?? fresh;
        const others = current.filter((entry) => !matched.has(entry.key));
        return [{ key, handle }, ...others].slice(0, recentLimit);
      });
    });

  const forget = (key: string): Promise<void> =>
    inTurn(() =>
      store.update((entries) => entries.filter((entry) => entry.key !== key)),
    );

  const ownership = fileOwnership<FileSystemFileHandle>((handle) => {
    void remember(handle);
  });

  async function open(maxBytes: number): Promise<FileResult<OpenOutcome>> {
    const complete = ownership.begin();
    const previous = ownership.current();
    const picker = window.showOpenFilePicker;
    if (picker === undefined) {
      return complete(OpenOutcome.NoPicker(), previous);
    }
    const startIn = beside;
    beside = undefined;
    try {
      const chosen = await picker({
        id: pickerIds.open,
        multiple: false,
        startIn,
      });
      const handle = chosen.at(0);
      if (handle === undefined) {
        return complete(OpenOutcome.Cancelled(), previous);
      }
      const outcome = await readWithin(await handle.getFile(), maxBytes);
      return complete(outcome, handle);
    } catch (cause) {
      return complete(
        dismissed(cause)
          ? OpenOutcome.Cancelled()
          : OpenOutcome.Unreadable({ reason: reasonOf(cause) }),
        previous,
      );
    }
  }

  async function received(
    file: ChosenFile,
    maxBytes: number,
  ): Promise<FileResult<OpenOutcome>> {
    const complete = ownership.begin();
    return complete(await readWithin(file, maxBytes), undefined);
  }

  async function reopen(
    file: RecentFile,
    maxBytes: number,
  ): Promise<FileResult<OpenOutcome>> {
    const complete = ownership.begin();
    const handle = listed.get(file.key);
    if (handle === undefined) {
      return complete(OpenOutcome.Cancelled(), ownership.current());
    }
    const outcome = await readPermitted(handle, maxBytes);
    if (OpenOutcome.$is('Gone')(outcome)) {
      await forget(file.key);
    }
    const result = complete(outcome, handle);
    return {
      outcome,
      settle: (retain) => {
        if (!result.settle(retain)) {
          return false;
        }
        beside = retain === true ? undefined : handle;
        return true;
      },
    };
  }

  function recentFiles(): Promise<readonly RecentFile[]> {
    if (!keepsRecent()) {
      return Promise.resolve([]);
    }
    return inTurn(async () => {
      const entries = await store.read();
      listed = new Map(entries.map(({ key, handle }) => [key, handle]));
      return entries.map(({ key, handle }) => ({ key, name: handle.name }));
    });
  }

  function clearRecent(): Promise<void> {
    return inTurn(() => store.update(() => []));
  }

  async function exportFile(
    name: string,
    type: SaveFileType,
    content: FileContent,
  ): Promise<SaveOutcome> {
    const picker = window.showSaveFilePicker;
    if (picker === undefined) {
      return download(name, content, mediaTypeOf(type));
    }
    try {
      const handle = await picker({
        startIn: ownership.current(),
        suggestedName: name,
        types: [type],
      });
      return writeTo(handle, handle.name, content);
    } catch (cause) {
      return dismissed(cause)
        ? SaveOutcome.Cancelled()
        : SaveOutcome.Refused({ reason: reasonOf(cause) });
    }
  }

  async function save(
    name: string,
    text: string,
  ): Promise<FileResult<SaveOutcome>> {
    const complete = ownership.begin();
    const held = ownership.current();
    const outcome =
      held === undefined
        ? download(name, text, 'text/plain;charset=utf-8')
        : await writeTo(held, held.name, text);
    return complete(outcome, held);
  }

  async function saveAs(
    name: string,
    types: readonly SaveFileType[],
    text: SaveText,
  ): Promise<FileResult<SaveOutcome>> {
    const complete = ownership.begin();
    const previous = ownership.current();
    const picker = window.showSaveFilePicker;
    if (picker === undefined) {
      return complete(
        download(name, text(name), 'text/plain;charset=utf-8'),
        undefined,
      );
    }
    try {
      const handle = await picker({
        id: pickerIds.save,
        suggestedName: name,
        types,
      });
      const outcome = await writeTo(handle, handle.name, text(handle.name));
      return complete(
        outcome,
        SaveOutcome.$is('Written')(outcome) ? handle : previous,
      );
    } catch (cause) {
      return complete(
        dismissed(cause)
          ? SaveOutcome.Cancelled()
          : SaveOutcome.Refused({ reason: reasonOf(cause) }),
        previous,
      );
    }
  }

  return {
    open,
    received,
    reopen,
    keepsRecent,
    recentFiles,
    clearRecent,
    save,
    saveAs,
    exportFile,
    asksWhere,
    writesBack: () => ownership.current() !== undefined,
    release: ownership.release,
  };
}

/** The bridge the studio runs on, with its recent list in IndexedDB. */
export const browserFileBridge: FileBridge = browserBridge(indexedRecentStore);
