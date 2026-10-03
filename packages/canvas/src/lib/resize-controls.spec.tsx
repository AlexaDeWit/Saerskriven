import {
  ReactFlow,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { finger, mouseEvent, touchEvent, type Finger } from '../fixtures.js';
import { nodeNamed, specResizeLabels } from './canvas.fixtures.js';
import type { NodeBox } from './handles.js';
import type { CanvasNodeData } from './react-flow.js';
import { ResizeControls } from './resize-controls.js';
import { keyboardResizeStep, type ResizeControlPosition } from './resizing.js';

type HostNode = Node<CanvasNodeData, 'host'>;

const client = nodeNamed('el-client');

const pressed: NodeBox = { position: client.position, size: client.size };

const drift = 50;

const resize = vi.fn<(fromResizingRender: boolean) => void>();

const resizeEnd = vi.fn<(box: NodeBox, fromResizingRender: boolean) => void>();

const nodesChange = vi.fn<(changes: NodeChange<HostNode>[]) => void>();

function Host({ data }: NodeProps<HostNode>): ReactElement {
  const [node, setNode] = useState(data.node);
  const [resizing, setResizing] = useState(false);
  return (
    <ResizeControls
      labels={specResizeLabels(data.node)}
      node={
        resizing
          ? {
              ...node,
              position: { x: node.position.x, y: node.position.y + drift },
            }
          : node
      }
      onResize={() => {
        setResizing(true);
        resize(resizing);
      }}
      onResizeEnd={(box) => {
        setResizing(false);
        setNode({ ...node, ...box });
        resizeEnd(box, resizing);
      }}
      visible
    />
  );
}

const nodeTypes = { host: Host };

const nodes: HostNode[] = [
  {
    id: client.id,
    type: 'host',
    position: client.position,
    data: { node: client },
  },
];

const keyDown = (key: string): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

const control = (position: ResizeControlPosition): HTMLButtonElement => {
  const found = [...document.querySelectorAll('button')].find(
    (button) =>
      button.getAttribute('aria-label') === specResizeLabels(client)[position],
  );
  assert.isDefined(found);
  return found;
};

const mouse = (
  target: EventTarget,
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
): void => {
  act(() => {
    target.dispatchEvent(mouseEvent(type, clientX));
  });
};

const touch = (
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  changed: Finger,
  touches?: readonly Finger[],
): void => {
  act(() => {
    target.dispatchEvent(touchEvent(type, changed, touches));
  });
};

const touchResize = (
  position: ResizeControlPosition,
  moves: readonly number[],
): void => {
  touch(control(position), 'touchstart', finger(1, 100));
  for (const movedBy of moves) {
    touch(control(position), 'touchmove', finger(1, 100 + movedBy));
  }
  touch(control(position), 'touchend', finger(1, 100 + (moves.at(-1) ?? 0)));
};

const endedBoxes = (): NodeBox[] => resizeEnd.mock.calls.map(([box]) => box);

describe('ResizeControls', () => {
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => {
      root.render(
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={nodesChange}
        />,
      );
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
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mouseup', 100);

    expect(resizeEnd).not.toHaveBeenCalled();
  });

  it('hands one resize end to a press that resized, and none to the still press after it', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    mouse(control('right'), 'mouseup', 140);

    expect(resize).toHaveBeenCalled();
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mouseup', 100);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });

  it('hands a touch resize one end through a render that gives it new callbacks, and none to the still touch after it', () => {
    touchResize('right', [20, 40]);

    expect(resize).toHaveBeenCalledTimes(2);
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    touchResize('right', []);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });

  it('calls the onResize and the onResizeEnd of the render its press began on', () => {
    touchResize('right', [20, 40]);

    expect(resize.mock.calls).toEqual([[false], [false]]);
    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(expect.anything(), false);
  });

  it('settles a resize against the node of the render its press began on', () => {
    touchResize('right', [20]);

    expect(
      endedBoxes().map((box) => [box.position.y, box.size.height]),
    ).toEqual([[client.position.y, client.size.height]]);
  });

  it('hands a touch resize one end, once its last finger lifts, when a second finger on its control lifts first', () => {
    const second = finger(2, 100);
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', finger(1, 120));
    touch(control('right'), 'touchstart', second, [finger(1, 120), second]);
    touch(control('right'), 'touchend', second, [finger(1, 120)]);

    expect(resizeEnd).not.toHaveBeenCalled();

    touch(control('right'), 'touchmove', finger(1, 160));
    touch(control('right'), 'touchend', finger(1, 160));

    expect(resize).toHaveBeenCalledTimes(2);
    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(endedBoxes()).not.toContainEqual(pressed);
  });

  it('resizes nothing from a press on another control while one holds the press', () => {
    const held = finger(1, 140);
    const other = { identifier: 2, clientX: 100, clientY: 100 };
    const moved = { ...other, clientY: 160 };
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', held);
    touch(control('bottom'), 'touchstart', other, [held, other]);
    touch(control('right'), 'touchend', held, [other]);
    const reported = nodesChange.mock.calls.length;

    touch(control('bottom'), 'touchmove', moved);
    touch(control('bottom'), 'touchend', moved);

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(nodesChange).toHaveBeenCalledTimes(reported);
  });

  it('resizes nothing from a press that reaches another control beside its button', () => {
    const held = finger(1, 140);
    const other = { identifier: 2, clientX: 100, clientY: 100 };
    const moved = { ...other, clientY: 160 };
    const beside = control('bottom').parentElement;
    assert.isNotNull(beside);
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', held);
    touch(beside, 'touchstart', other, [held, other]);
    touch(control('right'), 'touchend', held, [other]);
    touch(beside, 'touchmove', moved);
    touch(beside, 'touchend', moved);

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(
      nodesChange.mock.calls
        .flat(2)
        .filter(
          (change) => change.type === 'dimensions' && change.resizing === true,
        ),
    ).toHaveLength(1);
  });

  it('lets another control resize once the press is over', () => {
    touchResize('right', [40]);
    touchResize('left', [-40]);

    expect(resizeEnd).toHaveBeenCalledTimes(2);
  });

  it('puts a resize back when its touch is cancelled', () => {
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', finger(1, 140));
    touch(control('right'), 'touchcancel', finger(1, 140));

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(pressed, false);
  });

  it('puts a resize back once its last finger lifts when another finger of its press was cancelled', () => {
    const second = finger(2, 100);
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', finger(1, 120));
    touch(control('right'), 'touchstart', second, [finger(1, 120), second]);
    touch(control('right'), 'touchcancel', second, [finger(1, 120)]);

    expect(resizeEnd).not.toHaveBeenCalled();

    touch(control('right'), 'touchmove', finger(1, 160));
    touch(control('right'), 'touchend', finger(1, 160));

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(pressed, false);
  });

  it('puts back a resize whose release never came when its pointer presses the control again, and hands that press no end', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mouseup', 100);

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(pressed, false);
  });

  it('puts back a resize whose release never came when its pointer presses another control, which then resizes', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    mouse(control('left'), 'mousedown', 100);

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(pressed, false);

    mouse(control('left'), 'mousemove', 60);
    mouse(control('left'), 'mouseup', 60);

    expect(resizeEnd).toHaveBeenCalledTimes(2);
    expect(endedBoxes().at(-1)).not.toEqual(pressed);
  });

  it('puts a touch resize back when its controls unmount under it', () => {
    touch(control('right'), 'touchstart', finger(1, 100));
    touch(control('right'), 'touchmove', finger(1, 140));
    act(() => {
      root.unmount();
    });

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(pressed, false);
  });

  it('ends a mouse resize on its release, with the box it finished on, after its controls unmount', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(window, 'mousemove', 140);
    act(() => {
      root.unmount();
    });

    expect(resizeEnd).not.toHaveBeenCalled();

    mouse(window, 'mouseup', 140);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(endedBoxes()).not.toContainEqual(pressed);
  });

  it('hands one resize end to an arrow key on the axis of its control, and none to a key off it', () => {
    act(() => {
      control('right').dispatchEvent(keyDown('ArrowUp'));
      control('right').dispatchEvent(keyDown('ArrowRight'));
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
