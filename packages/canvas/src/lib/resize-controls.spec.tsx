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
import type { CanvasNode } from './layout.js';
import type { CanvasNodeData } from './react-flow.js';
import { ResizeControls } from './resize-controls.js';
import {
  keyboardResizeStep,
  minimumNodeExtent,
  type GestureInput,
  type ResizeControlPosition,
} from './resizing.js';

type HostNode = Node<CanvasNodeData, 'host'>;

const client = nodeNamed('el-client');

const store = nodeNamed('el-db');

const narrowest: CanvasNode = {
  ...store,
  size: { ...store.size, width: minimumNodeExtent },
};

const small: CanvasNode = {
  ...nodeNamed('el-api'),
  size: { width: 4, height: 4 },
};

const roundedUp: CanvasNode = {
  ...nodeNamed('el-note'),
  size: { width: 4.6, height: 4.6 },
};

const roundedDown: CanvasNode = {
  ...nodeNamed('el-scope-note'),
  size: { width: 4.4, height: 4.4 },
};

const tiny: CanvasNode = {
  ...nodeNamed('el-zone'),
  size: { width: 0.4, height: 0.4 },
};

const smallNodes = [small, roundedUp, roundedDown, tiny];

const smallControls = smallNodes.flatMap((node) =>
  (['right', 'left'] as const).map((position) => ({ node, position })),
);

const pressed: NodeBox = { position: client.position, size: client.size };

const drift = 50;

const resize = vi.fn<(fromResizingRender: boolean) => void>();

const resizeEnd = vi.fn<(box: NodeBox, fromResizingRender: boolean) => void>();

const endedBy = vi.fn<(input: GestureInput) => void>();

const nodesChange = vi.fn<(changes: NodeChange<HostNode>[]) => void>();

const canvasKeyDown = vi.fn<() => void>();

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
      onResizeEnd={(box, input) => {
        setResizing(false);
        setNode({ ...node, ...box });
        resizeEnd(box, resizing);
        endedBy(input);
      }}
      visible
    />
  );
}

const nodeTypes = { host: Host };

const nodes = [client, narrowest, ...smallNodes].map((node): HostNode => ({
  id: node.id,
  type: 'host',
  position: node.position,
  selected: true,
  data: { node },
  ...(smallNodes.includes(node)
    ? {
        measured: {
          width: Math.round(node.size.width),
          height: Math.round(node.size.height),
        },
      }
    : {}),
}));

const keyDown = (key: string, shiftKey = false): KeyboardEvent =>
  new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });

