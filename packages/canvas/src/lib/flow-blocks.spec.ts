import type { ThreatBadge } from './badges.js';
import { blockAt, flowBlocks } from './flow-blocks.js';
import { wrapText } from './typography.js';

const badge: ThreatBadge = {
  kind: 'counted',
  count: 2,
  severity: 'high',
  secondary: 0,
  flagged: false,
};

const linesOf = (name: string, width: number): number =>
  wrapText(name, 10, width).length;

describe('flowBlocks', () => {
  it('composes the badge first and the name after it, about one centre', () => {
    const [block] = flowBlocks('ship the parcel', badge);
    expect(block.badge).toBeDefined();
    expect(block.badge?.x ?? 0).toBeLessThan(block.name.at.x);
    expect(block.badge?.y).toBe(block.name.at.y);
    expect(block.halfWidth).toBeGreaterThan(block.name.at.x);
  });

  it('offers a narrower wrap after the full one, never breaking a word', () => {
    const name = 'confirm the authorisation';
    const [wide, narrow] = flowBlocks(name, undefined);
    expect(narrow.halfWidth).toBeLessThan(wide.halfWidth);
    expect(linesOf(name, narrow.name.width)).toBeGreaterThan(
      linesOf(name, wide.name.width),
    );
    expect(linesOf('authorisation', narrow.name.width)).toBe(1);
  });

  it('wraps down to the longest word, each wrap narrower than the last', () => {
    const widths = flowBlocks('Submit order', undefined).map(
      (block) => block.halfWidth,
    );
    expect(widths).toHaveLength(2);
    expect(widths[1]).toBeLessThan(widths[0]);
  });

  it('never wraps a name narrower than three lines allow', () => {
    const name = 'browse the catalogue and fill a basket';
    const blocks = flowBlocks(name, undefined);
    expect(blocks.map((block) => linesOf(name, block.name.width))).toEqual([
      2, 3,
    ]);
  });

  it('offers no narrower wrap for a name of one word', () => {
    expect(flowBlocks('Store', undefined)).toHaveLength(1);
  });

  it('composes a badge alone for a flow with no name', () => {
    const [block] = flowBlocks('', badge);
    expect(block.badge).toBeDefined();
    expect(blockAt(block, { x: 0, y: 0 }).backing).toBeDefined();
  });

  it('composes nothing to draw for a flow with no name and no badge', () => {
    const [block] = flowBlocks(' ', undefined);
    expect(blockAt(block, { x: 5, y: 7 })).toEqual({
      name: { ...block.name, at: { x: 5, y: 7 } },
      badge: undefined,
      backing: undefined,
    });
  });
});
