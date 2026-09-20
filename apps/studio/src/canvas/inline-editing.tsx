import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  canvasType,
  freeEndNodeKind,
  lineHeight,
  lineHeightRatio,
  nodeTextPlacement,
  wrappedTextStyles,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeKind,
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
import { announceRefusal, resetAnnouncements } from './announcements.js';
import {
  commitNote,
  commitRename,
  endInlineEditing,
  resizeNode,
  stopInlineEditing,
} from './edits.js';
import { useTranslator } from '../messages/locale.js';
import type { Said } from '../messages/said.js';
import { edgeLabel, nodeLabel, resizeLabels, useBadgeMarks } from './names.js';
import styles from './inline-editing.module.css';

type InlineFieldProps = {
  readonly elementId: ElementId;
  readonly label: Said;
  readonly value: string;
  readonly textStyle: WrappedTextStyle;
  readonly room?: number;
  readonly multiline?: boolean;
  readonly onCommit: (elementId: ElementId, text: string) => void;
  readonly refuse?: (label: Said, text: string) => TextRefusal | undefined;
};

/** The height of a one-line name field, which a placed element must reach in both dimensions for its name to open in place. */
export const nameFieldExtent = lineHeight(wrappedTextStyles.label.fontSize);

/**
 * The canvas node types, each drawing its inline name or Note field in place
 * of its text while the store's inline editor names it.
 */
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

function placedAt(placement: TextPlacement): CSSProperties {
  const fontSize = wrappedTextStyles[placement.textStyle].fontSize;
  const top =
    placement.anchor === 'top'
      ? placement.at.y - lineHeight(fontSize) / 2
      : placement.at.y;
  return {
    left: `${String(placement.at.x)}px`,
    top: `${String(top)}px`,
    width: `${String(placement.width)}px`,
    transform:
      placement.anchor === 'top'
        ? 'translate(-50%, 0)'
        : 'translate(-50%, -50%)',
  };
}

function fieldRoom(placement: TextPlacement, size: Size): number {
  const fontSize = wrappedTextStyles[placement.textStyle].fontSize;
  return placement.anchor === 'top'
    ? size.height - (placement.at.y - lineHeight(fontSize) / 2)
    : 2 * Math.min(placement.at.y, size.height - placement.at.y);
}

function typeOf(textStyle: WrappedTextStyle, room?: number): CSSProperties {
  return {
    fontFamily: canvasType.family,
    fontSize: `${String(wrappedTextStyles[textStyle].fontSize)}px`,
    lineHeight: lineHeightRatio,
    maxHeight: room === undefined ? undefined : `${String(room)}px`,
  };
}

function InlineField({
  elementId,
  label,
  value,
  textStyle,
  room,
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
        style={typeOf(textStyle, room)}
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
  const { t } = useTranslator();
  const marks = useBadgeMarks();
  const [resizing, setResizing] = useState(false);
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
        marks={marks}
        onResize={() => {
          setResizing(true);
        }}
        onResizeEnd={(box) => {
          setResizing(false);
          resizeNode(node, box);
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
            label={(speak) =>
              speak('fields.name-of', { element: nodeLabel(node, speak) })
            }
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
        <div className={`${styles.overNote} nodrag nopan nowheel`}>
          <InlineField
            elementId={node.id}
            label={(speak) => speak('fields.note-text')}
            multiline
            onCommit={commitNote}
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
      <CanvasEdgeBody {...props} marks={marks} textVisible={!editing} />
      {editing && edge !== undefined && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.overText} nodrag nopan`}
            style={placedAt(edge.label.name)}
          >
            <InlineField
              elementId={edge.id}
              label={(speak) =>
                speak('fields.name-of', { element: edgeLabel(edge, speak) })
              }
              onCommit={commitRename}
              refuse={refusedName}
              textStyle={edge.label.name.textStyle}
              value={edge.name}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
