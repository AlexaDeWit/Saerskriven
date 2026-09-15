import { useRef, type RefObject } from 'react';
import {
  CanvasAnnouncement,
  FlowTargetChooser,
  Toolbox,
} from '../canvas/toolbox.js';
import {
  FileReports,
  StudioMenu,
  type StudioMenuProps,
} from '../files/menu.js';
import { useMeasured } from '../ui/measure.js';
import styles from './chrome.module.css';

const cardHeight = '--pn-chrome-block-size';

const reportsHeight = '--pn-chrome-reports-block-size';

/**
 * The one floating card of shell chrome: the menu button and the diagram
 * control on row one, the tool modes on row two, and under it the failure
 * notice, the file reports, the flow chooser and last the canvas
 * announcement. The card's height goes back to the document root as
 * `--pn-chrome-block-size`, and the height of what hangs above the
 * announcement as `--pn-chrome-reports-block-size`, both measured: the tools
 * row wraps on a narrow viewport, and a notice is as tall as its details. The
 * announcement is left out, and an open pane reserves a fixed slot for it
 * instead, so the pane does not move each time an edit is announced.
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
