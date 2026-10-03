import type { Point } from '@saerskriven/model';
import { elementId } from '@saerskriven/model/fixtures';
import { boundsOfPoints } from './bounds.js';
import type { NodeBox } from './handles.js';
import { canvasNodeOf, type CanvasNode } from './layout.js';
import {
  minimumNodeExtent,
  resizeBoxByKey,
  resizeBoxOnControlAxes,
  resizeControlPositions,
  resizeControlsOf,
  scaledCurvePoints,
  type ResizeControlPosition,
} from './resizing.js';
import { boundaryStrokeWidth } from './stylesheet.js';

const box = {
  position: { x: 100, y: 200 },
  size: { width: 120, height: 60 },
};

const cases = [
  [
    'top',
    'ArrowUp',
    { position: { x: 100, y: 195 }, size: { width: 120, height: 65 } },
  ],
  [
    'right',
    'ArrowRight',
    { position: { x: 100, y: 200 }, size: { width: 125, height: 60 } },
  ],
  [
    'bottom',
    'ArrowDown',
    { position: { x: 100, y: 200 }, size: { width: 120, height: 65 } },
  ],
  [
    'left',
    'ArrowLeft',
    { position: { x: 95, y: 200 }, size: { width: 125, height: 60 } },
  ],
] as const satisfies readonly (readonly [
  ResizeControlPosition,
  string,
  typeof box,
])[];

describe('resizeBoxByKey', () => {
  it.each(cases)(
    'resizes from the %s with the opposite side fixed',
    (_, key, expected) => {
      expect(resizeBoxByKey(box, _, key)).toEqual(expected);
    },
  );

  it('lets a corner resize both axes', () => {
    const widened = resizeBoxByKey(box, 'top-left', 'ArrowLeft');
    expect(widened).toEqual({
      position: { x: 95, y: 200 },
      size: { width: 125, height: 60 },
    });
    expect(widened && resizeBoxByKey(widened, 'top-left', 'ArrowUp')).toEqual({
      position: { x: 95, y: 195 },
      size: { width: 125, height: 65 },
    });
  });

  it('clamps every side at the minimum extent', () => {
    const small = {
      position: box.position,
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent + 2 },
    };
    expect(resizeBoxByKey(small, 'left', 'ArrowRight', 20)).toEqual({
      position: { x: 102, y: 200 },
      size: { width: minimumNodeExtent, height: minimumNodeExtent + 2 },
    });
    expect(resizeBoxByKey(small, 'right', 'ArrowLeft', 20)).toEqual({
      position: box.position,
      size: { width: minimumNodeExtent, height: minimumNodeExtent + 2 },
    });
    expect(resizeBoxByKey(small, 'top', 'ArrowDown', 20)).toEqual({
      position: { x: 100, y: 202 },
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent },
    });
    expect(resizeBoxByKey(small, 'bottom', 'ArrowUp', 20)).toEqual({
      position: box.position,
      size: { width: minimumNodeExtent + 2, height: minimumNodeExtent },
    });
  });

  it('ignores a key outside the control axis', () => {
    expect(resizeBoxByKey(box, 'top', 'ArrowLeft')).toBeUndefined();
    expect(resizeBoxByKey(box, 'left', 'Enter')).toBeUndefined();
  });
});

describe('resizeBoxOnControlAxes', () => {
  const measured = {
    position: { x: 90, y: 190 },
    size: { width: 140, height: 80 },
  };

  it('keeps the vertical values of a horizontal side resize', () => {
    expect(resizeBoxOnControlAxes(box, 'left', measured)).toEqual({
      position: { x: 90, y: 200 },
      size: { width: 140, height: 60 },
    });
  });

  it('keeps the horizontal values of a vertical side resize', () => {
    expect(resizeBoxOnControlAxes(box, 'top', measured)).toEqual({
      position: { x: 100, y: 190 },
      size: { width: 120, height: 80 },
    });
  });

  it('keeps both axes of a corner resize', () => {
    expect(resizeBoxOnControlAxes(box, 'top-left', measured)).toBe(measured);
  });
});

const curve = [
  { x: 100, y: 200 },
  { x: 160, y: 140 },
  { x: 220, y: 200 },
] as const;

const stroke = boundaryStrokeWidth;

const curveNode = (waypoints: readonly Point[]): CanvasNode => {
  const node = canvasNodeOf({
    kind: 'trust-boundary',
    id: elementId('boundary-curve'),
    name: 'Curve',
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    shape: { kind: 'curve', waypoints: [...waypoints] },
  });
  assert.isDefined(node);
  return node;
};

const curveBox: NodeBox = curveNode(curve);

const grownFrom = (control: ResizeControlPosition): NodeBox => {
  const left = control.includes('left') ? 40 : 0;
  const right = control.includes('right') ? 40 : 0;
  const top = control.includes('top') ? 30 : 0;
  const bottom = control.includes('bottom') ? 30 : 0;
  return {
    position: {
      x: curveBox.position.x - left,
      y: curveBox.position.y - top,
    },
    size: {
      width: curveBox.size.width + left + right,
      height: curveBox.size.height + top + bottom,
    },
  };
};

