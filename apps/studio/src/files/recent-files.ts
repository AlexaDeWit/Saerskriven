import { readLimits } from '@saerskriven/formats';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { holdsUnsavedWork } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import type {
  FileBridge,
  FileResult,
  OpenOutcome,
  RecentFile,
} from './bridge.js';

/**
 * The recent list as the menu offers it, most recent first, and the file a
 * reopen is asking about while the session holds unsaved work.
 */
export type RecentFiles = {
  readonly files: readonly RecentFile[];
  readonly asking: RecentFile | undefined;
  readonly refresh: () => void;
  readonly reopen: (file: RecentFile) => void;
  readonly confirm: (file: RecentFile) => void;
  readonly cancel: () => void;
  readonly clear: () => void;
};

/**
 * The recent list, read when the session mounts and at each `refresh`, the
 * latest read winning. A reopen asks first over unsaved work, as Open does,
 * hands the bridge's result to `land`, which settles it as an open, and reads
 * the list again, since a reopen moves its file to the top or drops it.
 */
export function useRecentFiles(
  bridge: FileBridge,
  land: (result: FileResult<OpenOutcome>) => void,
): RecentFiles {
  const [files, setFiles] = useState<readonly RecentFile[]>([]);
  const [asking, setAsking] = useState<RecentFile | undefined>(undefined);
  const reads = useRef(0);

  const refresh = useCallback((): void => {
    reads.current += 1;
    const read = reads.current;
    const list = async (): Promise<void> => {
      const listed = await bridge.recentFiles();
      if (read === reads.current) {
        setFiles(listed);
      }
    };
    void list();
  }, [bridge]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirm = useCallback(
    (file: RecentFile): void => {
      const open = async (): Promise<void> => {
        land(await bridge.reopen(file, readLimits.maxTextBytes));
        refresh();
      };
      setAsking(undefined);
      void open();
    },
    [bridge, land, refresh],
  );

  const reopen = useCallback(
    (file: RecentFile): void => {
      if (holdsUnsavedWork(modelStore.getState())) {
        setAsking(file);
        return;
      }
      confirm(file);
    },
    [confirm],
  );

  const cancel = useCallback((): void => {
    setAsking(undefined);
  }, []);

  const clear = useCallback((): void => {
    void bridge.clearRecent().then(refresh);
  }, [bridge, refresh]);

  return useMemo(
    () => ({ files, asking, refresh, reopen, confirm, cancel, clear }),
    [asking, cancel, clear, confirm, files, refresh, reopen],
  );
}
