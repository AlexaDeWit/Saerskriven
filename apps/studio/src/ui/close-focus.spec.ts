import { renderHook } from '@testing-library/react';
import { useCloseFocus } from './close-focus.js';

const placed = (): boolean => true;

const closing = (): Event => new Event('close', { cancelable: true });

const focusedField = (): HTMLInputElement => {
  const field = document.createElement('input');
  document.body.append(field);
  field.focus();
  return field;
};

afterEach(() => {
  for (const field of document.querySelectorAll('input')) {
    field.remove();
  }
});

describe('useCloseFocus', () => {
  it('cancels the return once focus has moved on, and not while the body holds it', () => {
    const { result } = renderHook(() => useCloseFocus());
    const idle = closing();
    result.current.onCloseAutoFocus(idle);
    focusedField();
    const moved = closing();
    result.current.onCloseAutoFocus(moved);

    expect(idle.defaultPrevented).toBe(false);
    expect(moved.defaultPrevented).toBe(true);
  });

  it('leaves the close after an outside interaction to Radix, for that close alone', () => {
    const { result } = renderHook(() => useCloseFocus());
    focusedField();
    result.current.onInteractOutside();
    const outside = closing();
    result.current.onCloseAutoFocus(outside);
    const next = closing();
    result.current.onCloseAutoFocus(next);

    expect(outside.defaultPrevented).toBe(false);
    expect(next.defaultPrevented).toBe(true);
  });

  it('cancels the return where the fallback places focus', () => {
    const { result } = renderHook(() => useCloseFocus(placed));
    const event = closing();
    result.current.onCloseAutoFocus(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
