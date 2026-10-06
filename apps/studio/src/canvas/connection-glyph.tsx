import type { Side } from '@saerskriven/model';
import { strokeGlyph } from './stroke-glyph.js';

const rotations = {
  left: 0,
  top: 90,
  right: 180,
  bottom: 270,
} satisfies Record<Side, number>;

/** A connection entering the named side of an element. */
export const connectionGlyph = (side: Side) =>
  strokeGlyph(
    <g transform={`rotate(${String(rotations[side])} 8 8)`}>
      <rect x="6" y="4" width="8" height="8" />
      <path d="M1 8h5M3.5 5.5 6 8l-2.5 2.5" />
    </g>,
  );
