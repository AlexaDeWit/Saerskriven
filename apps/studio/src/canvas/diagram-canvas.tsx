import {
  gridSpacing,
  themedCanvasStylesheet,
  type CanvasFlowEdge,
} from '@saerskriven/canvas';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  type AriaLabelConfig,
  type Connection,
  type EdgeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { ElementId } from '@saerskriven/model';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { ThreatOverlay } from '../panel/threat-overlay.js';
import { Action } from '../store/actions.js';
import { keyboardOwner, useCommandSurface } from '../commands/binding.js';
import {
  contextualShortcuts,
  describeContextualShortcuts,
  pressesContextualShortcut,
} from '../commands/contextual-shortcuts.js';
import { commandFor, describeCommandShortcuts } from '../commands/registry.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import { sentences } from '../messages/said.js';
import { selectedElement, selectedElements } from '../store/selectors.js';
import { dispatch, useModelStore } from '../store/store.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { useBoxSelection } from './box-selection.js';
import { applyConnection, betweenTwoElements } from './changes.js';
import { beginEditingText, drawnElement, removeSelected } from './edits.js';
import { CurvePointControls } from './curve-point-controls.js';
import { useCurvePoints } from './curve-points.js';
import { useFlowBends } from './flow-bends.js';
import { FlowBendControls } from './flow-bend-controls.js';
import { FocusPan } from './focus-pan.js';
import { useGroupDrag } from './group-drag.js';
import { selectToolOnItem } from './item-focus.js';
import { useLiveEdges } from './live-edges.js';
import {
  KeyboardMoveMessage,
  preMoveMessage,
  type KeyboardMoveReport,
} from './move-message.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  type DiagramNode,
} from './nodes.js';
import { editingEdgeTypes, editingNodeTypes } from './inline-editing.js';
import { useNodeDrag } from './node-drag.js';
import { usePaneShield } from './pane-shield.js';
import { PlacementPreview } from './placement-preview.js';
import { usePlacement } from './placement.js';
import { currentTool } from './tools.js';
import { FitOnOpen } from './view-commands.js';
import { zoomActivationKeysFor, zoomLimits } from './viewport.js';
import { ZoomCluster } from './zoom-cluster.js';
import {
  BoundaryShapeCommands,
  SelectionControls,
  FlowEndpointCommands,
} from './selection-controls.js';
import { useSnap } from './snap.js';
import { useBackgroundSelection } from './background-selection.js';
import styles from './diagram-canvas.module.css';

const panMouseButtons: number[] = [1];

const itemKeys = [
  'select-canvas-item',
  'edit-canvas-text',
  'toggle-canvas-item',
  'move-selection',
  'move-selection-far',
] as const;

const flowKeys = [
  'select-canvas-item',
  'edit-canvas-text',
  'toggle-canvas-item',
] as const;

const canvasCommands = [
  'hand-tool',
  'focus-threats',
  'delete',
  'select-tool',
] as const;

type CanvasKeyboardText = {
  readonly a11y: AriaLabelConfig;
  readonly description: string;
};

function useCanvasKeyboardText(): CanvasKeyboardText {
  const { t } = useTranslator();

  return useMemo(() => {
    const commandText = describeCommandShortcuts(
      canvasCommands,
      hostPlatform,
      t,
    );
    const itemText = describeContextualShortcuts(
      [...itemKeys],
      hostPlatform,
      t,
    );
    const flowText = describeContextualShortcuts(
      [...flowKeys],
      hostPlatform,
      t,
    );
    const nodeText = sentences(itemText, commandText);
    return {
      a11y: {
        'node.a11yDescription.default': nodeText,
        'node.a11yDescription.keyboardDisabled': nodeText,
        'node.a11yDescription.ariaLiveMessage': preMoveMessage,
        'edge.a11yDescription.default': sentences(flowText, commandText),
        'controls.ariaLabel': t('canvas.flow-controls'),
        'controls.zoomIn.ariaLabel': t('commands.label-zoom-in'),
        'controls.zoomOut.ariaLabel': t('commands.label-zoom-out'),
        'controls.fitView.ariaLabel': t('commands.label-fit-to-view'),
        'controls.interactive.ariaLabel': t('canvas.toggle-interactivity'),
        'minimap.ariaLabel': t('canvas.minimap'),
        'handle.ariaLabel': t('canvas.handle'),
      },
      description: describeContextualShortcuts(
        contextualShortcuts
          .filter((entry) => entry.group !== 'commands.group-panels')
          .map((entry) => entry.id),
        hostPlatform,
        t,
      ),
    };
  }, [t]);
}

