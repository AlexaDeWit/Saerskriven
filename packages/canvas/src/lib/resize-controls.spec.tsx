import { ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { nodeNamed, specResizeLabels } from './canvas.fixtures.js';
import type { NodeBox } from './handles.js';
import type { CanvasNodeData } from './react-flow.js';
import { ResizeControls } from './resize-controls.js';

type ControlledNode = Node<CanvasNodeData, 'controlled'>;

const client = nodeNamed('el-client');

const resize = vi.fn<() => void>();

const resizeEnd = vi.fn<(box: NodeBox) => void>();

function Controlled({ data }: NodeProps<ControlledNode>): ReactElement {
  return (
    <ResizeControls
      labels={specResizeLabels(data.node)}
      node={data.node}
      onResize={resize}
      onResizeEnd={resizeEnd}
      visible
    />
  );
}

const nodeTypes = { controlled: Controlled };

const nodes: ControlledNode[] = [
  {
    id: client.id,
    type: 'controlled',
    position: client.position,
    data: { node: client },
  },
];

const mouse = (type: string, clientX: number): MouseEvent => {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY: 100 });
  Object.defineProperty(event, 'view', { value: window });
  return event;
};

const pressRightControl = (movedBy: number): void => {
  const control = [...document.querySelectorAll('button')].find(
    (button) =>
      button.getAttribute('aria-label') === specResizeLabels(client).right,
  );
  assert.isDefined(control);
  act(() => {
    control.dispatchEvent(mouse('mousedown', 100));
    if (movedBy !== 0) {
      control.dispatchEvent(mouse('mousemove', 100 + movedBy));
    }
    control.dispatchEvent(mouse('mouseup', 100 + movedBy));
  });
};

describe('ResizeControls', () => {
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => {
      root.render(<ReactFlow nodes={nodes} nodeTypes={nodeTypes} />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('hands no resize end to a press released without a resize', () => {
    pressRightControl(0);

    expect(resizeEnd).not.toHaveBeenCalled();
  });

  it('hands one resize end to a press that resized, and none to the still press after it', () => {
    pressRightControl(40);

    expect(resize).toHaveBeenCalled();
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    pressRightControl(0);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });
});
