import type { ReactNode } from 'react';
import styles from './stroke-glyph.module.css';

/**
 * An icon drawn in strokes of the text colour on a 16-unit grid, and hidden
 * from assistive technology because the control around it carries the name.
 * A shape given `fill="currentColor"` is drawn solid.
 */
export const strokeGlyph = (drawn: ReactNode): ReactNode => (
  <svg aria-hidden="true" className={styles.glyph} viewBox="0 0 16 16">
    {drawn}
  </svg>
);
