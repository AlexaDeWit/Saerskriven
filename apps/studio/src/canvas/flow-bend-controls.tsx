import { polylinePath } from '@saerskriven/canvas';
import { sides, type Side } from '@saerskriven/model';
import {
  Panel,
  useReactFlow,
  useViewport,
  ViewportPortal,
} from '@xyflow/react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { CommandButton } from '../commands/command-button.js';
import { beginEditingText } from './edits.js';
import { applyChanges } from './changes.js';
import { elementIds, nodesById } from './nodes.js';
import {
  useFlowBendInteraction,
  type FlowEnd,
} from './flow-bend-interaction.js';
import type { FlowBends } from './flow-bends.js';
import { sideMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import styles from './flow-bend-controls.module.css';

const flowEnds: readonly FlowEnd[] = ['source', 'target'];

/** Line hit targets, bend and end handles, and contextual route controls. */
export function FlowBendControls({ bends }: { readonly bends: FlowBends }) {
  const view = useReactFlow();
  const { zoom } = useViewport();
  const edge = bends.layout.edges.find((value) => value.id === bends.flow?.id);
  const toolbar = useRef<HTMLFieldSetElement>(null);
  const { t } = useTranslator();
  const interaction = useFlowBendInteraction(bends, edge, toolbar);
  if (edge === undefined || bends.flow === undefined) {
    return null;
  }
  const { mode } = interaction;
  const points = [edge.source, ...edge.waypoints, edge.target];
  const actionable =
    mode?.kind === 'actions' ? bends.flow.waypoints[mode.index] : undefined;
  const help =
    mode?.kind === 'choose'
      ? t('tools.bend-choose-help', { number: mode.index + 1 })
      : t(
          mode?.kind === 'place'
            ? 'tools.bend-place-help'
            : 'tools.bend-idle-help',
        );
  return (
    <>
      <ViewportPortal>
        <svg aria-hidden="true" className={styles.segments}>
          {points.slice(0, -1).map((point, index) => (
            <path
              className={styles.segment}
              d={polylinePath([point, points[index + 1]])}
              data-bend-segment={index}
              data-chosen={
                mode?.kind === 'choose' && mode.index === index
                  ? 'true'
                  : undefined
              }
              key={index}
              onClick={(event) => {
                if (
                  event.shiftKey &&
                  mode?.kind !== 'choose' &&
                  mode?.kind !== 'place'
                ) {
                  applyChanges(
                    [{ type: 'select', id: edge.id, selected: false }],
                    elementIds(bends.layout),
                    nodesById(bends.layout),
                  );
                }
              }}
              onDoubleClick={() => {
                beginEditingText(edge.id);
              }}
              onPointerCancel={() => {
                interaction.cancel();
              }}
              onPointerDown={(event) => {
                if (event.shiftKey) {
                  return;
                }
                interaction.down(event, {
                  kind: 'insert',
                  index,
                  point: view.screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                  }),
                });
              }}
              onPointerMove={interaction.move}
              onPointerUp={interaction.up}
              strokeWidth={24 / zoom}
            />
          ))}
        </svg>
      </ViewportPortal>
      <ViewportPortal>
        {edge.waypoints.map((point, index) => (
          <button
            aria-label={t('tools.bend-numbered', { number: index + 1 })}
            className={`${styles.handle} nodrag nopan`}
            data-bend-index={index}
            key={index}
            onClick={(event) => {
              event.stopPropagation();
              interaction.actions(index);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
            }}
            onPointerCancel={() => {
              interaction.cancel();
            }}
            onPointerDown={(event) => {
              interaction.down(event, { kind: 'move', index, point });
            }}
            onPointerMove={interaction.move}
            onPointerUp={interaction.up}
            style={{
              left: point.x,
              top: point.y,
              transform: `translate(-50%, -50%) scale(${String(1 / zoom)})`,
            }}
            title="Drag or use arrow keys to move. Click for actions. Delete removes this bend."
            type="button"
          >
            <span aria-hidden="true">●</span>
          </button>
        ))}
        {flowEnds.map((end) => {
          const element =
            end === 'source' ? edge.sourceElement : edge.targetElement;
          if (element === undefined) {
            return null;
          }
          const point = end === 'source' ? edge.source : edge.target;
          return (
            <button
              aria-label={t(
                end === 'source'
                  ? 'tools.flow-source-end'
                  : 'tools.flow-target-end',
              )}
              className={`${styles.handle} ${styles.end} nodrag nopan`}
              data-flow-end={end}
              key={end}
              onClick={(event) => {
                event.stopPropagation();
                interaction.endActions(end);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
              }}
              onPointerCancel={() => {
                interaction.cancel();
              }}
              onPointerDown={(event) => {
                interaction.downEnd(event, end);
              }}
              onPointerMove={interaction.move}
              onPointerUp={interaction.up}
              style={{
                left: point.x,
                top: point.y,
                transform: `translate(-50%, -50%) scale(${String(1 / zoom)})`,
              }}
              title="Drag to another side of its element. Arrow keys pin a side, Delete lets it follow the route. Click for actions."
              type="button"
            >
              <span aria-hidden="true">◆</span>
            </button>
          );
        })}
        {mode?.kind === 'end-actions' && (
          <EndActions
            pinned={mode.end === 'source' ? edge.sourcePin : edge.targetPin}
            onChoose={(side) => {
              interaction.pinEnd(mode.end, side);
            }}
            onClose={() => {
              interaction.cancel();
            }}
            style={{
              left: (mode.end === 'source' ? edge.source : edge.target).x,
              top: (mode.end === 'source' ? edge.source : edge.target).y,
              transform: `translate(20px, 20px) scale(${String(1 / zoom)})`,
            }}
          />
        )}
        {actionable !== undefined && mode?.kind === 'actions' && (
          <BendActions
            onClose={() => {
              interaction.cancel();
            }}
            onMove={() => {
              interaction.place({
                kind: 'move',
                index: mode.index,
                point: actionable,
              });
              toolbar.current?.focus();
            }}
            onRemove={() => {
              interaction.remove(mode.index);
            }}
            style={{
              left: actionable.x,
              top: actionable.y,
              transform: `translate(20px, 20px) scale(${String(1 / zoom)})`,
            }}
          />
        )}
      </ViewportPortal>
      <Panel position="bottom-center">
        <fieldset
          aria-label={t('tools.flow-route')}
          className={`${styles.toolbar} nodrag nopan`}
          data-bend-toolbar
          ref={toolbar}
          tabIndex={-1}
        >
          <CommandButton command="add-bend" />
          <span>{help}</span>
          {mode !== undefined && mode.kind !== 'actions' && (
            <button
              onClick={() => {
                interaction.cancel();
              }}
              type="button"
            >
              Cancel
            </button>
          )}
        </fieldset>
      </Panel>
    </>
  );
}

