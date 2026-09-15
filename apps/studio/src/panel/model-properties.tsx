import type { ModelMetadataChange } from '@saerskriven/model';
import { useEffect, useRef, useState } from 'react';
import { announce, resetAnnouncements } from '../canvas/announcements.js';
import { Action } from '../store/actions.js';
import { dispatch, useModelStore } from '../store/store.js';
import { ProseField, TextField } from '../ui/text-field.js';
import { modelPropertiesFocusHandler } from './panel-focus.js';
import { PanelFrame } from './panel-frame.js';
import { assumptionKind, modelTarget } from './records.js';
import { draftIn, useRefusals, type RefusedField } from './refusals.js';
import { RecordGroup } from './threat-records.js';

/** The refused draft the overlay keeps past the panel, and the pane controls every panel takes. */
export type ModelPropertiesPanelProps = {
  readonly held: RefusedField | undefined;
  readonly onHeld: (draft: RefusedField | undefined) => void;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onClose: () => void;
  readonly onCover?: (cover: number) => void;
};

/**
 * The model's title, description and the assumptions that apply to it. Each
 * text field commits one `SetModelMetadata` naming that field alone, and the
 * assumptions group is the threat editor's record group bound to the model.
 */
export function ModelPropertiesPanel({
  held,
  onHeld,
  wide,
  onToggleWidth,
  onClose,
  onCover,
}: ModelPropertiesPanelProps) {
  const metadata = useModelStore((state) => state.present.metadata);
  const titleField = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<RefusedField | undefined>(held);
  const { refusals, note, refused } = useRefusals((refusal) => {
    const alreadyHeld =
      refusal !== undefined &&
      draft?.field === refusal.field &&
      draft.text === refusal.text;
    onHeld(refusal);
    setDraft(refusal);
    if (refusal !== undefined && !alreadyHeld) {
      announce(refusal.said);
    }
  });

  useEffect(
    () =>
      modelPropertiesFocusHandler(() => {
        titleField.current?.focus();
      }),
    [],
  );

  const commit =
    (field: 'title' | 'description') =>
    (text: string): void => {
      if (metadata[field] === text) {
        return;
      }
      const change: ModelMetadataChange =
        field === 'title' ? { title: text } : { description: text };
      dispatch(Action.SetModelMetadata({ change }));
    };

  return (
    <PanelFrame
      closeLabel="Close model properties"
      closeShortcut="close-model-properties"
      heading="Model properties"
      label="Model properties"
      onClose={onClose}
      onCover={onCover}
      onToggleWidth={onToggleWidth}
      wide={wide}
    >
      <TextField
        held={draftIn(draft, 'Title')}
        label="Title"
        onChange={resetAnnouncements}
        onCommit={commit('title')}
        onRefused={refused('Title')}
        ref={titleField}
        value={metadata.title}
      />
      <ProseField
        held={draftIn(draft, 'Description')}
        label="Description"
        onChange={resetAnnouncements}
        onCommit={commit('description')}
        onRefused={refused('Description')}
        value={metadata.description}
      />
      <RecordGroup
        held={draft}
        kind={assumptionKind}
        onChange={resetAnnouncements}
        onRefused={note}
        refusals={refusals}
        target={modelTarget}
      />
    </PanelFrame>
  );
}
