import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { Select } from 'radix-ui';

import styles from './capped-list.module.css';

type CappedListProps = {
  readonly contentClassName: string;
  readonly viewportClassName?: string;
  readonly collisionBoundary?: Element[];
  readonly children: ReactNode;
};

/**
 * The overlay of a Radix select: its viewport is no taller than the window
 * leaves it, and a cue marks each edge the options run on past. The callers
 * style the box and the rows. It stays inside a `Select.Root`.
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
      <Select.Viewport
        className={`${styles.viewport} ${viewportClassName ?? ''}`}
      >
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
