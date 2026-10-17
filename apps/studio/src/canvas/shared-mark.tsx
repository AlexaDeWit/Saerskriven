import { Link2Icon } from '@radix-ui/react-icons';
import { useCallback } from 'react';
import {
  svgNumber,
  type CanvasEdge,
  type CanvasNode,
} from '@saerskriven/canvas';
import type { ElementId, Point } from '@saerskriven/model';
import type { State } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { sharedElementIds } from './other-diagrams.js';
import styles from './shared-mark.module.css';

const markSize = 16;

const markHalf = markSize / 2;

const glyphSize = 11;

const markGap = 3;

const selectedStep = markHalf + markGap;

/** Whether the element `elementId` names is placed on more than one diagram. */
export function useSharedElement(elementId: ElementId | undefined): boolean {
  return useModelStore(
    useCallback(
      (state: State) =>
        elementId !== undefined &&
        sharedElementIds(state.present.diagrams).has(elementId),
      [elementId],
    ),
  );
}

/**
 * The mark on an element placed on more than one diagram: a square holding a
 * link glyph, hung on the top left corner of its box, opposite the threat
 * badge. A selected node hangs it past that corner, clear of the resize
 * handle there, except a boundary curve, whose corner handles already stand
 * outside its corners. The studio alone draws it: the accessible name says
 * the same, and no export carries it.
 */
export function SharedNodeMark({
  node,
  selected,
}: {
  readonly node: CanvasNode;
  readonly selected: boolean;
}) {
  const steps = selected && node.kind !== 'boundary-curve';
  return (
    <svg
      aria-hidden="true"
      className={styles.layer}
      data-shared-mark=""
      height={svgNumber(node.size.height)}
      overflow="visible"
      width={svgNumber(node.size.width)}
    >
      <MarkGlyph
        at={steps ? { x: -selectedStep, y: -selectedStep } : { x: 0, y: 0 }}
      />
    </svg>
  );
}

/**
 * {@link SharedNodeMark} for a flow, drawn in the layer that holds the flow
 * names: left of the flow's name block, or where the block would stand on a
 * flow that draws none.
 */
export function SharedFlowMark({ edge }: { readonly edge: CanvasEdge }) {
  const { backing, name } = edge.label;
  return (
    <g data-shared-mark="">
      <MarkGlyph
        at={
          backing === undefined
            ? name.at
            : {
                x: backing.minX - markGap - markHalf,
                y: (backing.minY + backing.maxY) / 2,
              }
        }
      />
    </g>
  );
}

function MarkGlyph({ at }: { readonly at: Point }) {
  return (
    <g
      className={styles.mark}
      transform={`translate(${svgNumber(at.x)} ${svgNumber(at.y)})`}
    >
      <rect
        height={markSize}
        rx={3}
        width={markSize}
        x={-markHalf}
        y={-markHalf}
      />
      <Link2Icon
        height={glyphSize}
        width={glyphSize}
        x={-glyphSize / 2}
        y={-glyphSize / 2}
      />
    </g>
  );
}
