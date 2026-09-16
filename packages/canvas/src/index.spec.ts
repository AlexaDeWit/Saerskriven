import * as canvas from './index.js';

const exported = new Set(Object.keys(canvas));

describe('the package barrel', () => {
  it('carries every name the README hands its consumers', () => {
    const promised = [
      'layoutDiagram',
      'canvasNodeOf',
      'isBoundary',
      'drawnBounds',
      'flowLabelFollows',
      'flowWithFollowedLabel',
      'ElementGlyph',
      'DiagramGlyphs',
      'boxElementStrokeInsets',
      'themedCanvasStylesheet',
      'renderCanvasStylesheet',
      'canvasClassNames',
      'wrappedTextStyles',
      'severityToneClass',
      'renderThemeSchema',
      'defaultRenderTheme',
      'badgeTextColour',
      'lightPalette',
      'darkPalette',
      'canvasType',
      'gridSpacing',
      'panelCover',
      'contrastRatio',
      'rgbColour',
      'nearestHandleSide',
      'polylinePath',
      'smoothPath',
      'svgNumber',
      'boxOfPoints',
      'boxesOverlap',
      'wrapText',
      'xmlSafeText',
      'textExtent',
      'lineHeight',
      'lineHeightRatio',
      'nodeTextPlacement',
      'textPlacementCorners',
      'keyboardResizeStep',
      'shiftedKeyboardResizeStep',
      'resizeKeys',
      'CanvasNodeBody',
      'CanvasEdgeBody',
      'CanvasFreeEndBody',
      'toReactFlowNodes',
      'toReactFlowEdges',
      'freeEndNodes',
      'flowEndNodeId',
      'freeEndNodeKind',
      'layoutAtReactFlowNodes',
    ];
    expect(new Set(promised).size).toBe(promised.length);
    expect(promised.filter((name) => !exported.has(name))).toEqual([]);
  });

  it('keeps the spec fixtures out of what it exports', () => {
    expect(exported.has('everyGlyphModel')).toBe(false);
    expect(exported.has('parsedFixture')).toBe(false);
  });
});
