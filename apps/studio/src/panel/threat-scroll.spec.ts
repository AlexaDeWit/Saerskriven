import { fieldScroll, keptScroll } from './threat-scroll.js';

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

describe('fieldScroll', () => {
  const room = { scrolled: 1000, top: 60, bottom: 500 } as const;

  it('leaves the body where it is while the field and the next one are in view', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 200, fieldBottom: 240, next: 300 }),
    ).toBe(1000);
  });

  it('brings a field under the pinned summary down to just below it', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 30, fieldBottom: 70, next: 120 }),
    ).toBe(970);
  });

  it('scrolls a field near the bottom up until the next field shows under it', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 420, fieldBottom: 460, next: 540 }),
    ).toBe(1040);
  });

  it('stops with the field just below the summary where the next field cannot fit too', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 300, fieldBottom: 340, next: 1300 }),
    ).toBe(1240);
  });

  it('shows the field whole where nothing follows it', () => {
    expect(
      fieldScroll({
        ...room,
        fieldTop: 470,
        fieldBottom: 520,
        next: undefined,
      }),
    ).toBe(1020);
  });
});
