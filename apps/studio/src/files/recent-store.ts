import { z } from 'zod';

const isFileHandle = (value: unknown): value is FileSystemFileHandle =>
  typeof FileSystemFileHandle === 'function' &&
  value instanceof FileSystemFileHandle;

const recentListSchema = z.array(
  z.object({
    key: z.string(),
    handle: z.custom<FileSystemFileHandle>(isFileHandle),
  }),
);

/** One file the recent list keeps: the key its menu entry reopens it by, and the browser's handle to it. */
export type RecentEntry = z.infer<typeof recentListSchema>[number];

export const recentLimit = 10;

/**
 * Where the recent list is kept, most recent first. A read answers an empty
 * list, and a write does nothing, where storage is absent or refuses, so the
 * menu still works.
 */
export type RecentStore = {
  read(): Promise<readonly RecentEntry[]>;
  write(entries: readonly RecentEntry[]): Promise<void>;
};

const databaseName = 'saerskriven-studio';
const listStore = 'recent-files';
const listKey = 'list';

function opened(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    try {
      const request = globalThis.indexedDB.open(databaseName, 1);
      request.addEventListener('upgradeneeded', () => {
        request.result.createObjectStore(listStore);
      });
      request.addEventListener('success', () => {
        resolve(request.result);
      });
      request.addEventListener('error', () => {
        resolve(undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

async function transact<Value>(
  mode: IDBTransactionMode,
  start: (store: IDBObjectStore) => IDBRequest<Value>,
): Promise<Value | undefined> {
  const database = await opened();
  if (database === undefined) {
    return undefined;
  }
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(listStore, mode);
      const request = start(transaction.objectStore(listStore));
      transaction.addEventListener('complete', () => {
        resolve(request.result);
      });
      transaction.addEventListener('abort', () => {
        resolve(undefined);
      });
    } catch {
      resolve(undefined);
    } finally {
      database.close();
    }
  });
}

/**
 * The recent list in this origin's IndexedDB, which every tab shares. It
 * holds the browser's handles, which a structured clone keeps, and never a
 * file's contents.
 */
export const indexedRecentStore: RecentStore = {
  read: async () => {
    const stored = recentListSchema.safeParse(
      await transact<unknown>('readonly', (store) => store.get(listKey)),
    );
    return stored.success ? stored.data : [];
  },
  write: async (entries) => {
    await transact('readwrite', (store) => store.put(entries, listKey));
  },
};