/** The controlled diagram canvas and its floating editing controls. */
export function DiagramCanvas({
  paneCoverage,
}: {
  readonly paneCoverage?: readonly [number, (cover: number) => void];
} = {}) {
  const snapping = useSnap();
  const backgroundSelection = useBackgroundSelection();
  const bends = useFlowBends();
  const points = useCurvePoints();
  const layout = points.draft === undefined ? bends.layout : points.layout;
  const model = useModelStore((state) => state.present);
  const selection = useModelStore(selectedElements);
  const selected = useModelStore(selectedElement);
  const keyboardDescriptionId = useId();
  const keyboard = useCanvasKeyboardText();
  const { t } = useTranslator();
  const graph = useMemo(
    () => diagramGraph(layout, model, selection, t),
    [layout, model, selection, t],
  );
  const elements = useMemo(() => elementIds(layout), [layout]);
  const positions = useMemo(() => nodesById(layout), [layout]);
  const surface = useRef<HTMLDivElement>(null);
  const boxSelection = useBoxSelection(surface, elements, positions);
  const view = useRef<ReactFlowInstance<DiagramNode, CanvasFlowEdge> | null>(
    null,
  );
  const localCoverage = useState(0);
  const [, setPanelCover] = paneCoverage ?? localCoverage;
  const placement = usePlacement(surface, view, layout);
  const { mode } = placement;

  const liveEdges = useLiveEdges(layout, graph, selection, elements, positions);
  const paneShield = usePaneShield(elements);
  const nodeDrag = useNodeDrag(positions, liveEdges.onNodesChange);
  const commandSurface = useCommandSurface();
  const groupDrag = useGroupDrag(
    view,
    layout,
    selection,
    elements,
    liveEdges.onNodesChange,
  );

  const onConnect = (connection: Connection): void => {
    applyConnection(connection, elements);
  };

  const onPointerDownCapture = (event: PointerEvent<HTMLDivElement>): void => {
    if (paneShield.pointerDown(event)) {
      return;
    }
    backgroundSelection.down(event);
    liveEdges.rebase();
    if (groupDrag.down(event)) {
      return;
    }
    boxSelection.pointerDown(event, mode.active);
    placement.pointerDown(event);
  };

  const keyboardMove = useRef<KeyboardMoveReport>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    keyboardMove.current?.(event);
    if (
      keyboardOwner(event.target) !== 'page' ||
      commandFor(event, hostPlatform)?.id !== 'delete'
    ) {
      return;
    }
    if (!removeSelected()) {
      return;
    }
    event.preventDefault();
    surface.current?.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (selectToolOnItem(event, elements, commandSurface)) {
      return;
    }
    const selects = pressesContextualShortcut(
      'select-canvas-item',
      event,
      hostPlatform,
    );
    const edits = pressesContextualShortcut(
      'edit-canvas-text',
      event,
      hostPlatform,
    );
    const toggles = pressesContextualShortcut(
      'toggle-canvas-item',
      event,
      hostPlatform,
    );
    if (
      currentTool().active !== 'select' ||
      (!selects && !toggles) ||
      keyboardOwner(event.target) !== 'page'
    ) {
      return;
    }
    const element = drawnElement(event.target, elements);
    if (element === undefined) {
      return;
    }
    if (toggles) {
      const nextSelection = selection.includes(element)
        ? selection.filter((selectedId) => selectedId !== element)
        : [...selection, element];
      dispatch(Action.Select({ elementIds: nextSelection }));
    } else if (selection.length > 1) {
      dispatch(Action.Select({ elementIds: [element] }));
    } else if (!edits || element !== selected || !beginEditingText(element)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onEditText = useCallback(
    (id: string): void => {
      const element = elements.get(id);
      if (element !== undefined) {
        beginEditingText(element);
      }
    },
    [elements],
  );

  const firstClickedElement = useRef<ElementId | undefined>(undefined);

  const onCanvasClickCapture = (event: MouseEvent<HTMLDivElement>): void => {
    const shielded = paneShield.click(event);
    if (shielded !== undefined) {
      beginEditingText(shielded);
      return;
    }
    if (
      !(event.target instanceof Element) ||
      event.target.closest('input, textarea, button') !== null
    ) {
      return;
    }
    if (placement.click(event)) {
      return;
    }
    if (event.detail > 1) {
      const element = firstClickedElement.current;
      if (element !== undefined) {
        beginEditingText(element);
      }
      return;
    }
    const element = drawnElement(event.target, elements);
    firstClickedElement.current = element;
    if (!event.shiftKey && selection.length > 1 && element !== undefined) {
      dispatch(Action.Select({ elementIds: [element] }));
    }
  };

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      onEditText(edge.id);
    },
    [onEditText],
  );

  return (
    <div
      className={styles.canvas}
      data-active-tool={mode.active}
      data-tool={
        mode.active === 'select'
          ? undefined
          : mode.active === 'hand'
            ? 'hand'
            : 'place'
      }
      data-testid="canvas-container"
      onClickCapture={onCanvasClickCapture}
      onKeyDownCapture={onKeyDownCapture}
      onMouseDownCapture={(event) => {
        groupDrag.mouseDown(event);
      }}
      onPointerCancelCapture={(event) => {
        paneShield.cancel();
        backgroundSelection.cancel();
        groupDrag.cancel();
        boxSelection.cancel();
        placement.pointerCancel(event);
      }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={(event) => {
        backgroundSelection.move(event);
        groupDrag.move(event);
        placement.pointerMove(event);
      }}
      onPointerUpCapture={(event) => {
        backgroundSelection.up(event);
        groupDrag.up(event);
        placement.pointerUp(event);
      }}
    >
      <style>{themedCanvasStylesheet}</style>
      <VisuallyHidden id={keyboardDescriptionId}>
        {keyboard.description}
      </VisuallyHidden>
      <ReactFlow
        aria-describedby={keyboardDescriptionId}
        aria-label={t('tools.diagram-region')}
        ariaLabelConfig={keyboard.a11y}
        attributionPosition="bottom-left"
        autoPanOnNodeDrag={nodeDrag.autoPan}
        autoPanOnNodeFocus={false}
        autoPanOnSelection={false}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        edges={liveEdges.edges}
        edgeTypes={editingEdgeTypes}
        elementsSelectable={mode.active === 'select'}
        isValidConnection={betweenTwoElements}
        maxZoom={zoomLimits.maximum}
        minZoom={zoomLimits.minimum}
        multiSelectionKeyCode="Shift"
        nodes={liveEdges.nodes}
        nodesConnectable={mode.active === 'select'}
        nodesDraggable={mode.active === 'select'}
        nodeTypes={editingNodeTypes}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgesChange={boxSelection.onEdgesChange}
        onInit={(instance) => {
          view.current = instance;
        }}
        onKeyDown={onKeyDown}
        onNodeDragStart={nodeDrag.onNodeDragStart}
        onNodeDragStop={nodeDrag.onNodeDragStop}
        onNodesChange={nodeDrag.onNodesChange}
        onSelectionEnd={boxSelection.onSelectionEnd}
        onSelectionStart={boxSelection.onSelectionStart}
        panActivationKeyCode={null}
        zoomActivationKeyCode={zoomActivationKeysFor(hostPlatform)}
        panOnDrag={
          mode.active === 'hand'
            ? true
            : mode.active === 'select'
              ? panMouseButtons
              : false
        }
        panOnScroll
        ref={surface}
        snapToGrid={snapping}
        snapGrid={[gridSpacing, gridSpacing]}
        selectionKeyCode={null}
        selectionMode={SelectionMode.Full}
        selectionOnDrag={mode.active === 'select'}
        tabIndex={-1}
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
        zIndexMode="manual"
      >
        <Background gap={gridSpacing} variant={BackgroundVariant.Lines} />
        <PlacementPreview preview={placement.preview} />
        <FlowBendControls bends={bends} />
        <CurvePointControls points={points} />
        <FitOnOpen />
        <FocusPan />
        <KeyboardMoveMessage ref={keyboardMove} />
        <ZoomCluster />
      </ReactFlow>
      <SelectionControls />
      <FlowEndpointCommands />
      <BoundaryShapeCommands />
      <ThreatOverlay onCover={setPanelCover} />
    </div>
  );
}
