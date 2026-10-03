import { act, render, screen, within } from '@testing-library/react';
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

  it('draws an announcement as a line of the status region', () => {
    act(() => {
      announce(said);
    });

    expect(drawnLine()?.textContent).toBe(said());
  });

  it('holds an undrawn announcement as the text of the region, with no line', () => {
    act(() => {
      announceUndrawn(said);
    });

    expect(region().textContent).toBe(said());
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
