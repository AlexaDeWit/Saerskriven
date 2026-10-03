import { ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { nodeNamed, specResizeLabels } from './canvas.fixtures.js';
import type { NodeBox } from './handles.js';
import type { CanvasNodeData } from './react-flow.js';
import { ResizeControls } from './resize-controls.js';
import { keyboardResizeStep } from './resizing.js';

type ControlledNode = Node<CanvasNodeData, 'controlled'>;

const client = nodeNamed('el-client');

const resize = vi.fn<() => void>();

const resizeEnd = vi.fn<(box: NodeBox, fromResizingRender: boolean) => void>();

function Controlled({ data }: NodeProps<ControlledNode>): ReactElement {
  const [resizing, setResizing] = useState(false);
  return (
    <ResizeControls
      labels={specResizeLabels(data.node)}
      node={data.node}
      onResize={() => {
        setResizing(true);
        resize();
      }}
      onResizeEnd={(box) => {
        setResizing(false);
        resizeEnd(box, resizing);
      }}
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

const touch = (type: string, clientX?: number): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const finger = { identifier: 1, clientX: clientX ?? 0, clientY: 100 };
  Object.defineProperties(event, {
    changedTouches: { value: [finger] },
    touches: { value: clientX === undefined ? [] : [finger] },
  });
  return event;
};

const keyDown = (key: string): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

const rightControl = (): HTMLButtonElement => {
  const control = [...document.querySelectorAll('button')].find(
    (button) =>
      button.getAttribute('aria-label') === specResizeLabels(client).right,
  );
  assert.isDefined(control);
  return control;
};

const pressRightControl = (movedBy: number): void => {
  const control = rightControl();
  act(() => {
    control.dispatchEvent(mouse('mousedown', 100));
    if (movedBy !== 0) {
      control.dispatchEvent(mouse('mousemove', 100 + movedBy));
    }
    control.dispatchEvent(mouse('mouseup', 100 + movedBy));
  });
};

const touchRightControl = (moves: readonly number[]): void => {
  act(() => {
    rightControl().dispatchEvent(touch('touchstart', 100));
  });
  for (const movedBy of moves) {
    act(() => {
      rightControl().dispatchEvent(touch('touchmove', 100 + movedBy));
    });
  }
  act(() => {
    rightControl().dispatchEvent(touch('touchend'));
  });
};

describe('ResizeControls', () => {
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

  it('hands a touch resize one end through a render that gives it new callbacks, and none to the still touch after it', () => {
    touchRightControl([20, 40]);

    expect(resize).toHaveBeenCalledTimes(2);
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    touchRightControl([]);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });

  it('ends a resize on the callbacks of the render its press began on', () => {
    touchRightControl([20]);

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(expect.anything(), false);
  });

  it('hands one resize end to an arrow key on the axis of its control, and none to a key off it', () => {
    act(() => {
      rightControl().dispatchEvent(keyDown('ArrowUp'));
      rightControl().dispatchEvent(keyDown('ArrowRight'));
    });

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      {
        position: client.position,
        size: { ...client.size, width: client.size.width + keyboardResizeStep },
      },
      false,
    );
  });
});
