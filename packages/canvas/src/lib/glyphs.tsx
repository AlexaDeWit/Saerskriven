import { accentParts, type Accent, type Size } from '@saerskriven/model';
import type { CSSProperties, ReactElement, SVGProps } from 'react';
import { awayEndLabels } from './away-ends.js';
import { badgeAnchor, ThreatBadgeGlyph, type BadgeMarks } from './badges.js';
import { edgePoints } from './flow-anchors.js';
import type { Box } from './geometry.js';
import { WrappedText } from './labels.js';
import type { CanvasEdge, CanvasNode, CanvasNodeKind } from './layout.js';
import { svgNumber } from './numbers.js';
import { noteFrame, processEllipse } from './obstacles.js';
import { arrowheadPath, polylinePath, smoothPath, translate } from './paths.js';
import {
  accentClassNames,
  accentGroupClasses,
  awayClassNames,
  canvasClassNames,
} from './stylesheet.js';
import { nodeTextPlacement } from './text-placement.js';
import { noteAccentBar, strokeWidths } from './tokens.js';

/** An element kind whose model geometry is a position and size. */
export type BoxElementKind = Exclude<CanvasNodeKind, 'boundary-curve' | 'text'>;

/** A thin box narrows its stroke before these insets bound the painted extent. */
export function boxElementStrokeInsets(
  kind: BoxElementKind,
  size?: Size,
): {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
} {
  const halfStroke = fittedStroke(kind, size) / 2;
  return kind === 'store'
    ? { top: halfStroke, right: 0, bottom: halfStroke, left: 0 }
    : {
        top: halfStroke,
        right: halfStroke,
        bottom: halfStroke,
        left: halfStroke,
      };
}

/**
 * One box element's outline in its own coordinates. `tinted` marks the fill
 * of an actor or a process for a strong accent's tint, and draws a store the
 * band that takes it, which a store has no other use for. A trust boundary
 * has no fill to tint.
 */
export function BoxElementGlyph({
  kind,
  size,
  tinted = false,
}: {
  readonly kind: BoxElementKind;
  readonly size: Size;
  readonly tinted?: boolean;
}): ReactElement {
  const style = boxStrokeStyle(kind, size);
  if (kind === 'actor') {
    return rectOutline(fillClass(canvasClassNames.actor, tinted), size, style);
  }
  if (kind === 'process') {
    return processOutline(size, tinted, style);
  }
  if (kind === 'store') {
    return storeOutline(size, tinted, style);
  }
  return rectOutline(canvasClassNames.boundaryBox, size, style);
}

/**
 * Uses node coordinates, with the text and badge optionally drawn in separate layers.
 * An out-of-scope note adds a frame outside its box. An accented note draws a
 * bar down the inside of its left edge, and a strong one tints its whole box
 * behind the bar.
 */
export function ElementGlyph({
  badgeVisible = true,
  marks,
  node,
  textVisible = true,
}: {
  readonly badgeVisible?: boolean;
  readonly marks: BadgeMarks;
  readonly node: CanvasNode;
  readonly textVisible?: boolean;
}): ReactElement {
  return (
    <g className={groupClass(node.outOfScope, node.accent)}>
      {outlineOf(node)}
      {textVisible ? <WrappedText {...nodeTextPlacement(node)} /> : null}
      {!badgeVisible || node.badge === undefined ? null : (
        <ThreatBadgeGlyph
          badge={node.badge}
          at={badgeAnchor(node.size)}
          marks={marks}
        />
      )}
    </g>
  );
}

/** Headless rendering uses model positions rather than React Flow placement. */
export function PlacedElementGlyph({
  marks,
  node,
}: {
  readonly marks: BadgeMarks;
  readonly node: CanvasNode;
}): ReactElement {
  return (
    <g transform={translate(node.position)}>
      <ElementGlyph marks={marks} node={node} />
    </g>
  );
}

/**
 * Draws the block after the line so its backing covers the line. An end
 * drawn away from its element hangs a dashed frame naming that element, drawn
 * apart from the flow's own scope and accent, since the frame stands for the
 * element.
 */
export function FlowGlyph({
  blockVisible = true,
  edge,
  marks,
  textVisible = true,
}: {
  readonly blockVisible?: boolean;
  readonly edge: CanvasEdge;
  readonly marks: BadgeMarks;
  readonly textVisible?: boolean;
}): ReactElement {
  const points = edgePoints(edge);
  const away = awayEndLabels(edge);
  const flow = (
    <g className={groupClass(edge.outOfScope, edge.accent)}>
      <path
        className={shapeClass(canvasClassNames.flow)}
        d={polylinePath(points)}
      />
      <path
        className={canvasClassNames.flowArrow}
        d={arrowheadPath(edge.target, points[points.length - 2])}
      />
      {edge.bidirectional ? (
        <path
          className={canvasClassNames.flowArrow}
          d={arrowheadPath(edge.source, points[1])}
        />
      ) : null}
      {blockVisible ? flowBlockGlyph({ edge, marks, textVisible }) : null}
    </g>
  );
  return away.length === 0 ? (
    flow
  ) : (
    <>
      {flow}
      <g className={canvasClassNames.element}>
        {away.map((label) => (
          <g key={label.side}>
            {rectOfBox(awayClassNames.frame, label.frame)}
            {textVisible ? <WrappedText {...label.name} /> : null}
          </g>
        ))}
      </g>
    </>
  );
}

