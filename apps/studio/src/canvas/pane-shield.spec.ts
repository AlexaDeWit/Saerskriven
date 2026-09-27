import { placementClickDistance } from './elements.js';
import { doublePressInterval, secondPressOf } from './pane-shield.js';

const first = { timeStamp: 1000, x: 40, y: 40 };
const second = { timeStamp: 1200, clientX: 40, clientY: 40 };

describe('secondPressOf', () => {
  it('counts a press soon after the first and on the same spot', () => {
    expect(secondPressOf(first, second)).toBe(true);
  });

  it('leaves out a press after the double-click interval or moved as far as a drag', () => {
    expect(
      secondPressOf(first, {
        ...second,
        timeStamp: first.timeStamp + doublePressInterval,
      }),
    ).toBe(false);
    expect(
      secondPressOf(first, {
        ...second,
        clientX: first.x + placementClickDistance,
      }),
    ).toBe(false);
  });
});
