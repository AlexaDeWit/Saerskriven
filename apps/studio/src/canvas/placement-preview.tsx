import {
  ElementGlyph,
  smoothPath,
  svgNumber,
  type CanvasNode,
} from '@saerskriven/canvas';
import type { Point, Size } from '@saerskriven/model';
import { ViewportPortal } from '@xyflow/react';
import { useBadgeMarks } from './names.js';
import styles from './placement.module.css';

/** The element geometry shown before a placement reaches the model. */
export type PlacementDraft =
  | {
      readonly kind: 'box';
      readonly node: CanvasNode;
      readonly position: Point;
      readonly size: Size;
    }
  | { readonly kind: 'curve'; readonly points: readonly Point[] };

/** Draws placement geometry inside React Flow's transformed viewport. */
export function PlacementPreview({
  preview,
}: {
  readonly preview: PlacementDraft | undefined;
}) {
  const marks = useBadgeMarks();
  if (preview === undefined) {
    return null;
  }
  if (preview.kind === 'box') {
    return (
      <ViewportPortal>
        <svg
          aria-hidden="true"
          className={styles.box}
          data-testid="box-draft"
          data-x={svgNumber(preview.position.x)}
          data-y={svgNumber(preview.position.y)}
          height={svgNumber(preview.size.height)}
          style={{
            height: preview.size.height,
            transform: `translate(${String(preview.position.x)}px, ${String(preview.position.y)}px)`,
            width: preview.size.width,
          }}
          width={svgNumber(preview.size.width)}
        >
          <ElementGlyph
            marks={marks}
            node={{ ...preview.node, position: { x: 0, y: 0 } }}
          />
        </svg>
      </ViewportPortal>
    );
  }
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className={styles.curve}
        data-testid="curve-draft"
      >
        <path d={smoothPath(preview.points)} />
        {preview.points.map((point, index) => (
          <circle cx={point.x} cy={point.y} key={index} r="3" />
        ))}
      </svg>
    </ViewportPortal>
  );
}
