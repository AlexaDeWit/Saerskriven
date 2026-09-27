import { placementClickDistance } from './elements.js';
import { doublePressInterval, secondPressOf } from './pane-shield.js';

const first = { timeStamp: 1000, clientX: 40, clientY: 40 };

describe('secondPressOf', () => {
  it('counts a press soon after the first and on the same spot', () => {
    expect(secondPressOf(first, { ...first, timeStamp: 1200 })).toBe(true);
  });

  it('leaves out a press after the double-click interval or moved as far as a drag', () => {
    expect(
      secondPressOf(first, {
        ...first,
        timeStamp: first.timeStamp + doublePressInterval,
      }),
    ).toBe(false);
    expect(
      secondPressOf(first, {
        ...first,
        clientX: first.clientX + placementClickDistance,
      }),
    ).toBe(false);
  });
});
