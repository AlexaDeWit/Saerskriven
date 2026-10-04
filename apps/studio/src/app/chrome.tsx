import { useRef, type RefObject } from 'react';
import { CanvasAnnouncement } from '../canvas/canvas-announcement.js';
import { FlowTargetChooser } from '../canvas/flow-target-chooser.js';
import { Toolbox } from '../canvas/toolbox.js';
import { FileReports } from '../files/file-reports.js';
import { StudioMenu, type StudioMenuProps } from '../files/menu.js';
import { useMeasured } from '../ui/measure.js';
import styles from './chrome.module.css';

const cardHeight = '--saer-chrome-block-size';

const reportsHeight = '--saer-chrome-reports-block-size';

/** Measures the chrome and file reports for the panes below them. */
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
