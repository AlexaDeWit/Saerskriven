import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  canvasType,
  freeEndNodeKind,
  lineHeight,
  lineHeightRatio,
  nodeTextPlacement,
  sameNodeBox,
  wrappedTextStyles,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeKind,
  type TextAnchor,
  type TextPlacement,
  type WrappedTextStyle,
} from '@saerskriven/canvas';
import type { ElementId, Size } from '@saerskriven/model';
import {
  EdgeLabelRenderer,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react';
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  describeContextualShortcuts,
  pressesContextualShortcut,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import type { State } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { growToContent } from '../ui/grow-to-content.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  refusedName,
  refusedText,
  useTextDraft,
  type TextRefusal,
} from '../ui/text-field.js';
import {
  announce,
  announceRefusal,
  resetAnnouncements,
} from './announcements.js';
import {
  commitNote,
  commitRename,
  endInlineEditing,
  focusElement,
  resizeNode,
  stopInlineEditing,
} from './edits.js';
import { keyboardMoved } from './keyboard-moves.js';
import { NodeFold } from './live-edges.js';
import { useFlowBlockPortal } from './flow-block-layer.js';
import { useResizeLayerPosition } from './resize-layer-position.js';
import { useTranslator } from '../messages/locale.js';
import type { Said } from '../messages/said.js';
import { gestureDecimals } from './stored-decimals.js';
import {
  nameFieldLabel,
  nodeNameFieldLabel,
  resizeLabels,
  useBadgeMarks,
} from './names.js';
import styles from './inline-editing.module.css';

type InlineFieldProps = {
  readonly elementId: ElementId;
  readonly label: Said;
  readonly value: string;
  readonly textStyle: WrappedTextStyle;
  readonly room?: number;
  readonly padding?: string;
  readonly multiline?: boolean;
  readonly onCommit: (elementId: ElementId, text: string) => void;
  readonly refuse?: (label: Said, text: string) => TextRefusal | undefined;
};

/** The store's inline editor replaces the corresponding node text. */
export const editingNodeTypes = {
  actor: EditingNodeBody,
  process: EditingNodeBody,
  store: EditingNodeBody,
  text: EditingNodeBody,
  'boundary-box': EditingNodeBody,
  'boundary-curve': EditingNodeBody,
  [freeEndNodeKind]: CanvasFreeEndBody,
} as const satisfies Record<CanvasNodeKind, typeof EditingNodeBody> &
  Record<typeof freeEndNodeKind, typeof CanvasFreeEndBody>;

/** The flow edge type, with its name field in React Flow's label layer. */
export const editingEdgeTypes = { flow: EditingEdgeBody } as const;

function withoutLineBreaks(text: string): string {
  return text.replace(/[\r\n]+/gu, '');
}

function firstLineTop(placement: TextPlacement): number {
  return (
    placement.at.y -
    lineHeight(wrappedTextStyles[placement.textStyle].fontSize) / 2
  );
}

const fieldShift = {
  centre: 'translate(-50%, -50%)',
  top: 'translate(-50%, 0)',
  'top-left': 'none',
} as const satisfies Record<TextAnchor, string>;

function placedAt(placement: TextPlacement): CSSProperties {
  const top =
    placement.anchor === 'centre' ? placement.at.y : firstLineTop(placement);
  return {
    left: `${String(placement.at.x)}px`,
    top: `${String(top)}px`,
    width: `${String(placement.width)}px`,
    transform: fieldShift[placement.anchor],
  };
}

function fieldRoom(placement: TextPlacement, size: Size): number {
  return placement.anchor === 'centre'
    ? 2 * Math.min(placement.at.y, size.height - placement.at.y)
    : size.height - firstLineTop(placement);
}

function notePadding(placement: TextPlacement, size: Size): string {
  const top = firstLineTop(placement);
  const right = size.width - placement.at.x - placement.width;
  return [top, right, top, placement.at.x]
    .map((inset) => `${String(inset)}px`)
    .join(' ');
}

function typeOf(
  textStyle: WrappedTextStyle,
  room?: number,
  padding?: string,
): CSSProperties {
  return {
    fontFamily: canvasType.family,
    fontSize: `${String(wrappedTextStyles[textStyle].fontSize)}px`,
    lineHeight: lineHeightRatio,
    maxHeight: room === undefined ? undefined : `${String(room)}px`,
    padding,
  };
}

