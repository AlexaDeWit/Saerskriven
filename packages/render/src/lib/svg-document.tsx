import {
  renderCanvasStylesheet,
  defaultRenderTheme,
  type RenderTheme,
  DiagramGlyphs,
  layoutDiagram,
  svgNumber,
  xmlSafeText,
  type CanvasBounds,
  type CanvasLayout,
  type DrawingHolds,
  type UnplacedEndpoint,
} from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import type { Diagram, Model } from '@saerskriven/model';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DiagramOptions } from './diagram-options.js';
import { renderTerms } from './terms.js';

const margin = 8;

/**
 * A standalone SVG document, its size in user units, and the flow endpoints
 * the layout could not place, which the markup leaves out.
 */
export type SvgDocument = {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/** A standalone SVG with optional threat labels and no external references. */
export function renderSvg(
  diagram: Diagram,
  model: Model,
  locale: Locale,
  theme: RenderTheme = defaultRenderTheme,
  options: DiagramOptions = {},
): SvgDocument {
  const layout = layoutDiagram(
    diagram,
    options.showThreatLabels === false ? { ...model, threats: [] } : model,
  );
  const box = grown(layout.bounds);
  const drawn = renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBoxOf(box)}
      width={svgNumber(box.width)}
      height={svgNumber(box.height)}
    >
      <title>{xmlSafeText(diagram.title)}</title>
      <rect
        x={svgNumber(box.x)}
        y={svgNumber(box.y)}
        width={svgNumber(box.width)}
        height={svgNumber(box.height)}
        fill={theme.colours.background}
      />
      <style>{renderCanvasStylesheet(theme, drawingHolds(layout))}</style>
      <DiagramGlyphs layout={layout} marks={renderTerms(locale).marks} />
    </svg>,
  );
  return {
    svg: `${drawn}\n`,
    width: box.width,
    height: box.height,
    unplaced: layout.unplaced,
  };
}

function drawingHolds(layout: CanvasLayout): DrawingHolds {
  return {
    accent:
      layout.nodes.some((node) => 'accent' in node) ||
      layout.edges.some((edge) => 'accent' in edge),
    awayEnd: layout.edges.some(
      (edge) => edge.sourceAway !== undefined || edge.targetAway !== undefined,
    ),
  };
}

function grown(bounds: CanvasBounds): CanvasBounds {
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };
}

function viewBoxOf(box: CanvasBounds): string {
  return [box.x, box.y, box.width, box.height]
    .map((value) => svgNumber(value))
    .join(' ');
}
