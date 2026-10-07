import { MoveIcon, TrashIcon } from '@radix-ui/react-icons';
import { polylinePath } from '@saerskriven/canvas';
import { sides } from '@saerskriven/model';
import { useReactFlow, useViewport, ViewportPortal } from '@xyflow/react';
import { useRef } from 'react';
import { FlowRouteToolbar } from './flow-route-toolbar.js';
import { beginEditingText } from './edits.js';
import { applySelection } from './changes.js';
import { elementIds } from './nodes.js';
import { connectionGlyph } from './connection-glyph.js';
import {
  useFlowBendInteraction,
  type FlowEnd,
} from './flow-bend-interaction.js';
import type { FlowBends } from './flow-bends.js';
import { HandleActions, onHandle } from './handle-actions.js';
import { sideMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import styles from './handles.module.css';

const flowEnds: readonly FlowEnd[] = ['source', 'target'];

export function FlowBendControls({
  bends,
  panelCover,
}: {
  readonly bends: FlowBends;
  readonly panelCover: number;
}) {
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
  const inserted =
    bends.draft?.kind === 'insert' ? bends.draft.index : Infinity;
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
              key={
                index === inserted + 1
                  ? 'preview'
                  : index > inserted + 1
                    ? index - 1
                    : index
              }
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
            key={
              index === inserted
                ? 'preview'
                : index > inserted
                  ? index - 1
                  : index
            }
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
                label: t('tools.auto-anchor'),
                pressed: pinned(mode.end) === undefined,
                run: () => {
                  interaction.pinEnd(mode.end, undefined);
                },
              },
              ...sides.map((side) => ({
                label: t(sideMessages[side]),
                icon: connectionGlyph(side),
                pressed: pinned(mode.end) === side,
                run: () => {
                  interaction.pinEnd(mode.end, side);
                },
              })),
            ]}
            label={t('tools.flow-end-actions')}
            panelCover={panelCover}
            onClose={() => {
              interaction.cancel();
            }}
            point={mode.end === 'source' ? edge.source : edge.target}
          />
        )}
        {actionable !== undefined && mode?.kind === 'actions' && (
          <HandleActions
            actions={[
              {
                label: t('tools.remove-bend'),
                icon: <TrashIcon aria-hidden="true" />,
                run: () => {
                  interaction.remove(mode.index);
                },
              },
              {
                label: t('tools.move-bend'),
                icon: <MoveIcon aria-hidden="true" />,
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
            panelCover={panelCover}
            onClose={() => {
              interaction.cancel();
            }}
            point={actionable}
          />
        )}
      </ViewportPortal>
      <FlowRouteToolbar
        edge={edge}
        panelCover={panelCover}
        toolbar={toolbar}
        help={help}
        placing={mode !== undefined && mode.kind !== 'actions'}
        cancel={() => {
          interaction.cancel();
        }}
      />
    </>
  );
}
