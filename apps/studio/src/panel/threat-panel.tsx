import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import {
  elementsAcross,
  type ElementId,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  announce,
  announceRefusal,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { historyFocusHandler } from './panel-focus.js';
import { PanelFrame } from './panel-frame.js';
import type { RefusedField } from './refusals.js';
import { ThreatEditor, type EditorFocus } from './threat-editor.js';
import styles from './threat-panel.module.css';
import {
  attachedThreats,
  elementLabel,
  freshThreat,
  nextNumber,
  threatAfterDeleting,
  threatCommitter,
  type PanelSubject,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

/** A refused draft retained by the overlay for one element. */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

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

/** Edits the selected element in place. Listboxes retain ownership of Escape. */
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
  const element = subject.kind === 'element' ? subject.element : undefined;
  const threats = useModelStore(useShallow(attachedThreats));
  const number = useModelStore(nextNumber);
  const diagrams = useModelStore((state) => state.present.diagrams);
  const opened = element === undefined ? undefined : drafts.get(element.id);
  const [expanded, setExpanded] = useState<string>(opened?.threatId ?? '');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const addControl = useRef<HTMLButtonElement>(null);
  const { t } = useTranslator();
  const held = threats.some((threat) => threat.id === draft?.threatId)
    ? draft
    : undefined;
  const focused = useCallback(() => {
    setFocus(undefined);
  }, []);

  if (draft !== undefined && held === undefined) {
    setDraft(undefined);
  }

  useEffect(() => {
    if (element === undefined) {
      return;
    }
    if (draft === undefined) {
      drafts.delete(element.id);
    } else {
      drafts.set(element.id, draft);
    }
  }, [draft, drafts, element]);

  const restore = useCallback((threatId: ThreatId) => {
    setExpanded(threatId);
    setFocus({ kind: 'title', threatId });
  }, []);

  useHistoryFocus(addControl, restore);

  useEffect(() => {
    if (!focusing) {
      return;
    }
    addControl.current?.focus();
    onFocused();
  }, [focusing, onFocused]);

  const add = (): void => {
    if (element === undefined) {
      return;
    }
    const threat = freshThreat(number, element.id, t);
    dispatch(Action.AddThreat({ threat }));
    const added = modelStore
      .getState()
      .present.threats.some((candidate) => candidate.id === threat.id);
    if (!added) {
      return;
    }
    setExpanded(threat.id);
    setDraft(undefined);
    setFocus({ kind: 'title', threatId: threat.id });
  };

  const remove = (threat: Threat): void => {
    const next = threatAfterDeleting(threats, threat.id);
    dispatch(Action.RemoveThreat({ threatId: threat.id }));
    setDraft(undefined);
    if (next === undefined) {
      addControl.current?.focus();
    } else {
      setFocus({ kind: 'disclosure', threatId: next });
    }
    const deleted = threat.number;
    announce((speak) => speak('canvas.threat-deleted', { number: deleted }));
  };

  const refused =
    (threat: Threat) =>
    (refusal: RefusedField | undefined): void => {
      const heldText =
        draft?.threatId === threat.id && draft.field === refusal?.field
          ? draft.text
          : undefined;
      const next =
        refusal === undefined ? undefined : { threatId: threat.id, ...refusal };
      setDraft(next);
      if (element !== undefined) {
        if (next === undefined) {
          drafts.delete(element.id);
        } else {
          drafts.set(element.id, next);
        }
      }
      announceRefusal(refusal, heldText);
    };

  const expand = (value: string): void => {
    if (held === undefined || value === held.threatId) {
      if (value !== expanded) {
        resetAnnouncements();
      }
      setExpanded(value);
    }
  };

  return (
    <PanelFrame
      closeLabel={t('panel.close-threats')}
      closeShortcut="close-threat-panel"
      heading={
        element === undefined
          ? t('panel.threats')
          : t('panel.threats-on', { element: elementLabel(element, t) })
      }
      label={t('panel.threats')}
      onClose={onClose}
      onCover={onCover}
      onToggleWidth={onToggleWidth}
      testId="threat-panel"
      wide={wide}
    >
      {subject.kind === 'several' ? (
        <p className={styles.instruction}>
          {t('panel.several-selected', { count: subject.count })}
        </p>
      ) : (
        <>
          <ElementPropertiesEditor
            elementId={subject.element.id}
            drafts={propertyDrafts}
          />
          <button
            className={styles.add}
            onClick={add}
            ref={addControl}
            type="button"
          >
            {t('panel.add-threat')}
          </button>
          {threats.length === 0 ? (
            <p className={styles.instruction}>{t('panel.no-threats')}</p>
          ) : (
            <Accordion.Root
              className={styles.list}
              collapsible
              onValueChange={expand}
              type="single"
              value={expanded}
            >
              {threats.map((threat) => (
                <ThreatEditor
                  attachments={elementsAcross(diagrams).filter((candidate) =>
                    threat.elements.includes(candidate.id),
                  )}
                  focus={focusIn(focus, threat)}
                  held={held?.threatId === threat.id ? held : undefined}
                  key={threat.id}
                  onChange={resetAnnouncements}
                  onCommit={threatCommitter(dispatch, threat)}
                  onDelete={() => {
                    remove(threat);
                  }}
                  onFocused={focused}
                  onRefusal={refused(threat)}
                  threat={threat}
                />
              ))}
            </Accordion.Root>
          )}
        </>
      )}
    </PanelFrame>
  );
}

function focusIn(
  focus: PanelFocus | undefined,
  threat: Threat,
): EditorFocus | undefined {
  if (focus === undefined || focus.threatId !== threat.id) {
    return undefined;
  }
  return focus.kind;
}

function useHistoryFocus(
  addControl: RefObject<HTMLButtonElement | null>,
  restore: (threatId: ThreatId) => void,
): void {
  const undone = useRef<ThreatId | undefined>(undefined);
  const toAdd = useRef(false);

  useEffect(() => {
    if (toAdd.current) {
      toAdd.current = false;
      addControl.current?.focus();
    }
  });

  useEffect(
    () =>
      historyFocusHandler(() => {
        const active = document.activeElement;
        const item =
          active?.closest<HTMLElement>('[data-threat-item]')?.dataset[
            'threatItem'
          ];
        const holder = attachedThreats(modelStore.getState()).find(
          ({ id }) => id === item,
        );
        const onAdd = active !== null && active === addControl.current;
        return () => {
          const attached = attachedThreats(modelStore.getState());
          const restored = attached.find(({ id }) => id === undone.current);
          if (
            holder !== undefined &&
            !attached.some(({ id }) => id === holder.id)
          ) {
            undone.current = holder.id;
            toAdd.current = true;
          } else if (restored !== undefined) {
            undone.current = undefined;
            if (onAdd) {
              restore(restored.id);
            }
          }
        };
      }),
    [addControl, restore],
  );
}
