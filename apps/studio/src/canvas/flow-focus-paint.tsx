import {
  canvasClassNames,
  canvasInteractionClassNames,
  svgNumber,
  type Box,
} from '@saerskriven/canvas';
import { useStore } from '@xyflow/react';
import { useEffect } from 'react';

/** Matches the engine's outline bounds without changing the edge's SVG geometry. */
export function FlowFocusPaint(): null {
  const surface = useStore((state) => state.domNode);
  useEffect(() => {
    if (surface === null) {
      return undefined;
    }
    let focused: SVGGElement | null = null;
    let frame = 0;
    const paint = () => {
      if (focused?.matches(':focus-visible')) {
        paintFlowFocusRing(focused);
      }
    };
    const observer = new MutationObserver((changes) => {
      if (
        changes.some(
          ({ target }) =>
            target instanceof Element && target.closest('filter') === null,
        )
      ) {
        paint();
      }
    });
    const followFocus = () => {
      observer.disconnect();
      focused = surface.querySelector<SVGGElement>(
        '.react-flow__edge:focus-visible',
      );
      if (focused !== null) {
        paint();
        observer.observe(focused, {
          attributes: true,
          subtree: true,
          childList: true,
        });
      }
    };
    const keyed = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(followFocus);
    };
    surface.addEventListener('focusin', followFocus);
    surface.addEventListener('focusout', followFocus);
    surface.addEventListener('pointerover', keyed);
    surface.addEventListener('pointerout', keyed);
    window.addEventListener('keydown', keyed);
    followFocus();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      surface.removeEventListener('focusin', followFocus);
      surface.removeEventListener('focusout', followFocus);
      surface.removeEventListener('pointerover', keyed);
      surface.removeEventListener('pointerout', keyed);
      window.removeEventListener('keydown', keyed);
    };
  }, [surface]);
  return null;
}

/** Returns the painted outer extent in screen pixels, including stroke absent from the native client rectangle. */
export function paintFlowFocusRing(
  target: SVGGraphicsElement,
): Box | undefined {
  const ink = target.querySelector(
    `.${canvasInteractionClassNames.flowFocusInk}`,
  );
  const filter = ink?.closest('filter');
  const inner = filter?.querySelector('feFlood[result="inner"]');
  const style = getComputedStyle(target);
  if (
    filter === null ||
    filter === undefined ||
    inner === null ||
    inner === undefined ||
    style.outlineStyle !== 'solid'
  ) {
    return undefined;
  }
  const toScreen = target.getScreenCTM();
  if (toScreen === null) {
    return undefined;
  }
  const fromScreen = toScreen.inverse();
  const box = target.getBoundingClientRect();
  let x = fromScreen.a * box.left + fromScreen.c * box.top + fromScreen.e;
  let y = fromScreen.b * box.left + fromScreen.d * box.top + fromScreen.f;
  let right = x + box.width * fromScreen.a;
  let bottom = y + box.height * fromScreen.d;
  const path = target.querySelector<SVGPathElement>(
    `path.${canvasClassNames.flow}`,
  );
  if (path !== null) {
    const line = path.getBBox();
    const lineStyle = getComputedStyle(path);
    const halfStroke = Number.parseFloat(lineStyle.strokeWidth) / 2;
    const join =
      lineStyle.strokeLinejoin === 'miter'
        ? Number.parseFloat(lineStyle.strokeMiterlimit)
        : 1;
    const allowance = halfStroke * join;
    x = Math.min(x, line.x - allowance);
    y = Math.min(y, line.y - allowance);
    right = Math.max(right, line.x + line.width + allowance);
    bottom = Math.max(bottom, line.y + line.height + allowance);
  }
  const width = right - x;
  const height = bottom - y;
  const offset = Number.parseFloat(style.outlineOffset);
  const reach = offset + Number.parseFloat(style.outlineWidth);
  for (const [paint, padding] of [
    [filter, reach],
    [inner, offset],
  ] as const) {
    paint.setAttribute('x', svgNumber(x - padding));
    paint.setAttribute('y', svgNumber(y - padding));
    paint.setAttribute('width', svgNumber(width + padding * 2));
    paint.setAttribute('height', svgNumber(height + padding * 2));
  }
  const left = Number(filter.getAttribute('x'));
  const top = Number(filter.getAttribute('y'));
  const rightEdge = left + Number(filter.getAttribute('width'));
  const bottomEdge = top + Number(filter.getAttribute('height'));
  return {
    minX: toScreen.a * left + toScreen.c * top + toScreen.e,
    minY: toScreen.b * left + toScreen.d * top + toScreen.f,
    maxX: toScreen.a * rightEdge + toScreen.c * bottomEdge + toScreen.e,
    maxY: toScreen.b * rightEdge + toScreen.d * bottomEdge + toScreen.f,
  };
}