function InlineField({
  elementId,
  label,
  value,
  textStyle,
  room,
  padding,
  multiline = false,
  onCommit,
  refuse = refusedText,
}: InlineFieldProps) {
  const refusalId = useId();
  const keyboardDescriptionId = useId();
  const { t } = useTranslator();
  const field = useRef<HTMLTextAreaElement>(null);
  const settled = useRef(false);
  const draft = useTextDraft(
    label,
    value,
    undefined,
    (text) => {
      onCommit(elementId, text);
    },
    announceRefusal,
    refuse,
  );

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  useLayoutEffect(() => {
    if (!multiline) {
      growToContent(field.current);
    }
  });

  const cancel = (): void => {
    settled.current = true;
    endInlineEditing(elementId);
  };

  const commit = (handBack: boolean): void => {
    if (!draft.commit()) {
      return;
    }
    settled.current = true;
    if (handBack) {
      endInlineEditing(elementId);
    } else {
      stopInlineEditing();
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!multiline && event.key === 'Enter') {
      event.preventDefault();
    }
    const commitsName =
      !multiline &&
      pressesContextualShortcut('commit-name', event, hostPlatform);
    const commitsNote =
      multiline &&
      pressesContextualShortcut('commit-note', event, hostPlatform);
    if (commitsName || commitsNote) {
      event.preventDefault();
      commit(true);
    }
    if (pressesContextualShortcut('cancel-canvas-text', event, hostPlatform)) {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <>
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts(
          [multiline ? 'commit-note' : 'commit-name', 'cancel-canvas-text'],
          hostPlatform,
          t,
        )}
      </VisuallyHidden>
      <textarea
        aria-describedby={
          draft.refusal === undefined
            ? keyboardDescriptionId
            : `${keyboardDescriptionId} ${refusalId}`
        }
        aria-invalid={draft.refusal !== undefined}
        aria-label={label(t)}
        className={`${styles.field}${multiline ? ` ${styles.note}` : ''}`}
        onBlur={() => {
          if (!settled.current) {
            commit(false);
          }
        }}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          resetAnnouncements();
          draft.change(
            multiline
              ? event.target.value
              : withoutLineBreaks(event.target.value),
          );
        }}
        onKeyDown={keyDown}
        ref={field}
        rows={1}
        style={typeOf(textStyle, room, padding)}
        value={draft.text}
      />
      {draft.refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {draft.refusal.shown(t)}
        </p>
      )}
    </>
  );
}

function EditingNodeBody(props: NodeProps<CanvasFlowNode>) {
  const { node } = props.data;
  const drawing = useRef<SVGSVGElement>(null);
  useResizeLayerPosition(drawing, props);
  const { t } = useTranslator();
  const marks = useBadgeMarks();
  const [resizing, setResizing] = useState(false);
  const fold = useContext(NodeFold);
  const editor = useModelStore(
    useCallback(
      (state: State) =>
        state.inlineEditor?.elementId === node.id
          ? state.inlineEditor
          : undefined,
      [node.id],
    ),
  );
  const editingName = editor?.kind === 'name' && node.kind !== 'text';
  const editingNote = editor?.kind === 'note' && node.kind === 'text';
  const editing = editingName || editingNote;
  const placement = editing ? nodeTextPlacement(node) : undefined;

  return (
    <>
      <CanvasNodeBody
        {...props}
        controlsVisible={!editing}
        drawingRef={drawing}
        marks={marks}
        onResize={() => {
          setResizing(true);
        }}
        onResizeEnd={(box, input) => {
          setResizing(false);
          if (sameNodeBox(node, box)) {
            fold();
          } else {
            resizeNode(node, box, gestureDecimals[input]);
            if (input === 'keyboard') {
              keyboardMoved();
            }
          }
        }}
        onResizeRefused={() => {
          announce((speak) => speak('canvas.size-kept'));
        }}
        resizeLabels={resizeLabels(node, t)}
        resizing={resizing}
        textVisible={!editing}
      />
      {editingName && placement !== undefined && (
        <div
          className={`${styles.overText} nodrag nopan`}
          style={placedAt(placement)}
        >
          <InlineField
            elementId={node.id}
            label={nodeNameFieldLabel(node)}
            onCommit={commitRename}
            refuse={refusedName}
            room={
              node.kind === 'boundary-curve'
                ? undefined
                : fieldRoom(placement, node.size)
            }
            textStyle={placement.textStyle}
            value={node.name}
          />
        </div>
      )}
      {editingNote && placement !== undefined && (
        <div className={`${styles.overNote} nodrag nopan`}>
          <InlineField
            elementId={node.id}
            label={(speak) => speak('fields.note-text')}
            multiline
            onCommit={commitNote}
            padding={notePadding(placement, node.size)}
            textStyle={placement.textStyle}
            value={node.text}
          />
        </div>
      )}
    </>
  );
}

function EditingEdgeBody(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  const id = edge?.id;
  const renderBlock = useFlowBlockPortal();
  const focus = useCallback(() => {
    if (id !== undefined) {
      focusElement(id);
    }
  }, [id]);
  const marks = useBadgeMarks();
  const editing = useModelStore(
    useCallback(
      (state: State) =>
        state.inlineEditor?.kind === 'name' &&
        state.inlineEditor.elementId === edge?.id,
      [edge?.id],
    ),
  );

  return (
    <>
      <CanvasEdgeBody
        {...props}
        marks={marks}
        onBlockFocus={focus}
        renderBlock={renderBlock}
        textVisible={!editing}
      />
      {editing && edge !== undefined && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.overText} nodrag nopan`}
            style={placedAt(edge.label.name)}
          >
            <InlineField
              elementId={edge.id}
              label={nameFieldLabel(edge.name, 'flow')}
              onCommit={commitRename}
              textStyle={edge.label.name.textStyle}
              value={edge.name}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
