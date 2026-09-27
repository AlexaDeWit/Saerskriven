import { useViewport, ViewportPortal } from '@xyflow/react';
import { useEffect, useEffectEvent, useState } from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import type { CurvePoints, PointTarget } from './curve-points.js';
import { focusElement } from './edits.js';
import { besideHandle, HandleActions, onHandle } from './handle-actions.js';
import { draggedPoint, nudgedPoint, useHandleDrag } from './handle-drag.js';
import styles from './handles.module.css';

type OpenActions = {
  readonly context: CurvePoints['context'];
  readonly index: number;
};

/** A handle on each point of the selected trust boundary curve, and the actions of the one clicked. */
export function CurvePointControls({
  points,
}: {
  readonly points: CurvePoints;
}) {
  const { zoom } = useViewport();
  const { t } = useTranslator();
  const [open, setOpen] = useState<OpenActions | undefined>();
  const { boundary } = points;
  const handBack = (): void => {
    if (boundary !== undefined) {
      focusElement(boundary.id);
    }
  };
  const drag = useHandleDrag<PointTarget>(points.context, {
    preview: (held, span) => {
      points.preview({ ...held, point: draggedPoint(held.point, span) });
    },
    commit: (held, span) => {
      points.commit({ ...held, point: draggedPoint(held.point, span) });
      handBack();
    },
    cancel: () => {
      points.cancel();
      handBack();
    },
  });
  const cancel = (focus: boolean): void => {
    drag.drop();
    setOpen(undefined);
    points.cancel();
    if (focus) {
      handBack();
    }
  };
  const remove = (index: number): void => {
    setOpen(undefined);
    if (points.remove(index)) {
      handBack();
    } else {
      document
        .querySelector<HTMLElement>(`[data-curve-point="${String(index)}"]`)
        ?.focus();
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
      points.commit({ index, point: moved });
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
  if (boundary === undefined || node?.kind !== 'boundary-curve') {
    return null;
  }
  const shown = node.waypoints.map((point) => ({
    x: node.position.x + point.x,
    y: node.position.y + point.y,
  }));
  const beside = chosen === undefined ? undefined : shown.at(chosen);
  return (
    <ViewportPortal>
      {shown.map((point, index) => (
        <button
          aria-label={t('tools.curve-point-numbered', { number: index + 1 })}
          className={`${styles.handle} nodrag nopan`}
          data-curve-point={index}
          key={index}
          onClick={(event) => {
            event.stopPropagation();
            if (!drag.endedDrag()) {
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
            if (
              held !== undefined &&
              drag.down(event, { index, point: held })
            ) {
              setOpen(undefined);
            }
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
