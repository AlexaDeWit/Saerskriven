import type { Element } from '@saerskriven/model';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconCommandButton } from '../commands/command-button.js';
import type { CommandId } from '../commands/registry.js';
import { useTranslator } from '../messages/locale.js';
import { leaveThreatRegister } from '../panel/threat-register-state.js';
import { selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { modelStore, useModelStore } from '../store/store.js';
import { focusCanvas, focusElement } from './edits.js';
import { EndpointEditor } from './endpoint-editor.js';
import { GeometryEditor } from './geometry-editor.js';
import {
  selectionControlEvent,
  focusSelectionControl,
  selectionControlFrom,
  type SelectionControl,
} from './selection-control.js';
import { strokeGlyph } from './stroke-glyph.js';
import { currentTool, useTool } from './tools.js';
import styles from './selection-controls.module.css';
import toolbox from './toolbox.module.css';

type OpenControl = {
  readonly kind: SelectionControl;
  readonly state: State;
  readonly transition: number;
};

/**
 * The non-modal position, size, and endpoint editors reached through
 * registered commands. One that opens closes the threat register, which
 * would cover it.
 */
export function SelectionControls() {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<OpenControl | undefined>();
  useEffect(() => {
    const open = (event: Event) => {
      const kind = selectionControlFrom(event);
      const current = modelStore.getState();
      if (
        kind !== undefined &&
        current.selection.length > 0 &&
        current.inlineEditor === undefined &&
        currentTool().active === 'select'
      ) {
        leaveThreatRegister();
        setHeld({ kind, state: current, transition: currentTool().transition });
      }
    };
    document.addEventListener(selectionControlEvent, open);
    return () => {
      document.removeEventListener(selectionControlEvent, open);
    };
  }, []);
  const valid =
    held !== undefined &&
    held.state.present === state.present &&
    held.state.selection === state.selection &&
    held.state.inlineEditor === state.inlineEditor &&
    held.transition === tool.transition;
  if (held !== undefined && !valid) {
    setHeld(undefined);
  }
  if (held === undefined || !valid) {
    return null;
  }
  const close = () => {
    setHeld(undefined);
    const id = state.selection[0];
    if (id !== undefined) {
      focusElement(id);
    }
  };
  return (
    <SelectionEditor
      key={held.kind}
      control={held.kind}
      state={state}
      close={close}
    />
  );
}

/** Endpoint and direction commands available beside a selected flow. */
export function FlowEndpointCommands() {
  const { t } = useTranslator();
  const selected = useSelectedElement();
  return selected?.kind === 'flow' ? (
    <section
      aria-label={t('tools.reconnect-flow')}
      className={styles.endpoints}
      data-pane=""
    >
      <CardCommand command="reconnect-source" />
      <CardCommand command="reconnect-target" />
      <CardCommand
        command="toggle-flow-direction"
        pressed={selected.bidirectional}
      />
      <CardCommand command="reverse-flow" />
    </section>
  ) : null;
}

/** The shape command available beside a selected trust boundary, in the flow commands' place. */
export function BoundaryShapeCommands() {
  const { t } = useTranslator();
  return useSelectedElement()?.kind === 'trust-boundary' ? (
    <section
      aria-label={t('tools.trust-boundary')}
      className={styles.endpoints}
      data-pane=""
    >
      <CardCommand command="toggle-boundary-shape" />
    </section>
  ) : null;
}

const cardGlyphs = {
  'reconnect-source': (
    <>
      <circle cx="3.5" cy="8" r="1.75" fill="currentColor" />
      <path d="M6.5 8h7m-2.5-2.5 2.5 2.5-2.5 2.5" />
    </>
  ),
  'reconnect-target': (
    <>
      <path d="M2.5 8h7m-2.5-2.5 2.5 2.5-2.5 2.5" />
      <circle cx="12.5" cy="8" r="1.75" fill="currentColor" />
    </>
  ),
  'toggle-flow-direction': (
    <path d="M2.5 8h11M5 5.5 2.5 8 5 10.5m6-5L13.5 8 11 10.5" />
  ),
  'reverse-flow': (
    <path d="M2.5 5h11M11 2.5 13.5 5 11 7.5M13.5 11h-11M5 8.5 2.5 11 5 13.5" />
  ),
  'toggle-boundary-shape': (
    <>
      <rect x="2.5" y="1.5" width="11" height="5" />
      <path d="M2 14C4 10 8 10 9 12.25s3 2.5 5-1" />
    </>
  ),
} satisfies Partial<Record<CommandId, ReactNode>>;

function CardCommand({
  command,
  pressed,
}: {
  readonly command: keyof typeof cardGlyphs;
  readonly pressed?: boolean;
}) {
  return (
    <IconCommandButton
      className={toolbox.control}
      command={command}
      pressed={pressed}
      side="bottom"
    >
      {strokeGlyph(cardGlyphs[command])}
    </IconCommandButton>
  );
}

function useSelectedElement(): Element | undefined {
  const state = useModelStore((value) => value);
  const tool = useTool();
  return state.inlineEditor === undefined && tool.active === 'select'
    ? selectedElementRecord(state)
    : undefined;
}

function SelectionEditor({
  control,
  state,
  close,
}: {
  readonly control: SelectionControl;
  readonly state: State;
  readonly close: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const { t } = useTranslator();
  const onClose = useEffectEvent(close);
  useEffect(() => {
    const panel = root.current;
    const frame = requestAnimationFrame(() => {
      focusSelectionControl();
    });
    const blur = () => {
      onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        event.target instanceof Node &&
        panel?.contains(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', blur);
      document.removeEventListener('keydown', key, true);
      if (panel?.contains(document.activeElement)) {
        focusCanvas();
      }
    };
  }, []);
  return (
    <section
      aria-label={t(
        control === 'geometry'
          ? 'commands.label-edit-geometry'
          : 'tools.flow-endpoint',
      )}
      data-pane=""
      data-selection-editor
      className={styles.panel}
      ref={root}
    >
      {control === 'geometry' ? (
        <GeometryEditor state={state} close={close} />
      ) : (
        <EndpointEditor state={state} side={control} close={close} />
      )}
    </section>
  );
}
