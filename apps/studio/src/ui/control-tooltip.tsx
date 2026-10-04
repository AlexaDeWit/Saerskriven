import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import styles from './control-tooltip.module.css';

/** A tooltip shown on pointer hover or keyboard focus, within the control's landmark. */
export function ControlTooltip({
  children,
  content,
  side,
}: {
  readonly children: ReactElement;
  readonly content: ReactNode;
  readonly side?: 'top' | 'bottom' | 'right';
}) {
  return (
    <Tooltip.Provider delayDuration={200} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Content className={styles.tooltip} side={side} sideOffset={6}>
          {content}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
