import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  browserRestoreMark,
  type RestoreMark,
} from '../store/recovery-storage.js';

const waitWithoutFrames = 1_000;

/**
 * Lowers the restore mark once the tree this mounts in has stood for two
 * animation frames after its first commit. A tab that is hidden as that
 * commit's effects run draws no frame, so there a timer lowers the mark after
 * a second as well. A tab that is shown starts no timer: a first draw that
 * holds the thread for a second would otherwise find the timer due ahead of
 * its first frame, and lose the mark before the pass that frame sets off. A
 * tab hidden after those effects and before its second frame keeps the mark
 * until it is shown again. The frames and the timer are asked for among that
 * commit's effects, so a draw those effects set off renders before either,
 * and both are cancelled in the commit that unmounts the tree, which is the
 * error boundary taking over, so a draw that failed leaves the mark raised.
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
    if (document.visibilityState === 'hidden') {
      timer.current = setTimeout(lower, waitWithoutFrames);
    }
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
