import { useRef, type RefObject } from 'react';
import {
  CanvasAnnouncement,
  FlowTargetChooser,
  Toolbox,
} from '../canvas/toolbox.js';
import { FileReports } from '../files/file-reports.js';
import { StudioMenu, type StudioMenuProps } from '../files/menu.js';
import { useMeasured } from '../ui/measure.js';
import styles from './chrome.module.css';

const cardHeight = '--pn-chrome-block-size';

const reportsHeight = '--pn-chrome-reports-block-size';

/**
 * The chrome card, with the menu and diagram control on row one and the
 * toolbox on row two, and under it the file reports, the flow chooser and the
 * canvas announcement. The measured heights of the card and of the reports
 * go to the document root as `--pn-chrome-block-size` and
 * `--pn-chrome-reports-block-size`. The announcement is not measured, since
 * an open pane reserves a fixed slot for it.
 */
export function StudioChrome({
  colourMode,
  onColourModeChange,
  session,
  triggerRef,
}: StudioMenuProps) {
  const card = useRef<HTMLDivElement>(null);
  const reports = useRef<HTMLDivElement>(null);

  useMeasuredHeight(card, cardHeight);
  useMeasuredHeight(reports, reportsHeight);

  return (
    <div className={styles.chrome}>
      <div className={styles.card} data-testid="chrome-card" ref={card}>
        <StudioMenu
          colourMode={colourMode}
          onColourModeChange={onColourModeChange}
          session={session}
          triggerRef={triggerRef}
        />
        <Toolbox />
      </div>
      <div className={styles.below}>
        <div className={styles.reports} ref={reports}>
          <FileReports session={session} />
          <FlowTargetChooser />
        </div>
        <CanvasAnnouncement />
      </div>
    </div>
  );
}

function useMeasuredHeight(
  target: RefObject<HTMLDivElement | null>,
  property: string,
): void {
  useMeasured(
    target,
    (node) => {
      document.documentElement.style.setProperty(
        property,
        `${String(node.getBoundingClientRect().height)}px`,
      );
    },
    () => {
      document.documentElement.style.removeProperty(property);
    },
  );
}
