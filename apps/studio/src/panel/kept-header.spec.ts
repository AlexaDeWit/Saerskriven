import { keptScroll } from './kept-header.js';

describe('keptScroll', () => {
  const viewport = 400;

  it('puts the header back where it was when it fits there', () => {
    expect(keptScroll({ offset: 600, height: 80, was: 150, viewport })).toBe(
      450,
    );
  });

  it('shows the top of a header that was partly above the viewport', () => {
    expect(keptScroll({ offset: 600, height: 80, was: -12, viewport })).toBe(
      600,
    );
  });

  it('shows the bottom of a header that was partly below the viewport', () => {
    expect(keptScroll({ offset: 600, height: 80, was: 332, viewport })).toBe(
      280,
    );
  });

  it('shows the top of a header taller than the viewport', () => {
    expect(keptScroll({ offset: 600, height: 500, was: 20, viewport })).toBe(
      600,
    );
  });
});
