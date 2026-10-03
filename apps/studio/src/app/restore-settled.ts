import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  browserRestoreMark,
  type RestoreMark,
} from '../store/recovery-storage.js';

const waitWithoutFrames = 1_000;

/**
 * Lowers the restore mark once the tree this mounts in has stood for two
 * animation frames after its first commit, or for a second where no frame
 * comes, as in a tab that is not shown. A hidden tab runs a timer about once
 * a second, so a shorter wait would lower the mark no sooner there, and in a
 * tab that draws, the frames come well inside it. Both are asked for among
 * that commit's effects, so a draw those effects set off renders before
 * either. Both are cancelled in the commit that unmounts the tree, which is
 * the error boundary taking over, so a draw that failed leaves the mark
 * raised.
 */
export function useRestoreSettled(
  mark: Pick<RestoreMark, 'lower'> = browserRestoreMark,
): void {
  const frame = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const lower = (): void => {
      mark.lower();
    };
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(lower);
    });
    timer.current = setTimeout(lower, waitWithoutFrames);
  }, [mark]);

  useLayoutEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
      clearTimeout(timer.current);
    },
    [],
  );
}