/** The backing, badge and name share one layout in the studio and exports. */
export function flowBlockGlyph({
  edge,
  marks,
  textVisible = true,
}: {
  readonly edge: CanvasEdge;
  readonly marks: BadgeMarks;
  readonly textVisible?: boolean;
}): ReactElement {
  return (
    <>
      {edge.label.backing === undefined
        ? null
        : rectOfBox(canvasClassNames.flowBacking, edge.label.backing)}
      {edge.badge === undefined || edge.label.badge === undefined ? null : (
        <ThreatBadgeGlyph
          badge={edge.badge}
          at={edge.label.badge}
          marks={marks}
        />
      )}
      {textVisible ? <WrappedText {...edge.label.name} /> : null}
    </>
  );
}

function groupClass(outOfScope: boolean, accent: Accent | undefined): string {
  return [
    canvasClassNames.element,
    ...(outOfScope ? [canvasClassNames.outOfScope] : []),
    ...accentGroupClasses(accent),
  ].join(' ');
}

function shapeClass(outline: string): string {
  return `${canvasClassNames.shape} ${outline}`;
}

function fillClass(outline: string, tinted: boolean): string {
  return tinted ? `${outline} ${accentClassNames.tinted}` : outline;
}

function outlineOf(node: CanvasNode): ReactElement | null {
  if (node.kind === 'boundary-curve') {
    return boundaryCurveOutline(node);
  }
  if (node.kind === 'text') {
    return noteOutline(node);
  }
  return (
    <BoxElementGlyph
      kind={node.kind}
      size={node.size}
      tinted={isStrong(node.accent)}
    />
  );
}

function isStrong(accent: Accent | undefined): boolean {
  return accent !== undefined && accentParts[accent].strong;
}

function noteOutline(
  node: Extract<CanvasNode, { kind: 'text' }>,
): ReactElement {
  const frame = noteFrame(node, { x: 0, y: 0 });
  return (
    <>
      {frame === undefined
        ? null
        : rectOfBox(shapeClass(canvasClassNames.noteFrame), frame)}
      {isStrong(node.accent)
        ? tintBand(accentClassNames.noteGround, node.size)
        : null}
      {node.accent === undefined ? null : (
        <rect
          className={accentClassNames.noteBar}
          width={svgNumber(Math.min(noteAccentBar, node.size.width))}
          height={svgNumber(node.size.height)}
        />
      )}
    </>
  );
}

function tintBand(className: string, size: Size): ReactElement {
  return (
    <rect
      className={fillClass(className, true)}
      width={svgNumber(size.width)}
      height={svgNumber(size.height)}
    />
  );
}

/** Formats the backing and its interaction bounds with the same coordinate checks. */
export function rectOfBox(
  className: string | undefined,
  box: Box,
  attributes: Pick<
    SVGProps<SVGRectElement>,
    'fill' | 'pointerEvents' | 'stroke' | 'filter'
  > = {},
): ReactElement {
  return (
    <rect
      className={className}
      x={svgNumber(box.minX)}
      y={svgNumber(box.minY)}
      width={svgNumber(box.maxX - box.minX)}
      height={svgNumber(box.maxY - box.minY)}
      {...attributes}
    />
  );
}

function fittedStroke(kind: BoxElementKind, size?: Size): number {
  const nominal = kind === 'store' ? strokeWidths.store : strokeWidths.outline;
  return size === undefined
    ? nominal
    : Math.min(
        nominal,
        kind === 'store' ? size.height : Math.min(size.width, size.height),
      );
}

function boxStrokeStyle(
  kind: BoxElementKind,
  size: Size,
): CSSProperties | undefined {
  const fitted = fittedStroke(kind, size);
  return fitted === fittedStroke(kind)
    ? undefined
    : { strokeWidth: svgNumber(fitted) };
}

function rectOutline(
  outline: string,
  size: Size,
  style?: CSSProperties,
): ReactElement {
  return (
    <rect
      className={shapeClass(outline)}
      style={style}
      width={svgNumber(size.width)}
      height={svgNumber(size.height)}
    />
  );
}

function processOutline(
  size: Size,
  tinted: boolean,
  style?: CSSProperties,
): ReactElement {
  const ellipse = processEllipse(size);
  return (
    <ellipse
      className={shapeClass(fillClass(canvasClassNames.process, tinted))}
      style={style}
      cx={svgNumber(ellipse.centre.x)}
      cy={svgNumber(ellipse.centre.y)}
      rx={svgNumber(ellipse.radiusX)}
      ry={svgNumber(ellipse.radiusY)}
    />
  );
}

function storeOutline(
  size: Size,
  tinted: boolean,
  style?: CSSProperties,
): ReactElement {
  const right = svgNumber(size.width);
  const bottom = svgNumber(size.height);
  return (
    <>
      {tinted ? tintBand(accentClassNames.storeBand, size) : null}
      <line
        className={shapeClass(canvasClassNames.store)}
        style={style}
        x1="0"
        y1="0"
        x2={right}
        y2="0"
      />
      <line
        className={shapeClass(canvasClassNames.store)}
        style={style}
        x1="0"
        y1={bottom}
        x2={right}
        y2={bottom}
      />
    </>
  );
}

function boundaryCurveOutline(
  node: Extract<CanvasNode, { kind: 'boundary-curve' }>,
): ReactElement {
  return (
    <path
      className={shapeClass(canvasClassNames.boundaryCurve)}
      d={smoothPath(node.waypoints)}
    />
  );
}
