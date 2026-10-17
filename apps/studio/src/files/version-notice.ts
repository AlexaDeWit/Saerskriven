import {
  movesToSaerskrivenYamlVersion3,
  writtenSaerskrivenYamlVersion,
} from '@saerskriven/formats';
import { useCallback, useEffect, useState } from 'react';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { formatOf, type LossReport } from './session.js';

/**
 * Whether the report region says that earlier releases can no longer open
 * the model, once `next` follows `previous`. An edit or a redo that moves a
 * model saved as Saerskriven YAML from version 2 to version 3 raises it. It
 * stays up through edits that keep the model at version 3, and any other
 * change of the model on screen puts it away: an undo, an open, a close, a
 * new model, another tab's model, and an edit back to version 2.
 */
export function versionNoticeAfter(
  shown: boolean,
  previous: State,
  next: State,
): boolean {
  if (next.present === previous.present) {
    return shown;
  }
  if (
    next.past.at(-1) !== previous.present ||
    formatOf(next.file) !== 'saerskriven-yaml'
  ) {
    return false;
  }
  return (
    movesToSaerskrivenYamlVersion3(previous.present, next.present) ||
    (shown && writtenSaerskrivenYamlVersion(next.present) === 3)
  );
}

/**
 * Whether `report`, standing under the card, raises the version report: the
 * open of a file in a format Saerskriven only reads, whose model saves as
 * version 3, does, as no edit moved it there. A shared link's report does
 * not, since the link held native text at version 3 already.
 */
export function versionNoticeAtReport(report: LossReport | undefined): boolean {
  return (
    report?.readOnlyFormat !== undefined &&
    writtenSaerskrivenYamlVersion(report.model) === 3
  );
}

/**
 * {@link versionNoticeAfter} over the studio's store, raised too where
 * {@link versionNoticeAtReport} says the file session's `report` raises it,
 * and the Dismiss that puts it away.
 */
export function useVersionNotice(report: LossReport | undefined): {
  readonly shown: boolean;
  readonly dismiss: () => void;
} {
  const [shown, setShown] = useState(false);
  useEffect(
    () =>
      modelStore.subscribe((next, previous) => {
        setShown((held) => versionNoticeAfter(held, previous, next));
      }),
    [],
  );
  const [seenReport, setSeenReport] = useState(report);
  if (report !== seenReport) {
    setSeenReport(report);
    if (versionNoticeAtReport(report)) {
      setShown(true);
    }
  }
  const dismiss = useCallback((): void => {
    setShown(false);
  }, []);
  return { shown, dismiss };
}