const control = (
  position: ResizeControlPosition,
  of = client,
): HTMLButtonElement => {
  const found = [...document.querySelectorAll('button')].find(
    (button) =>
      button.getAttribute('aria-label') === specResizeLabels(of)[position],
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
          onKeyDown={canvasKeyDown}
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

  it.each(smallControls)(
    'leaves width $node.size.width unchanged when dragged inward from the $position',
    ({ node, position }) => {
      const end = position === 'right' ? 60 : 140;
      mouse(control(position, node), 'mousedown', 100);
      mouse(window, 'mousemove', end);
      mouse(window, 'mouseup', end);

      expect(resize).not.toHaveBeenCalled();
      expect(resizeEnd).not.toHaveBeenCalled();
    },
  );

  it.each(smallControls)(
    'grows width $node.size.width from its model size when dragged from the $position',
    ({ node, position }) => {
      const end = position === 'right' ? 140 : 60;
      mouse(control(position, node), 'mousedown', 100);
      mouse(window, 'mousemove', end);
      mouse(window, 'mouseup', end);

      expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
        {
          position: {
            x: node.position.x + (position === 'left' ? -40 : 0),
            y: node.position.y,
          },
          size: { width: node.size.width + 40, height: node.size.height },
        },
        false,
      );
    },
  );

  it.each([false, true])(
    'adds the key step to an extent below ten with Shift %s',
    (shiftKey) => {
      act(() => {
        control('right', small).dispatchEvent(keyDown('ArrowRight', shiftKey));
      });

      expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
        {
          position: small.position,
          size: { width: shiftKey ? 24 : 9, height: 4 },
        },
        false,
      );
    },
  );

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

  it.each([
    ['its button', (found: HTMLButtonElement): Element => found],
    [
      'its edge beside the button',
      (found: HTMLButtonElement): Element | null => found.parentElement,
    ],
  ])(
    'starts nothing from a press on another control, on %s, while one holds the press',
    (_, pressedOn) => {
      const held = finger(1, 140);
      const other = { identifier: 2, clientX: 100, clientY: 100 };
      const moved = { ...other, clientY: 160 };
      const second = pressedOn(control('bottom'));
      assert.isNotNull(second);
      touch(control('right'), 'touchstart', finger(1, 100));
      touch(control('right'), 'touchmove', held);
      touch(second, 'touchstart', other, [held, other]);
      touch(control('right'), 'touchend', held, [other]);
      const reported = nodesChange.mock.calls.length;

      touch(second, 'touchmove', moved);
      touch(second, 'touchend', moved);

      expect(resize).toHaveBeenCalledTimes(1);
      expect(resizeEnd).toHaveBeenCalledTimes(1);
      expect(endedBoxes()).not.toContainEqual(pressed);
      expect(nodesChange).toHaveBeenCalledTimes(reported);
    },
  );

  it('resizes nothing from a pointer that leaves a press another finger still holds, for another control', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    touch(control('right'), 'touchstart', finger(1, 140));
    mouse(control('left'), 'mousedown', 100);
    mouse(window, 'mousemove', 60);
    mouse(window, 'mouseup', 60);

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resizeEnd).not.toHaveBeenCalled();

    touch(control('right'), 'touchend', finger(1, 140));

    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(endedBoxes()).not.toContainEqual(pressed);
  });

  it('resizes nothing from an arrow key while a pointer holds the press, and resizes from one once it is over', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    act(() => {
      control('bottom').dispatchEvent(keyDown('ArrowDown'));
    });

    expect(resizeEnd).not.toHaveBeenCalled();

    mouse(control('right'), 'mouseup', 140);
    act(() => {
      control('bottom').dispatchEvent(keyDown('ArrowDown'));
    });

    expect(endedBoxes().map((box) => box.size.height)).toEqual([
      client.size.height,
      client.size.height + keyboardResizeStep,
    ]);
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

  it('says a mouse resize and a touch resize ended by the pointer, and an arrow key by the keyboard', () => {
    mouse(control('right'), 'mousedown', 100);
    mouse(control('right'), 'mousemove', 140);
    mouse(control('right'), 'mouseup', 140);
    touchResize('right', [20, 40]);
    act(() => {
      control('right').dispatchEvent(keyDown('ArrowRight'));
    });

    expect(endedBy.mock.calls.flat()).toEqual([
      'pointer',
      'pointer',
      'keyboard',
    ]);
  });

  it('claims an arrow key on the axis of its control and hands it one resize end, and none to a key off it', () => {
    const onAxis = keyDown('ArrowRight');

    act(() => {
      control('right').dispatchEvent(keyDown('ArrowUp'));
      control('right').dispatchEvent(onAxis);
    });

    expect(onAxis.defaultPrevented).toBe(true);
    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      {
        position: client.position,
        size: { ...client.size, width: client.size.width + keyboardResizeStep },
      },
      false,
    );
  });

  it.each([
    { named: 'off the axis of its control', of: client, key: 'ArrowUp' },
    {
      named: 'that would shrink its node under the minimum size',
      of: narrowest,
      key: 'ArrowLeft',
    },
    {
      named: 'that would shrink an extent already below ten',
      of: small,
      key: 'ArrowLeft',
    },
  ])(
    'claims an arrow key $named, so nothing resizes and React Flow moves no node',
    ({ of, key }) => {
      const reported = nodesChange.mock.calls.length;
      const event = keyDown(key);

      act(() => {
        control('right', of).dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(resizeEnd).not.toHaveBeenCalled();
      expect(nodesChange).toHaveBeenCalledTimes(reported);
    },
  );

  it.each(['Tab', 'Escape', 'Enter', 'Delete'])(
    'leaves %s, which is no arrow key, to its default and to the canvas around its controls',
    (key) => {
      const event = keyDown(key);

      act(() => {
        control('right').dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(false);
      expect(canvasKeyDown).toHaveBeenCalledOnce();
    },
  );
});
