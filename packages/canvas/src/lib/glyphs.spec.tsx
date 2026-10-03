import { elementId } from '@saerskriven/model/fixtures';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { edgeNamed, nodeNamed, specMarks } from './canvas.fixtures.js';
import {
  boxElementStrokeInsets,
  BoxElementGlyph,
  ElementGlyph,
  FlowGlyph,
  PlacedElementGlyph,
} from './glyphs.js';
import type { CanvasEdge, CanvasNode } from './layout.js';
import {
  boundaryStrokeWidth,
  canvasClassNames,
  wrappedTextStyles,
} from './stylesheet.js';
import { badgeExtent, type ThreatBadge } from './badges.js';
import type { Point } from '@saerskriven/model';
import { segmentMeetsBox, type Box } from './geometry.js';
import { flowLabelPlacements } from './flow-labels.js';
import { looseLabelWidth, textExtent } from './typography.js';
import { strokeWidths } from './tokens.js';

const glyphOf = (value: string): string =>
  renderToStaticMarkup(
    <ElementGlyph marks={specMarks} node={nodeNamed(value)} />,
  );

const packageSource = join(import.meta.dirname, '..');

const sourceFiles = (from: string): string[] =>
  readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/u.test(entry.name) && !entry.name.includes('.spec.')
      ? [path]
      : [];
  });

const sources = sourceFiles(packageSource).map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

describe('ElementGlyph, taking its extent from the model', () => {
  it('names the stroke outside each box outline', () => {
    expect(boxElementStrokeInsets('actor')).toEqual({
      top: strokeWidths.outline / 2,
      right: strokeWidths.outline / 2,
      bottom: strokeWidths.outline / 2,
      left: strokeWidths.outline / 2,
    });
    expect(boxElementStrokeInsets('store')).toEqual({
      top: strokeWidths.store / 2,
      right: 0,
      bottom: strokeWidths.store / 2,
      left: 0,
    });
  });

  it('reduces a stroke that would exceed a thin box', () => {
    const size = { width: 50, height: 0.5 };

    expect(boxElementStrokeInsets('store', size)).toEqual({
      top: 0.25,
      right: 0,
      bottom: 0.25,
      left: 0,
    });
    expect(
      renderToStaticMarkup(<BoxElementGlyph kind="store" size={size} />),
    ).toContain('stroke-width:0.5');
  });

  it('draws an actor as a rectangle of the model width and height', () => {
    const node = nodeNamed('el-client');
    expect(glyphOf('el-client')).toContain(
      `<rect class="${canvasClassNames.shape} ${canvasClassNames.actor}" ` +
        `width="${node.size.width}" height="${node.size.height}"`,
    );
  });

  it('draws a process as the ellipse filling the model box', () => {
    expect(
      renderToStaticMarkup(
        <BoxElementGlyph kind="process" size={{ width: 120, height: 60 }} />,
      ),
    ).toContain(
      `<ellipse class="${canvasClassNames.shape} ${canvasClassNames.process}" ` +
        'cx="60" cy="30" rx="60" ry="30"',
    );
  });

  it('draws a store as a pair of lines open at the sides', () => {
    const node = nodeNamed('el-db');
    const markup = glyphOf('el-db');
    expect(markup.match(/<line/gu)).toHaveLength(2);
    expect(markup).toContain(`x2="${node.size.width}" y2="0"`);
    expect(markup).toContain(`y1="${node.size.height}"`);
  });

  it('draws a text element as prose with no outline of its own', () => {
    const markup = glyphOf('el-note');
    expect(markup).toContain(canvasClassNames.note);
    expect(markup).not.toContain('<rect');
    expect(markup).not.toContain(canvasClassNames.shape);
  });

  it('draws a box boundary as a rectangle of the shape width and height', () => {
    const node = nodeNamed('el-zone');
    expect(glyphOf('el-zone')).toContain(
      `<rect class="${canvasClassNames.shape} ${canvasClassNames.boundaryBox}" ` +
        `width="${node.size.width}" height="${node.size.height}"`,
    );
  });

  it('draws a curve boundary as one smooth path through its waypoints', () => {
    const markup = glyphOf('el-edge-zone');
    expect(markup).toContain(canvasClassNames.boundaryCurve);
    expect(markup).toContain(
      `d="M ${boundaryStrokeWidth} ${boundaryStrokeWidth} C `,
    );
  });

  it('marks an out-of-scope element and no other', () => {
    expect(glyphOf('el-db')).toContain(canvasClassNames.outOfScope);
    expect(glyphOf('el-api')).not.toContain(canvasClassNames.outOfScope);
  });

  it('badges an element the open threats name and no other', () => {
    expect(glyphOf('el-client')).toContain(canvasClassNames.badge);
    expect(glyphOf('el-note')).not.toContain(canvasClassNames.badge);
  });

  it('leaves the text out while a field stands in for it', () => {
    const markup = renderToStaticMarkup(
      <ElementGlyph
        marks={specMarks}
        node={nodeNamed('el-client')}
        textVisible={false}
      />,
    );
    expect(markup).toContain('<rect');
    expect(markup).not.toContain(canvasClassNames.label);
  });

  it('follows the model when a size changes', () => {
    const widened: CanvasNode = {
      ...nodeNamed('el-client'),
      size: { width: 999, height: 111 },
    };
    expect(
      renderToStaticMarkup(<ElementGlyph marks={specMarks} node={widened} />),
    ).toContain('width="999" height="111"');
  });
});

