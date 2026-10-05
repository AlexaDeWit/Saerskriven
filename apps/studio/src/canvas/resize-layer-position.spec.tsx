import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useResizeLayerPosition } from './resize-layer-position.js';

type Position = Parameters<typeof useResizeLayerPosition>[1];

const original: Position = {
  positionAbsoluteX: -15.375,
  positionAbsoluteY: 42.125,
  zIndex: 1,
};

const moved: Position = {
  positionAbsoluteX: 73.625,
  positionAbsoluteY: -19.875,
  zIndex: -1,
};

function Probe({ position }: { readonly position: Position }) {
  const drawing = useRef<SVGSVGElement>(null);
  useResizeLayerPosition(drawing, position);
  return (
    <div data-testid="frame" tabIndex={-1}>
      <svg aria-hidden="true" ref={drawing} />
      <div className="react-flow__resize-control">
        <button type="button">Resize</button>
      </div>
      <button type="button">Other</button>
    </div>
  );
}

describe('resize layer positions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves an unfocused node without writing inherited offsets', () => {
    const { rerender } = render(<Probe position={original} />);
    const frame = screen.getByTestId('frame');
    const writes = vi.spyOn(frame.style, 'setProperty');
    act(() => {
      frame.focus();
    });
    rerender(<Probe position={moved} />);
    expect(writes).not.toHaveBeenCalled();
  });

  it('uses the latest position on focus and follows movement until blur', () => {
    const { rerender } = render(<Probe position={original} />);
    const frame = screen.getByTestId('frame');
    rerender(<Probe position={moved} />);
    act(() => {
      screen.getByRole('button', { name: 'Resize' }).focus();
    });
    expect(frame.style.getPropertyValue('--saer-node-x')).toBe('73.625px');
    expect(frame.style.getPropertyValue('--saer-node-y')).toBe('-19.875px');
    expect(frame.style.getPropertyValue('--saer-node-z')).toBe('-1');
    rerender(<Probe position={original} />);
    expect(frame.style.getPropertyValue('--saer-node-x')).toBe('-15.375px');
    expect(frame.style.getPropertyValue('--saer-node-y')).toBe('42.125px');
    expect(frame.style.getPropertyValue('--saer-node-z')).toBe('1');
    act(() => {
      screen.getByRole('button', { name: 'Other' }).focus();
    });
    expect(frame.style.getPropertyValue('--saer-node-x')).toBe('');
    expect(frame.style.getPropertyValue('--saer-node-y')).toBe('');
    expect(frame.style.getPropertyValue('--saer-node-z')).toBe('');
    const writes = vi.spyOn(frame.style, 'setProperty');
    rerender(<Probe position={moved} />);
    expect(writes).not.toHaveBeenCalled();
  });

  it('clears offsets when the focused node unmounts', () => {
    const { unmount } = render(<Probe position={original} />);
    const frame = screen.getByTestId('frame');
    act(() => {
      screen.getByRole('button', { name: 'Resize' }).focus();
    });
    unmount();
    expect(frame.style.getPropertyValue('--saer-node-x')).toBe('');
    expect(frame.style.getPropertyValue('--saer-node-y')).toBe('');
    expect(frame.style.getPropertyValue('--saer-node-z')).toBe('');
  });
});
