import type { ModelMetadataChange } from '@saerskriven/model';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  announceRefusal,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { dispatch, useModelStore } from '../store/store.js';
import { ProseField, TextField } from '../ui/text-field.js';
import { takeModelPanelFocus } from './panel-focus.js';
import { PanelFrame } from './panel-frame.js';
import { PanelTabContent, type PanelTab } from './panel-tabs.js';
import { assumptionKind, modelTarget } from './records.js';
import { draftIn, useRefusals, type RefusedField } from './refusals.js';
import { ThreatList, type HeldDrafts } from './threat-list.js';
import { RecordGroup } from './threat-records.js';

type HeldMetadata = {
  readonly held: RefusedField | undefined;
  readonly onHeld: (draft: RefusedField | undefined) => void;
};

type ModelPanelProps = HeldMetadata & {
  readonly drafts: HeldDrafts;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onClose: () => void;
  readonly onCover?: (cover: number) => void;
};

/**
 * The panel for the model, headed by its title: every threat in the model on
 * a Threats tab, which it opens on, and the model's own fields on Details.
 * The Threats tab takes focus where the M command opened the panel, and shows
 * again for a threat asked for from outside the panel.
 */
export function ModelPanel({
  held,
  onHeld,
  drafts,
  wide,
  onToggleWidth,
  onClose,
  onCover,
}: ModelPanelProps) {
  const title = useModelStore((state) => state.present.metadata.title);
  const threatCount = useModelStore((state) => state.present.threats.length);
  const [tab, setTab] = useState<PanelTab>('threats');
  const threatsTab = useRef<HTMLButtonElement>(null);
  const showThreats = useCallback(() => {
    setTab('threats');
  }, []);
  const { t } = useTranslator();

  useEffect(() => {
    takeModelPanelFocus(() => {
      threatsTab.current?.focus();
    });
  }, []);

  return (
    <PanelFrame
      closeLabel={t('panel.close-model')}
      closeShortcut="close-model-panel"
      heading={title === '' ? t('defaults.untitled-model') : title}
      label={t('commands.label-model-panel')}
      onClose={onClose}
      onCover={onCover}
      onToggleWidth={onToggleWidth}
      tabs={{ tab, onTab: setTab, threatCount, threatsTab }}
      wide={wide}
    >
      <PanelTabContent tab={tab} value="threats">
        <ThreatList
          drafts={drafts}
          element={undefined}
          home={threatsTab}
          onRequested={showThreats}
        />
      </PanelTabContent>
      <PanelTabContent tab={tab} value="details">
        <ModelDetails held={held} onHeld={onHeld} />
      </PanelTabContent>
    </PanelFrame>
  );
}

/**
 * The model's title, description and the assumptions that apply to it. Each
 * text field commits one `SetModelMetadata` naming that field alone, and the
 * assumptions group is the threat editor's record group bound to the model.
 */
function ModelDetails({ held, onHeld }: HeldMetadata) {
  const metadata = useModelStore((state) => state.present.metadata);
  const [draft, setDraft] = useState<RefusedField | undefined>(held);
  const { refusals, note, refused } = useRefusals((refusal) => {
    const heldText = draft?.field === refusal?.field ? draft?.text : undefined;
    onHeld(refusal);
    setDraft(refusal);
    announceRefusal(refusal, heldText);
  });

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
    <>
      <TextField
        held={draftIn(draft, 'Title')}
        label={(speak) => speak('fields.title')}
        onChange={resetAnnouncements}
        onCommit={commit('title')}
        onRefused={refused('Title')}
        value={metadata.title}
      />
      <ProseField
        compact
        held={draftIn(draft, 'Description')}
        label={(speak) => speak('fields.description')}
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
    </>
  );
}
