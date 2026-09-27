import type { Element } from '@saerskriven/model';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CommandButton } from '../commands/command-button.js';
import { useTranslator } from '../messages/locale.js';
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
import { currentTool, useTool } from './tools.js';
import styles from './selection-controls.module.css';

type OpenControl = {
  readonly kind: SelectionControl;
  readonly state: State;
  readonly transition: number;
};

/** The non-modal position, size, and endpoint editors reached through registered commands. */
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
  return useSelectedKind() === 'flow' ? (
    <section
      aria-label={t('tools.reconnect-flow')}
      className={styles.endpoints}
      data-pane=""
    >
      <CommandButton command="reconnect-source" />
      <CommandButton command="reconnect-target" />
      <CommandButton command="toggle-flow-direction" />
      <CommandButton command="reverse-flow" />
    </section>
  ) : null;
}

/** The shape command available beside a selected trust boundary, in the flow commands' place. */
export function BoundaryShapeCommands() {
  const { t } = useTranslator();
  return useSelectedKind() === 'trust-boundary' ? (
    <section
      aria-label={t('tools.trust-boundary')}
      className={styles.endpoints}
      data-pane=""
    >
      <CommandButton command="toggle-boundary-shape" />
    </section>
  ) : null;
}

function useSelectedKind(): Element['kind'] | undefined {
  const state = useModelStore((value) => value);
  const tool = useTool();
  return state.inlineEditor === undefined && tool.active === 'select'
    ? selectedElementRecord(state)?.kind
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
