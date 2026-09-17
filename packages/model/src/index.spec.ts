import * as model from './index.js';

describe('the package barrel', () => {
  it('keeps the structural model schema internal', () => {
    expect('modelSchema' in model).toBe(false);
  });
});
