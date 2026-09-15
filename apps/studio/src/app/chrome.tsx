import { useRef } from 'react';
import { CanvasMessages, Toolbox } from '../canvas/toolbox.js';
import {
  FileReports,
  StudioMenu,
  type StudioMenuProps,
} from '../files/menu.js';
import { useMeasured } from '../ui/measure.js';
import styles from './chrome.module.css';

const chromeHeight = '--pn-chrome-block-size';

/**
 * The one floating card of shell chrome: the menu button and the diagram
 * control on row one, the tool modes on row two, and the failure notice, the
 * file reports, the canvas announcement and the flow chooser hanging under it.
 * The height of the card and what hangs under it goes back to the document
 * root as `--pn-chrome-block-size` for the panes that start below it, measured
 * because the tools row wraps on a narrow viewport and a report or an
 * announcement comes and goes.
 */
export function StudioChrome({
  colourMode,
  onColourModeChange,
  session,
  triggerRef,
}: StudioMenuProps) {
  const chrome = useRef<HTMLDivElement>(null);

  useMeasured(
    chrome,
    (node) => {
      document.documentElement.style.setProperty(
        chromeHeight,
        `${String(node.getBoundingClientRect().height)}px`,
      );
    },
    () => {
      document.documentElement.style.removeProperty(chromeHeight);
    },
  );

  return (
    <div className={styles.chrome} ref={chrome}>
      <div className={styles.card} data-testid="chrome-card">
        <StudioMenu
          colourMode={colourMode}
          onColourModeChange={onColourModeChange}
          session={session}
          triggerRef={triggerRef}
        />
        <Toolbox />
      </div>
      <div className={styles.below}>
        <FileReports session={session} />
        <CanvasMessages />
      </div>
    </div>
  );
}
