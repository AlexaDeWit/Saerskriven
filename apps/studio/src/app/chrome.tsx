import { useRef, type RefObject } from 'react';
import { AccentBar } from '../canvas/accent-bar.js';
import { CanvasAnnouncement } from '../canvas/canvas-announcement.js';
import { FlowTargetChooser } from '../canvas/flow-target-chooser.js';
import { Toolbox } from '../canvas/toolbox.js';
import { FileReports } from '../files/file-reports.js';
import { StudioMenu, type StudioMenuProps } from '../files/menu.js';
import { useMeasured } from '../ui/measure.js';
import styles from './chrome.module.css';

const cardHeight = '--saer-chrome-block-size';

const reportsHeight = '--saer-chrome-reports-block-size';

/**
 * Measures the chrome and file reports for the panes below them, and hands
 * `onCardBottom` the card's bottom edge, in pixels below the top of the stage
 * the canvas fills, for the fit to keep a diagram clear of.
 */
export function StudioChrome({
  colourMode,
  onCardBottom,
  onColourModeChange,
  session,
  triggerRef,
}: StudioMenuProps & {
  readonly onCardBottom?: (bottom: number) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const reports = useRef<HTMLDivElement>(null);

  useMeasuredHeight(card, cardHeight, (node) => {
    onCardBottom?.(bottomInStage(node));
  });
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
        <AccentBar />
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
  measured?: (node: HTMLDivElement) => void,
): void {
  useMeasured(
    target,
    (node) => {
      document.documentElement.style.setProperty(
        property,
        `${String(node.getBoundingClientRect().height)}px`,
      );
      measured?.(node);
    },
    () => {
      document.documentElement.style.removeProperty(property);
    },
  );
}

function bottomInStage(card: HTMLElement): number {
  const chrome = card.parentElement;
  const stage = chrome instanceof HTMLElement ? chrome.offsetParent : null;
  return (
    card.getBoundingClientRect().bottom -
    (stage?.getBoundingClientRect().top ?? 0)
  );
}