function BendActions({
  onMove,
  onRemove,
  onClose,
  style,
}: {
  readonly onMove: () => void;
  readonly onRemove: () => void;
  readonly onClose: () => void;
  readonly style: CSSProperties;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const { t } = useTranslator();
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <fieldset
      aria-label={t('tools.bend-actions')}
      className={`${styles.actions} nodrag nopan`}
      style={style}
    >
      <button onClick={onRemove} ref={first} type="button">
        {t('tools.remove-bend')}
      </button>
      <button onClick={onMove} type="button">
        {t('tools.move-bend')}
      </button>
      <button onClick={onClose} type="button">
        {t('tools.close')}
      </button>
    </fieldset>
  );
}

function EndActions({
  pinned,
  onChoose,
  onClose,
  style,
}: {
  readonly pinned: Side | undefined;
  readonly onChoose: (side: Side | undefined) => void;
  readonly onClose: () => void;
  readonly style: CSSProperties;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const { t } = useTranslator();
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <fieldset
      aria-label={t('tools.flow-end-actions')}
      className={`${styles.actions} nodrag nopan`}
      style={style}
    >
      <button
        aria-pressed={pinned === undefined}
        onClick={() => {
          onChoose(undefined);
        }}
        ref={first}
        type="button"
      >
        {t('tools.follow-route')}
      </button>
      {sides.map((side) => (
        <button
          aria-pressed={pinned === side}
          key={side}
          onClick={() => {
            onChoose(side);
          }}
          type="button"
        >
          {t(sideMessages[side])}
        </button>
      ))}
      <button onClick={onClose} type="button">
        {t('tools.close')}
      </button>
    </fieldset>
  );
}
