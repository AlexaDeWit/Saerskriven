import { polylinePath } from '@saerskriven/canvas';
import { sides } from '@saerskriven/model';
import {
  Panel,
  useReactFlow,
  useViewport,
  ViewportPortal,
} from '@xyflow/react';
import { useRef } from 'react';
import { CommandButton } from '../commands/command-button.js';
import { beginEditingText } from './edits.js';
import { applySelection } from './changes.js';
import { elementIds } from './nodes.js';
import {
  useFlowBendInteraction,
  type FlowEnd,
} from './flow-bend-interaction.js';
import type { FlowBends } from './flow-bends.js';
import { besideHandle, HandleActions, onHandle } from './handle-actions.js';
import { sideMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import styles from './handles.module.css';

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
  const pinned = (end: FlowEnd) =>
    end === 'source' ? edge.sourcePin : edge.targetPin;
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
                  applySelection(
                    [{ type: 'select', id: edge.id, selected: false }],
                    elementIds(bends.layout),
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
            style={onHandle(point, zoom)}
            title={t('tools.bend-handle-help')}
            type="button"
          >
            <span aria-hidden="true">●</span>
          </button>
        ))}
        {flowEnds.map((end) => {
          const attached =
            (end === 'source' ? edge.sourceElement : edge.targetElement) !==
            undefined;
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
                if (attached) {
                  interaction.endActions(end);
                }
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
              style={onHandle(point, zoom)}
              title={t(
                attached
                  ? 'tools.flow-end-handle-help'
                  : 'tools.free-end-handle-help',
              )}
              type="button"
            >
              <span aria-hidden="true">◆</span>
            </button>
          );
        })}
        {mode?.kind === 'end-actions' && (
          <HandleActions
            actions={[
              {
                label: t('tools.follow-route'),
                pressed: pinned(mode.end) === undefined,
                run: () => {
                  interaction.pinEnd(mode.end, undefined);
                },
              },
              ...sides.map((side) => ({
                label: t(sideMessages[side]),
                pressed: pinned(mode.end) === side,
                run: () => {
                  interaction.pinEnd(mode.end, side);
                },
              })),
            ]}
            label={t('tools.flow-end-actions')}
            onClose={() => {
              interaction.cancel();
            }}
            style={besideHandle(
              mode.end === 'source' ? edge.source : edge.target,
              zoom,
            )}
          />
        )}
        {actionable !== undefined && mode?.kind === 'actions' && (
          <HandleActions
            actions={[
              {
                label: t('tools.remove-bend'),
                run: () => {
                  interaction.remove(mode.index);
                },
              },
              {
                label: t('tools.move-bend'),
                run: () => {
                  interaction.place({
                    kind: 'move',
                    index: mode.index,
                    point: actionable,
                  });
                  toolbar.current?.focus();
                },
              },
            ]}
            label={t('tools.bend-actions')}
            onClose={() => {
              interaction.cancel();
            }}
            style={besideHandle(actionable, zoom)}
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
              {t('tools.cancel')}
            </button>
          )}
        </fieldset>
      </Panel>
    </>
  );
}