describe('PlacedElementGlyph', () => {
  it('moves the glyph to the model position', () => {
    const node = nodeNamed('el-client');
    expect(
      renderToStaticMarkup(
        <PlacedElementGlyph marks={specMarks} node={node} />,
      ),
    ).toContain(
      `transform="translate(${node.position.x}, ${node.position.y})"`,
    );
  });
});

describe('FlowGlyph', () => {
  it('runs straight segments from source through waypoints to target', () => {
    expect(
      renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={edgeNamed('el-request')} />,
      ),
    ).toContain('d="M 200 100 L 240 100 L 280 120"');
  });

  it('marks the target with an arrowhead', () => {
    expect(
      renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={edgeNamed('el-request')} />,
      ),
    ).toContain(`class="${canvasClassNames.flowArrow}"`);
  });

  it('names the flow near the midpoint of its longest segment', () => {
    expect(
      renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={edgeNamed('el-probe')} />,
      ),
    ).toContain('Nightly backup probe');
  });

  it('leaves the name out while a field stands in for it', () => {
    const markup = renderToStaticMarkup(
      <FlowGlyph
        marks={specMarks}
        edge={edgeNamed('el-probe')}
        textVisible={false}
      />,
    );
    expect(markup).toContain(`class="${canvasClassNames.flowArrow}"`);
    expect(markup).not.toContain('Nightly backup probe');
  });

  it('badges a flow the open threats name', () => {
    expect(
      renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={edgeNamed('el-request')} />,
      ),
    ).toContain(canvasClassNames.badge);
    expect(
      renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={edgeNamed('el-write')} />,
      ),
    ).not.toContain(canvasClassNames.badge);
  });
});

describe('the primitives, measuring nothing', () => {
  it('reads no glyph extent out of a layout engine', () => {
    expect(sources.map((source) => source.path)).toContain(
      join(packageSource, 'index.ts'),
    );
    const measuring = sources.filter((source) =>
      /getBBox|getComputedTextLength|measureText|getBoundingClientRect/u.test(
        source.text,
      ),
    );
    expect(measuring.map((source) => source.path)).toEqual([]);
  });
});

const flowFontSize = wrappedTextStyles.flowLabel.fontSize;

const orientations = [
  ['horizontal', { x: 0, y: 0 }, { x: 400, y: 0 }],
  ['vertical, running down', { x: 0, y: 0 }, { x: 0, y: 400 }],
  ['vertical, running up', { x: 0, y: 400 }, { x: 0, y: 0 }],
  ['diagonal, falling', { x: -200, y: -200 }, { x: 200, y: 200 }],
  ['diagonal, rising', { x: -200, y: 200 }, { x: 200, y: -200 }],
] as const;

const wordyBadge: ThreatBadge = {
  kind: 'counted',
  count: 4,
  severity: 'high',
  secondary: 2,
  flagged: true,
};

const probeName = 'a name long enough to wrap over several lines of its own';

const probeFlow = (
  from: Point,
  to: Point,
  badge: ThreatBadge | undefined,
  name = probeName,
): CanvasEdge => ({
  id: elementId('el-probe'),
  name,
  outOfScope: false,
  badge,
  source: from,
  target: to,
  sourceSide: undefined,
  targetSide: undefined,
  sourcePin: undefined,
  targetPin: undefined,
  sourceElement: undefined,
  targetElement: undefined,
  waypoints: [],
  bidirectional: false,
  label: flowLabelPlacements(
    [
      {
        id: elementId('el-probe'),
        name,
        badge,
        bidirectional: false,
        points: [from, to],
      },
    ],
    [],
  )[0],
});

