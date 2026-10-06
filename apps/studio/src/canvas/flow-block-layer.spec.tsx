import { canvasInteractionClassNames } from '@saerskriven/canvas';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import {
  FlowBlockSurface,
  FlowBlockTarget,
  useFlowBlockPortal,
} from './flow-block-layer.js';

const clicked = vi.fn<() => void>();
const focused = vi.fn<() => void>();

function Block({ id }: { readonly id: string }) {
  const portal = useFlowBlockPortal();
  return portal?.(
    <text data-testid={id} tabIndex={-1}>
      {id}
    </text>,
  );
}

function Probe() {
  const [target, setTarget] = useState<SVGSVGElement | null>(null);
  return (
    <ReactFlowProvider>
      <FlowBlockTarget value={target}>
        <ReactFlow nodes={[]} edges={[]}>
          <FlowBlockSurface onReady={setTarget} />
        </ReactFlow>
        <svg>
          <g onClick={clicked} onFocus={focused}>
            <Block id="first" />
            <Block id="second" />
          </g>
        </svg>
      </FlowBlockTarget>
    </ReactFlowProvider>
  );
}

describe('the shared flow block surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('draws every block in one viewport SVG', () => {
    render(<Probe />);
    const surfaces = document.querySelectorAll(
      `.${canvasInteractionClassNames.flowBlockSurface}`,
    );
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]?.contains(screen.getByTestId('first'))).toBe(true);
    expect(surfaces[0]?.contains(screen.getByTestId('second'))).toBe(true);
  });

  it('keeps click and focus events with the original React owner', () => {
    render(<Probe />);
    const block = screen.getByTestId('first');
    fireEvent.click(block);
    expect(clicked).toHaveBeenCalledOnce();
    act(() => {
      block.focus();
    });
    expect(focused).toHaveBeenCalledOnce();
  });
});
