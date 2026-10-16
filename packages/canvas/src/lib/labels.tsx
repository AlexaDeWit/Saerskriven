import type { Point } from '@saerskriven/model';
import type { ReactElement } from 'react';
import { svgNumber } from './numbers.js';
import { wrappedTextStyles, type WrappedTextStyle } from './stylesheet.js';
import { lineHeight, wrapText } from './typography.js';

/**
 * Where `at` sits in the block of lines: at its centre, at the centre of its
 * first line, or at the left end of its first line, level with that line's
 * centre. A run hung from `top-left` starts at `at.x`, so its class has to
 * set `text-anchor: start`.
 */
export type TextAnchor = 'centre' | 'top' | 'top-left';

/**
 * Text wrapped to `width` and hung on `at`, as one `<text>` carrying a
 * `<tspan>` per line. The style names both the class the stylesheet gives
 * the run and the size the wrap estimates with, so the two cannot be paired
 * wrongly at a call site.
 */
export function WrappedText({
  text,
  at,
  anchor,
  width,
  textStyle,
}: {
  readonly text: string;
  readonly at: Point;
  readonly anchor: TextAnchor;
  readonly width: number;
  readonly textStyle: WrappedTextStyle;
}): ReactElement | null {
  const rule = wrappedTextStyles[textStyle];
  const lines = wrapText(text, rule.fontSize, width);
  if (lines.length === 0) {
    return null;
  }
  const step = lineHeight(rule.fontSize);
  const first =
    anchor === 'centre' ? at.y - ((lines.length - 1) * step) / 2 : at.y;
  return (
    <text className={rule.className} x={svgNumber(at.x)} y={svgNumber(first)}>
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={svgNumber(at.x)}
          dy={svgNumber(index === 0 ? 0 : step)}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