const labelBoxOf = (markup: string): Box => {
  const found = /<text[^>]*x="([-\d.]+)" y="([-\d.]+)">(.*?)<\/text>/u.exec(
    markup,
  );
  if (found === null) {
    throw new Error('The flow drew no label to measure');
  }
  const lines = [...found[3].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/gu)].map(
    (line) => line[1],
  );
  const extent = textExtent(lines, flowFontSize);
  const top = Number(found[2]) - flowFontSize / 2;
  const centre = Number(found[1]);
  return {
    minX: centre - extent.width / 2,
    maxX: centre + extent.width / 2,
    minY: top,
    maxY: top + extent.height,
  };
};

const badgeBoxOf = (markup: string, badge: ThreatBadge): Box => {
  const found =
    /class="saer-diagram-badge" transform="translate\(([-\d.]+), ([-\d.]+)\)"/u.exec(
      markup,
    );
  if (found === null) {
    throw new Error('The flow drew no badge to measure');
  }
  const extent = badgeExtent(badge);
  const at = { x: Number(found[1]), y: Number(found[2]) };
  return {
    minX: at.x - extent.radius,
    maxX: at.x + extent.radius,
    minY: at.y - extent.radius,
    maxY: at.y + extent.depth,
  };
};

const backingOf = (markup: string): Box => {
  const found =
    /<rect class="saer-diagram-flow-backing" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/u.exec(
      markup,
    );
  if (found === null) {
    throw new Error('The flow drew no backing to measure');
  }
  const [x, y, width, height] = found.slice(1).map(Number);
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
};

const holds = (outer: Box, inner: Box): boolean =>
  outer.minX <= inner.minX + 1e-3 &&
  outer.minY <= inner.minY + 1e-3 &&
  outer.maxX >= inner.maxX - 1e-3 &&
  outer.maxY >= inner.maxY - 1e-3;

describe('FlowGlyph, drawing its badge and name as one block on its line', () => {
  it('carries the class names the markup probes below look for', () => {
    expect(canvasClassNames.flowBacking).toBe('saer-diagram-flow-backing');
    expect(canvasClassNames.badge).toBe('saer-diagram-badge');
  });

  it.each(orientations)(
    'draws the backing over a %s line, so the line breaks around it',
    (_orientation, from, to) => {
      const markup = renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={probeFlow(from, to, undefined)} />,
      );
      expect(markup.indexOf(canvasClassNames.flowBacking)).toBeGreaterThan(
        markup.indexOf(canvasClassNames.flowArrow),
      );
      expect(segmentMeetsBox({ from, to }, backingOf(markup))).toBe(true);
    },
  );

  it.each(orientations)(
    'holds the badge and the name inside the backing on a %s line',
    (_orientation, from, to) => {
      const markup = renderToStaticMarkup(
        <FlowGlyph marks={specMarks} edge={probeFlow(from, to, wordyBadge)} />,
      );
      const backing = backingOf(markup);
      expect(holds(backing, labelBoxOf(markup))).toBe(true);
      expect(holds(backing, badgeBoxOf(markup, wordyBadge))).toBe(true);
    },
  );

  it('draws the badge first and the name after it', () => {
    const markup = renderToStaticMarkup(
      <FlowGlyph
        marks={specMarks}
        edge={probeFlow({ x: 0, y: 0 }, { x: 400, y: 0 }, wordyBadge)}
      />,
    );
    expect(badgeBoxOf(markup, wordyBadge).maxX).toBeLessThan(
      labelBoxOf(markup).minX,
    );
    expect(markup.indexOf(canvasClassNames.flowBacking)).toBeLessThan(
      markup.indexOf(`class="${canvasClassNames.badge}"`),
    );
    expect(markup.indexOf(`class="${canvasClassNames.badge}"`)).toBeLessThan(
      markup.indexOf(canvasClassNames.flowLabel),
    );
  });

  it('wraps the name to the width a flow carries no box for', () => {
    const box = labelBoxOf(
      renderToStaticMarkup(
        <FlowGlyph
          marks={specMarks}
          edge={probeFlow({ x: 0, y: 0 }, { x: 400, y: 0 }, undefined)}
        />,
      ),
    );
    expect(box.maxX - box.minX).toBeLessThanOrEqual(looseLabelWidth);
  });

  it('draws no backing for a flow with neither a name nor a badge', () => {
    const markup = renderToStaticMarkup(
      <FlowGlyph
        marks={specMarks}
        edge={probeFlow({ x: 0, y: 0 }, { x: 400, y: 0 }, undefined, '')}
      />,
    );
    expect(markup).not.toContain(canvasClassNames.flowBacking);
    expect(markup).not.toContain(canvasClassNames.flowLabel);
  });
});
