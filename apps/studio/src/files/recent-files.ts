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
  readonly proceed: (file: RecentFile) => void;
  readonly cancel: () => void;
  readonly clear: () => void;
};

const sameFiles = (
  before: readonly RecentFile[],
  listed: readonly RecentFile[],
): boolean =>
  before.length === listed.length &&
  before.every(
    (file, index) =>
      file.key === listed[index]?.key && file.name === listed[index].name,
  );

/**
 * The recent list, read when the session mounts and at each `refresh`, the
 * latest read winning. A read that lists the files already shown changes no
 * state, so a caller that hands over a new bridge on each render settles
 * rather than reading for ever. A reopen asks first over unsaved work, as
 * Open does, hands the bridge's result to `land`, which settles it as an
 * open, and reads the list again, since a reopen moves its file to the top or
 * drops it.
 */
export function useRecentFiles(
  bridge: FileBridge,
  land: (result: FileResult<OpenOutcome>) => void,
): RecentFiles {
  const [files, setFiles] = useState<readonly RecentFile[]>([]);
  const [asking, setAsking] = useState<RecentFile | undefined>(undefined);
  const reads = useRef(0);
  const shown = useRef<readonly RecentFile[]>([]);

  const refresh = useCallback((): void => {
    reads.current += 1;
    const read = reads.current;
    const list = async (): Promise<void> => {
      const listed = await bridge.recentFiles();
      if (read === reads.current && !sameFiles(shown.current, listed)) {
        shown.current = listed;
        setFiles(listed);
      }
    };
    void list();
  }, [bridge]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const proceed = useCallback(
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
      proceed(file);
    },
    [proceed],
  );

  const cancel = useCallback((): void => {
    setAsking(undefined);
  }, []);

  const clear = useCallback((): void => {
    void bridge.clearRecent().then(refresh);
  }, [bridge, refresh]);

  return useMemo(
    () => ({ files, asking, refresh, reopen, proceed, cancel, clear }),
    [asking, cancel, clear, files, proceed, refresh, reopen],
  );
}
