import { useStore, useViewport, ViewportPortal } from '@xyflow/react';
import { useEffect, useEffectEvent, useState } from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import {
  addedPoint,
  shownMidpoints,
  type CurvePoints,
} from './curve-points.js';
import { focusElement } from './edits.js';
import { besideHandle, HandleActions, onHandle } from './handle-actions.js';
import {
  draggedPoint,
  nudgedPoint,
  useHandleDrag,
  type HandlePointer,
} from './handle-drag.js';
import styles from './handles.module.css';
import type { WaypointTarget } from './waypoints.js';

type OpenActions = {
  readonly context: CurvePoints['context'];
  readonly index: number;
};

/**
 * A handle on each point of the selected trust boundary curve, a midpoint
 * handle halfway along each segment long enough to show one, which a drag
 * pulls a new point out of, and the actions of the point clicked. The
 * handles stand aside while React Flow drags or resizes the curve, whose
 * points they would otherwise leave behind, and the midpoint handles while a
 * point is dragged, except that a midpoint drag keeps its own handle mounted,
 * unseen, so the pointer it captured is not lost.
 */
export function CurvePointControls({
  points,
}: {
  readonly points: CurvePoints;
}) {
  const { zoom } = useViewport();
  const { t } = useTranslator();
  const [open, setOpen] = useState<OpenActions | undefined>();
  const { boundary } = points;
  const gesture = useStore((state) => {
    const drawn =
      boundary === undefined ? undefined : state.nodeLookup.get(boundary.id);
    return drawn?.dragging === true || drawn?.resizing === true;
  });
  const handBack = (): void => {
    if (boundary !== undefined) {
      focusElement(boundary.id);
    }
  };
  const drag = useHandleDrag<WaypointTarget>(points.context, {
    preview: (held, span) => {
      points.preview({ ...held, point: draggedPoint(held.point, span) });
    },
    commit: (held, span) => {
      points.commit(
        { ...held, point: draggedPoint(held.point, span) },
        'pointer',
      );
      handBack();
    },
    cancel: () => {
      points.cancel();
      handBack();
    },
  });
  const down = (
    event: HandlePointer,
    held: WaypointTarget | undefined,
  ): void => {
    if (held !== undefined && drag.down(event, held)) {
      setOpen(undefined);
    }
  };
  const cancel = (focus: boolean): void => {
    drag.drop();
    setOpen(undefined);
    points.cancel();
    if (focus) {
      handBack();
    }
  };
  const add = (index: number): void => {
    setOpen(undefined);
    const added = points.add(index);
    if (added !== undefined) {
      focusPoint(added);
    }
  };
  const remove = (index: number): void => {
    setOpen(undefined);
    if (points.remove(index)) {
      handBack();
    } else {
      focusPoint(index);
    }
  };
  const chosen = open?.context === points.context ? open.index : undefined;
  const keyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (
      boundary === undefined ||
      keyboardOwner(event.target) !== 'page' ||
      !(event.target instanceof Element) ||
      event.target.closest('[data-testid="canvas-container"]') === null
    ) {
      return;
    }
    if (
      pressesContextualShortcut('cancel-curve-point', event, hostPlatform) &&
      (drag.active() || chosen !== undefined)
    ) {
      event.preventDefault();
      event.stopPropagation();
      cancel(true);
      return;
    }
    const handle = event.target.closest('[data-curve-point]');
    const index = Number(handle?.getAttribute('data-curve-point'));
    const point =
      handle === null ? undefined : boundary.shape.waypoints.at(index);
    if (point === undefined) {
      return;
    }
    const moved = nudgedPoint(
      point,
      event,
      'move-curve-point',
      'move-curve-point-far',
    );
    if (moved !== undefined) {
      points.commit({ kind: 'move', index, point: moved }, 'keyboard');
    } else if (
      pressesContextualShortcut('remove-curve-point', event, hostPlatform)
    ) {
      remove(index);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const blurred = useEffectEvent((): void => {
    cancel(false);
  });
  useEffect(() => {
    document.addEventListener('keydown', keyDown, true);
    window.addEventListener('blur', blurred);
    return () => {
      document.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('blur', blurred);
    };
  }, []);

  const node = points.layout.nodes.find(
    (candidate) => candidate.id === boundary?.id,
  );
  if (boundary === undefined || node?.kind !== 'boundary-curve' || gesture) {
    return null;
  }
  const shown = node.waypoints.map((point) => ({
    x: node.position.x + point.x,
    y: node.position.y + point.y,
  }));
  const beside = chosen === undefined ? undefined : shown.at(chosen);
  return (
    <ViewportPortal>
      {shownMidpoints(shown, zoom, points.draft).map(
        ({ point, index, pulled }) => (
          <span
            aria-hidden="true"
            className={`${styles.midpoint} nodrag nopan`}
            data-curve-segment={index}
            data-pulled={pulled ? 'true' : undefined}
            key={index}
            onClick={(event) => {
              event.stopPropagation();
              drag.endedDrag();
            }}
            onPointerCancel={() => {
              cancel(true);
            }}
            onPointerDown={(event) => {
              down(event, addedPoint(boundary.shape.waypoints, index));
            }}
            onPointerMove={drag.move}
            onPointerUp={drag.up}
            style={onHandle(point, zoom)}
            title={t('tools.curve-midpoint-handle-help')}
          />
        ),
      )}
      {shown.map((point, index) => (
        <button
          aria-label={t('tools.curve-point-numbered', { number: index + 1 })}
          className={`${styles.handle} nodrag nopan`}
          data-curve-point={index}
          key={index}
          onClick={(event) => {
            event.stopPropagation();
            if (event.detail === 0 || !drag.endedDrag()) {
              setOpen({ context: points.context, index });
            }
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
          onPointerCancel={() => {
            cancel(true);
          }}
          onPointerDown={(event) => {
            const held = boundary.shape.waypoints.at(index);
            down(
              event,
              held === undefined
                ? undefined
                : { kind: 'move', index, point: held },
            );
          }}
          onPointerMove={drag.move}
          onPointerUp={drag.up}
          style={onHandle(point, zoom)}
          title={t('tools.curve-point-handle-help')}
          type="button"
        >
          <span aria-hidden="true">●</span>
        </button>
      ))}
      {chosen !== undefined && beside !== undefined && (
        <HandleActions
          actions={[
            {
              label: t('tools.remove-curve-point'),
              run: () => {
                remove(chosen);
              },
            },
            {
              label: t('tools.add-curve-point'),
              run: () => {
                add(chosen);
              },
            },
          ]}
          label={t('tools.curve-point-actions')}
          onClose={() => {
            setOpen(undefined);
            handBack();
          }}
          style={besideHandle(beside, zoom)}
        />
      )}
    </ViewportPortal>
  );
}

function focusPoint(index: number): void {
  document
    .querySelector<HTMLElement>(`[data-curve-point="${String(index)}"]`)
    ?.focus();
}
