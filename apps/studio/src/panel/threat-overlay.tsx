import type { ElementPropertyDrafts } from './element-properties.js';
import { memo, useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { focusElement } from '../canvas/edits.js';
import { selectedElements } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { ModelPanel } from './model-panel.js';
import { hideModelPanel, panelFocusHandler } from './panel-focus.js';
import type { RefusedField } from './refusals.js';
import type { HeldDrafts } from './threat-list.js';
import { ThreatPanel } from './threat-panel.js';
import { openFileName, panelSubject } from './threats.js';

type Held = {
  readonly file: string | undefined;
  readonly drafts: HeldDrafts;
  readonly propertyDrafts: ElementPropertyDrafts;
  readonly model: RefusedField | undefined;
};

const freshHeld = (file: string | undefined): Held => ({
  file,
  drafts: new Map(),
  propertyDrafts: new Map(),
  model: undefined,
});

/** Draws the pane for the selection or the model, retaining drafts and pane width across both. Canvas-only parent renders do not rerender the pane. */
export const ThreatOverlay = memo(function ThreatOverlay({
  onCover,
}: {
  readonly onCover?: (cover: number) => void;
}) {
  const subject = useModelStore(useShallow(panelSubject));
  const file = useModelStore(openFileName);
  const [held, setHeld] = useState<Held>(() => freshHeld(file));
  const selection = useModelStore(selectedElements);
  const selectionKey = selection.join(':');
  const [closed, setClosed] = useState<string | undefined>(undefined);
  const [wide, setWide] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const selected = subject?.kind === 'element' ? subject.element.id : undefined;

  if (closed !== undefined && closed !== selectionKey) {
    setClosed(undefined);
  }

  if (held.file !== file) {
    setHeld(freshHeld(file));
  }

  const take = useCallback((): boolean => {
    if (subject?.kind !== 'element') {
      return false;
    }
    setClosed(undefined);
    setFocusing(true);
    return true;
  }, [subject]);

  const heldModel = useCallback((draft: RefusedField | undefined) => {
    setHeld((current) =>
      current.model === draft ? current : { ...current, model: draft },
    );
  }, []);

  const focused = useCallback(() => {
    setFocusing(false);
  }, []);

  const close = useCallback(() => {
    setClosed(selectionKey);
    const target = selection[0];
    if (target !== undefined) {
      focusElement(target);
    }
  }, [selection, selectionKey]);

  useEffect(() => panelFocusHandler(take), [take]);

  if (
    subject === undefined ||
    (closed !== undefined && closed === selectionKey)
  ) {
    return null;
  }

  if (subject.kind === 'model') {
    return (
      <ModelPanel
        drafts={held.drafts}
        held={held.model}
        onHeld={heldModel}
        onClose={hideModelPanel}
        onCover={onCover}
        onToggleWidth={() => {
          setWide((value) => !value);
        }}
        wide={wide}
      />
    );
  }

  return (
    <ThreatPanel
      drafts={held.drafts}
      propertyDrafts={held.propertyDrafts}
      focusing={focusing}
      key={selected ?? 'several'}
      onClose={close}
      onCover={onCover}
      wide={wide}
      onToggleWidth={() => {
        setWide((value) => !value);
      }}
      onFocused={focused}
      subject={subject}
    />
  );
});
