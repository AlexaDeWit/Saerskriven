import {
  act,
  isInaccessible,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  announce,
  announceUndrawn,
  resetAnnouncements,
} from './announcements.js';
import { CanvasAnnouncement } from './canvas-announcement.js';

const said = () => 'An edit completed.';

const region = (): HTMLElement => screen.getByRole('status');

const drawnLine = (): HTMLElement | null =>
  within(region()).queryByRole('paragraph');

describe('CanvasAnnouncement', () => {
  beforeEach(() => {
    resetAnnouncements();
    render(<CanvasAnnouncement />);
  });

  it('announces activity without drawing a status line', () => {
    act(() => {
      announce(said);
    });

    expect(region().textContent).toBe(said());
    expect(isInaccessible(within(region()).getByText(said()))).toBe(false);
    expect(drawnLine()).toBeNull();
  });

  it('holds an undrawn announcement as text a screen reader is given, with no line', () => {
    act(() => {
      announceUndrawn(said);
    });

    expect(region().textContent).toBe(said());
    expect(isInaccessible(within(region()).getByText(said()))).toBe(false);
    expect(drawnLine()).toBeNull();
  });

  it('puts an undrawn announcement in place of a drawn line', () => {
    act(() => {
      announce(() => 'An earlier edit.');
    });
    act(() => {
      announceUndrawn(said);
    });

    expect(region().textContent).toBe(said());
    expect(drawnLine()).toBeNull();
  });

  it('replaces the text node of an undrawn announcement said again in the same words', () => {
    act(() => {
      announceUndrawn(said);
    });
    const first = region().firstChild;
    act(() => {
      announceUndrawn(said);
    });

    expect(region().firstChild).not.toBe(first);
    expect(region().textContent).toBe(said());
  });
});
