import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { Select } from 'radix-ui';

import styles from './capped-list.module.css';

type CappedListProps = {
  readonly contentClassName: string;
  readonly viewportClassName: string;
  readonly collisionBoundary?: Element[];
  readonly children: ReactNode;
};

/**
 * The overlay of a Radix select. Its viewport is no taller than 24rem or the
 * room Radix leaves in the window, and a cue marks each edge the options run
 * on past. A caller that passes `collisionBoundary` (the panel field passes
 * the pane's scroll box) is limited to that box instead of the window. The
 * callers style the box and the rows. Render it as a child of a
 * `Select.Root`, which supplies the select's state and portals the overlay.
 */
export function CappedList({
  contentClassName,
  viewportClassName,
  collisionBoundary,
  children,
}: CappedListProps) {
  return (
    <Select.Content
      className={`${styles.frame} ${contentClassName}`}
      collisionBoundary={collisionBoundary}
      position="popper"
    >
      <Select.ScrollUpButton
        className={`${styles.cue} ${styles.earlier}`}
        data-scroll-cue="earlier"
      >
        <ChevronUpIcon aria-hidden="true" />
      </Select.ScrollUpButton>
      <Select.Viewport className={`${styles.viewport} ${viewportClassName}`}>
        {children}
      </Select.Viewport>
      <Select.ScrollDownButton
        className={`${styles.cue} ${styles.later}`}
        data-scroll-cue="later"
      >
        <ChevronDownIcon aria-hidden="true" />
      </Select.ScrollDownButton>
    </Select.Content>
  );
}
