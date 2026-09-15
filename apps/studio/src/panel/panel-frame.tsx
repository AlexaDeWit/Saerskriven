import { ArrowRightIcon, Cross1Icon, WidthIcon } from '@radix-ui/react-icons';
import { Tooltip } from 'radix-ui';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { keyboardOwner } from '../commands/binding.js';
import {
  describeContextualShortcuts,
  pressesContextualShortcut,
  type ContextualShortcutId,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useMeasured } from '../ui/measure.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import styles from './threat-panel.module.css';

/** What one pane in the panel location is called, how it closes, and what it holds. */
export type PanelFrameProps = {
  readonly label: string;
  readonly heading: string;
  readonly closeLabel: string;
  readonly closeShortcut: ContextualShortcutId;
  readonly testId?: string;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onClose: () => void;
  readonly onCover?: (cover: number) => void;
  readonly children: ReactNode;
};

/**
 * The pane the panel location draws, whichever subject it shows: the width
 * control, the heading and the close control above a scrolling body. It
 * reports how much of the canvas it covers, and closes on its Escape unless
 * an open listbox inside it is handling the press.
 */
export function PanelFrame({
  label,
  heading,
  closeLabel,
  closeShortcut,
  testId,
  wide,
  onToggleWidth,
  onClose,
  onCover,
  children,
}: PanelFrameProps) {
  const panel = useRef<HTMLElement>(null);
  const keyboardDescriptionId = useId();

  useMeasured(
    panel,
    (node, parent) => {
      onCover?.(
        (parent?.getBoundingClientRect().right ?? 0) -
          node.getBoundingClientRect().left,
      );
    },
    () => {
      onCover?.(0);
    },
    { alsoParent: true },
  );

  const closing = (event: KeyboardEvent<HTMLElement>): void => {
    if (
      !pressesContextualShortcut(closeShortcut, event, hostPlatform) ||
      keyboardOwner(event.target) === 'overlay'
    ) {
      return;
    }
    event.preventDefault();
    onClose();
  };

  return (
    <section
      aria-describedby={keyboardDescriptionId}
      aria-label={label}
      className={styles.panel}
      data-pane=""
      data-testid={testId}
      data-wide={wide}
      ref={panel}
      onKeyDownCapture={closing}
    >
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts([closeShortcut], hostPlatform)}
      </VisuallyHidden>
      <header className={styles.panelHeader}>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                aria-label={wide ? 'Restore pane width' : 'Widen pane'}
                aria-pressed={wide}
                className={styles.width}
                onClick={onToggleWidth}
                type="button"
              >
                {wide ? (
                  <ArrowRightIcon aria-hidden="true" />
                ) : (
                  <WidthIcon aria-hidden="true" />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className={styles.tooltip} side="bottom">
              {wide ? 'Restore pane width' : 'Widen pane'}
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <h2 className={styles.heading}>{heading}</h2>
        <button
          aria-label={closeLabel}
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          <Cross1Icon aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
