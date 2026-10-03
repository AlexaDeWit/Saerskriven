import { elementsAcross, elementsById } from '@saerskriven/model';
import { useEffect, useRef, useState } from 'react';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import { PanelFrame } from './panel-frame.js';
import { PanelTabContent, type PanelTab } from './panel-tabs.js';
import { ThreatList, type HeldDrafts } from './threat-list.js';
import styles from './threat-panel.module.css';
import {
  attachedThreats,
  elementHeading,
  type PanelSubject,
} from './threats.js';

/** The selected subject, retained drafts, focus, and pane controls. */
export type ThreatPanelProps = {
  readonly subject: Exclude<PanelSubject, { readonly kind: 'model' }>;
  readonly drafts: HeldDrafts;
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
  const threatCount = useModelStore((state) => attachedThreats(state).length);
  const diagrams = useModelStore((state) => state.present.diagrams);
  const [tab, setTab] = useState<PanelTab>('threats');
  const addControl = useRef<HTMLButtonElement>(null);
  const { t } = useTranslator();

  if (focusing && tab !== 'threats') {
    setTab('threats');
  }

  useEffect(() => {
    if (!focusing) {
      return;
    }
    addControl.current?.focus();
    onFocused();
  }, [focusing, onFocused]);

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
      heading={elementHeading(
        element,
        elementsById(elementsAcross(diagrams)),
        t,
      )}
      tabs={{ tab, onTab: setTab, threatCount }}
    >
      <PanelTabContent tab={tab} value="threats">
        <ThreatList drafts={drafts} element={element} home={addControl} />
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