const across = {
  kept: [100, 160, 220],
  fromLeft: [60, 140, 220],
  fromRight: [100, 180, 260],
} as const;

const down = {
  kept: [200, 140, 200],
  fromTop: [200, 110, 200],
  fromBottom: [230, 140, 230],
} as const;

const scaleCases = [
  ['top', across.kept, down.fromTop],
  ['right', across.fromRight, down.kept],
  ['bottom', across.kept, down.fromBottom],
  ['left', across.fromLeft, down.kept],
  ['top-left', across.fromLeft, down.fromTop],
  ['top-right', across.fromRight, down.fromTop],
  ['bottom-right', across.fromRight, down.fromBottom],
  ['bottom-left', across.fromLeft, down.fromBottom],
] as const satisfies readonly (readonly [
  ResizeControlPosition,
  readonly number[],
  readonly number[],
])[];

describe('scaledCurvePoints', () => {
  it.each(scaleCases)(
    'scales every point against the side opposite the %s control',
    (control, xs, ys) => {
      expect(scaledCurvePoints(curve, grownFrom(control))).toEqual(
        xs.map((x, index) => ({ x, y: ys[index] })),
      );
    },
  );

  it('lays the scaled curve out in the box it was scaled to', () => {
    const target = grownFrom('bottom-right');
    const { position, size } = curveNode(scaledCurvePoints(curve, target));
    expect({ position, size }).toEqual(target);
  });

  it('collapses an axis to the minimum extent and no further', () => {
    const scaled = scaledCurvePoints(curve, {
      position: curveBox.position,
      size: { width: 1, height: curveBox.size.height },
    });
    expect(boundsOfPoints(scaled)).toEqual({
      x: 100,
      y: 140,
      width: minimumNodeExtent - stroke * 2,
      height: 60,
    });
  });

  it('leaves an axis already under the minimum extent where it is when asked to shrink', () => {
    const shallow = [
      { x: 0, y: 10 },
      { x: 50, y: 11 },
    ];
    expect(
      scaledCurvePoints(shallow, {
        position: { x: -stroke, y: 10 - stroke },
        size: { width: 90, height: 2 },
      }),
    ).toEqual([
      { x: 0, y: 10 },
      { x: 86, y: 11 },
    ]);
  });

  it('moves an axis the points do not span without scaling it', () => {
    const level = [
      { x: 0, y: 10 },
      { x: 50, y: 10 },
    ];
    expect(
      scaledCurvePoints(level, {
        position: { x: 20 - stroke, y: 40 - stroke },
        size: { width: 50 + stroke * 2, height: 80 },
      }),
    ).toEqual([
      { x: 20, y: 40 },
      { x: 70, y: 40 },
    ]);
  });

  it('keeps the exact coordinates of the side the box keeps, whatever the scale', () => {
    const arch = [
      { x: 0, y: 300 },
      { x: 200, y: 340 },
      { x: 400, y: 300 },
    ];
    const settled = curveNode(arch);
    const fromLeft = scaledCurvePoints(arch, {
      position: { x: settled.position.x - 111, y: settled.position.y },
      size: { width: settled.size.width + 111, height: settled.size.height },
    });
    expect(fromLeft.at(-1)?.x).toBe(400);
    const uneven = [
      { x: 0.1, y: 0.3 },
      { x: 50.7, y: 20.9 },
    ];
    const fractional = curveNode(uneven);
    const fromRight = scaledCurvePoints(uneven, {
      position: fractional.position,
      size: {
        width: fractional.size.width + 37,
        height: fractional.size.height,
      },
    });
    expect(fromRight.at(0)?.x).toBe(0.1);
  });

  it('keeps the exact coordinates of an axis the box leaves as it is', () => {
    const uneven = [
      { x: 0.1, y: 0.3 },
      { x: 50.7, y: 20.9 },
    ];
    const settled = curveNode(uneven);
    const scaled = scaledCurvePoints(uneven, {
      position: settled.position,
      size: { width: 200, height: settled.size.height },
    });
    expect(scaled.map((point) => point.y)).toEqual([0.3, 20.9]);
  });
});

describe('resizeControlsOf', () => {
  it('offers a boundary curve every control', () => {
    expect(resizeControlsOf(curveNode(curve))).toEqual(resizeControlPositions);
  });

  it('offers a curve along one line only the side controls that lengthen it', () => {
    expect(
      resizeControlsOf(
        curveNode([
          { x: 0, y: 10 },
          { x: 50, y: 10 },
        ]),
      ),
    ).toEqual(['right', 'left']);
    expect(
      resizeControlsOf(
        curveNode([
          { x: 10, y: 0 },
          { x: 10, y: 50 },
        ]),
      ),
    ).toEqual(['top', 'bottom']);
  });
});
