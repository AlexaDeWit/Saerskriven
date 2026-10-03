import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import {
  elementsAcross,
  elementsById,
  type ElementId,
} from '@saerskriven/model';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { ElementThreats, type HeldDraft } from './element-threats.js';
import { PanelFrame } from './panel-frame.js';
import { PanelTabContent, type PanelTab } from './panel-tabs.js';
import styles from './threat-panel.module.css';
import { attachedThreats, elementLabel, type PanelSubject } from './threats.js';

/** The selected subject, retained drafts, focus, and pane controls. */
export type ThreatPanelProps = {
  readonly subject: Exclude<PanelSubject, { readonly kind: 'model' }>;
  readonly drafts: Map<ElementId, HeldDraft>;
  readonly propertyDrafts?: ElementPropertyDrafts;
  readonly focusing: boolean;
  readonly onFocused: () => void;
  readonly onClose: () => void;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onCover?: (cover: number) => void;
};

/**
 * The panel for a selection, headed by the element's name: its threats on
 * one tab, which every selection opens on, and its own fields on Details.
 * Several selected elements get a count and no tabs.
 */
export function ThreatPanel({
  subject,
  drafts,
  propertyDrafts,
  focusing,
  onFocused,
  onClose,
  wide,
  onToggleWidth,
  onCover,
}: ThreatPanelProps) {
  const threats = useModelStore(useShallow(attachedThreats));
  const diagrams = useModelStore((state) => state.present.diagrams);
  const [tab, setTab] = useState<PanelTab>('threats');
  const { t } = useTranslator();

  if (focusing && tab !== 'threats') {
    setTab('threats');
  }

  const frame = {
    closeLabel: t('panel.close-threats'),
    closeShortcut: 'close-threat-panel',
    label: t('panel.threats'),
    onClose,
    onCover,
    onToggleWidth,
    testId: 'threat-panel',
    wide,
  } as const;

  if (subject.kind === 'several') {
    return (
      <PanelFrame {...frame} heading={t('panel.threats')}>
        <p className={styles.instruction}>
          {t('panel.several-selected', { count: subject.count })}
        </p>
      </PanelFrame>
    );
  }

  const { element } = subject;
  return (
    <PanelFrame
      {...frame}
      heading={elementLabel(element, elementsById(elementsAcross(diagrams)), t)}
      tabs={{ tab, onTab: setTab, threatCount: threats.length }}
    >
      <PanelTabContent tab={tab} value="threats">
        <ElementThreats
          drafts={drafts}
          element={element}
          focusing={focusing}
          onFocused={onFocused}
          threats={threats}
        />
      </PanelTabContent>
      <PanelTabContent tab={tab} value="details">
        <ElementPropertiesEditor
          drafts={propertyDrafts}
          elementId={element.id}
        />
      </PanelTabContent>
    </PanelFrame>
  );
}
