import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  browserRestoreMark,
  type RestoreMark,
} from '../store/recovery-storage.js';

/**
 * Lowers the restore mark once the tree this mounts in has stood for two
 * animation frames after its first commit. The frames are asked for among
 * that commit's effects, so a draw those effects set off renders before the
 * first of them. The pending frame is cancelled in the commit that unmounts
 * the tree, which is the error boundary taking over, so a draw that failed
 * leaves the mark raised.
 */
export function useRestoreSettled(
  mark: Pick<RestoreMark, 'lower'> = browserRestoreMark,
): void {
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        mark.lower();
      });
    });
  }, [mark]);

  useLayoutEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );
}
