import type { Point } from '@saerskriven/model';
import { badgeExtent, type ThreatBadge } from './badges.js';
import { shiftedBy, type Box } from './geometry.js';
import { wrappedTextStyles } from './stylesheet.js';
import type { TextPlacement } from './text-placement.js';
import {
  averageGlyphWidthRatio,
  looseLabelWidth,
  textExtent,
  wrapText,
} from './typography.js';

/**
 * Where a flow's name and badge hang: one block, the badge first and the
 * name after it, on a ground-coloured `backing`. `badge` is absent for a
 * flow no open threat names, and `backing` for a flow with neither a name
 * nor a badge to draw.
 */
export type FlowLabelPlacement = {
  readonly name: TextPlacement;
  readonly badge: Point | undefined;
  readonly backing: Box | undefined;
};

/**
 * One way of composing a flow's block, measured from the centre of its
 * backing: the name wrapped to one width, and where the name and badge hang
 * from that centre.
 */
export type FlowBlock = {
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly name: TextPlacement;
  readonly badge: Point | undefined;
};

/** How far a block's backing reaches past the badge and name it carries. */
export const blockPadding = 4;

/** The room between a block's badge and its name. */
export const badgeNameGap = 4;

/**
 * The ways a flow's block can be composed, widest first: the name wrapped
 * to the width a flow carries no box for, then to about half that, then to
 * its longest word, each kept only where it comes out narrower than the one
 * before. A narrower wrap is never narrower than the longest word, so it
 * breaks none.
 */
export function flowBlocks(
  name: string,
  badge: ThreatBadge | undefined,
): readonly FlowBlock[] {
  const blocks = [flowBlock(name, badge, looseLabelWidth)];
  const word = longestWordColumns(name);
  for (const columns of [Math.max(word, halfWidthColumns), word]) {
    const narrower = flowBlock(name, badge, columnsWidth(columns));
    if (narrower.halfWidth < blocks[blocks.length - 1].halfWidth) {
      blocks.push(narrower);
    }
  }
  return blocks;
}

/** A block hung with its backing centred on `centre`. */
export function blockAt(block: FlowBlock, centre: Point): FlowLabelPlacement {
  return {
    name: { ...block.name, at: shiftedBy(block.name.at, centre) },
    badge:
      block.badge === undefined ? undefined : shiftedBy(block.badge, centre),
    backing:
      block.halfWidth === 0 && block.halfHeight === 0
        ? undefined
        : {
            minX: centre.x - block.halfWidth,
            minY: centre.y - block.halfHeight,
            maxX: centre.x + block.halfWidth,
            maxY: centre.y + block.halfHeight,
          },
  };
}

/** The centre of a placed block's backing, or its name's where it has none. */
export function blockCentre(placement: FlowLabelPlacement): Point {
  const { backing } = placement;
  return backing === undefined
    ? placement.name.at
    : {
        x: (backing.minX + backing.maxX) / 2,
        y: (backing.minY + backing.maxY) / 2,
      };
}

/** A placed block moved by an offset, its backing, badge and name together. */
export function shiftedPlacement(
  placement: FlowLabelPlacement,
  by: Point,
): FlowLabelPlacement {
  const { backing } = placement;
  return {
    name: { ...placement.name, at: shiftedBy(placement.name.at, by) },
    badge:
      placement.badge === undefined
        ? undefined
        : shiftedBy(placement.badge, by),
    backing:
      backing === undefined
        ? undefined
        : {
            minX: backing.minX + by.x,
            minY: backing.minY + by.y,
            maxX: backing.maxX + by.x,
            maxY: backing.maxY + by.y,
          },
  };
}

const fontSize = wrappedTextStyles.flowLabel.fontSize;

const glyphWidth = fontSize * averageGlyphWidthRatio;

const halfWidthColumns = Math.floor(looseLabelWidth / 2 / glyphWidth);

function flowBlock(
  name: string,
  badge: ThreatBadge | undefined,
  width: number,
): FlowBlock {
  const text = textExtent(wrapText(name, fontSize, width), fontSize);
  const reach = badge === undefined ? undefined : badgeExtent(badge);
  const badgeWidth = reach === undefined ? 0 : reach.radius * 2;
  const nameStart =
    reach === undefined || text.width === 0 ? 0 : badgeWidth + badgeNameGap;
  const right = Math.max(badgeWidth, nameStart + text.width);
  const top = Math.min(-(reach?.radius ?? 0), -text.height / 2);
  const bottom = Math.max(reach?.depth ?? 0, text.height / 2);
  const centre = { x: right / 2, y: (top + bottom) / 2 };
  const drawn = right > 0;
  return {
    halfWidth: drawn ? right / 2 + blockPadding : 0,
    halfHeight: drawn ? (bottom - top) / 2 + blockPadding : 0,
    name: {
      text: name,
      at: {
        x: text.width === 0 ? 0 : nameStart + text.width / 2 - centre.x,
        y: -centre.y,
      },
      anchor: 'centre',
      width,
      textStyle: 'flowLabel',
    },
    badge:
      reach === undefined
        ? undefined
        : { x: reach.radius - centre.x, y: -centre.y },
  };
}

function longestWordColumns(name: string): number {
  return Math.max(
    0,
    ...name
      .split(/\s+/u)
      .map((word) =>
        Math.round(textExtent([word], fontSize).width / glyphWidth),
      ),
  );
}

function columnsWidth(columns: number): number {
  return (columns + 0.5) * glyphWidth;
}
