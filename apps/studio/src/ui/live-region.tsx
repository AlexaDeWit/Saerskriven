import type { ReactNode } from 'react';

import styles from './live-region.module.css';

type LiveRegionProps = {
  readonly label?: string;
  readonly testId: string;
  readonly className?: string;
  readonly children?: ReactNode;
};

/** A polite live region: an atomic status while unlabelled, a named section otherwise. */
export function LiveRegion({
  label,
  testId,
  className,
  children,
}: LiveRegionProps) {
  return (
    <section
      aria-label={label}
      aria-atomic={label === undefined ? 'true' : undefined}
      aria-live="polite"
      className={
        className === undefined
          ? styles.region
          : `${styles.region} ${className}`
      }
      data-testid={testId}
      role={label === undefined ? 'status' : undefined}
    >
      {children}
    </section>
  );
}
