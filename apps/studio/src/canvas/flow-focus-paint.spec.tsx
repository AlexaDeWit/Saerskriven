import {
  canvasClassNames,
  canvasInteractionClassNames,
} from '@saerskriven/canvas';
import { paintFlowFocusRing } from './flow-focus-paint.js';

const surface = () => {
  const target = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  target.innerHTML = `<defs><filter><feFlood class="${canvasInteractionClassNames.flowFocusInk}" /><feFlood result="inner" /></filter></defs>`;
  target.style.outlineStyle = 'solid';
  target.style.outlineWidth = '2px';
  target.style.outlineOffset = '2px';
  let box = new DOMRect(442, 218, 160, 100);
  Object.defineProperties(target, {
    getBoundingClientRect: { value: () => box },
    getScreenCTM: {
      value: () => ({
        inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -21, f: -9 }),
      }),
    },
  });
  document.body.appendChild(target);
  return {
    target,
    filter: target.querySelector('filter'),
    inner: target.querySelector('feFlood[result="inner"]'),
    move: () => {
      box = new DOMRect(462, 228, 180, 120);
    },
  };
};

const frame = (element: Element | null) =>
  ['x', 'y', 'width', 'height'].map((name) => element?.getAttribute(name));

describe('painted flow focus geometry', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps the native outline frame through zoom and pan', () => {
    const { target, filter, inner } = surface();
    paintFlowFocusRing(target);
    expect(frame(filter)).toEqual(['196', '96', '88', '58']);
    expect(frame(inner)).toEqual(['198', '98', '84', '54']);
  });

  it('follows a moved and resized flow', () => {
    const { target, filter, inner, move } = surface();
    paintFlowFocusRing(target);
    move();
    paintFlowFocusRing(target);
    expect(frame(filter)).toEqual(['206', '101', '98', '68']);
    expect(frame(inner)).toEqual(['208', '103', '94', '64']);
  });

  it('includes the visible line stroke where client bounds omit it', () => {
    const { target, filter, inner } = surface();
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add(canvasClassNames.flow);
    path.style.strokeWidth = '2px';
    path.style.strokeLinejoin = 'miter';
    path.style.strokeMiterlimit = '4';
    Object.defineProperty(path, 'getBBox', {
      value: () => ({ x: 200, y: 100, width: 80, height: 20 }),
    });
    target.appendChild(path);
    paintFlowFocusRing(target);
    expect(frame(filter)).toEqual(['192', '92', '96', '62']);
    expect(frame(inner)).toEqual(['194', '94', '92', '58']);
  });

  it('leaves a flow with no outline untouched', () => {
    const { target, filter, inner } = surface();
    target.style.outlineStyle = 'none';
    paintFlowFocusRing(target);
    expect(frame(filter)).toEqual([null, null, null, null]);
    expect(frame(inner)).toEqual([null, null, null, null]);
  });
});
