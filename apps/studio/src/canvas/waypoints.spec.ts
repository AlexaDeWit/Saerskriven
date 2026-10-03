import { editedWaypoints } from './waypoints.js';

const run = [
  { x: 0, y: 0 },
  { x: 100, y: 40 },
  { x: 200, y: 0 },
];

const point = { x: 50, y: 60 };

describe('editedWaypoints', () => {
  it('inserts a point before the one at its index, keeping every other point', () => {
    expect(editedWaypoints(run, { kind: 'insert', index: 1, point })).toEqual([
      run[0],
      point,
      run[1],
      run[2],
    ]);
  });

  it('inserts at either end of the run', () => {
    expect(editedWaypoints(run, { kind: 'insert', index: 0, point })).toEqual([
      point,
      ...run,
    ]);
    expect(
      editedWaypoints(run, { kind: 'insert', index: run.length, point }),
    ).toEqual([...run, point]);
  });

  it('moves the point at its index, keeping the length', () => {
    expect(editedWaypoints(run, { kind: 'move', index: 1, point })).toEqual([
      run[0],
      point,
      run[2],
    ]);
  });
});
