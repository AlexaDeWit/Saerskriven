import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import type { Element, ElementId, Threat, ThreatId } from '@saerskriven/model';
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
import { elementById } from '../store/selectors.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { useHeaderKept } from './kept-header.js';
import { PickExisting } from './pick-existing.js';
import { historyFocusHandler } from './panel-focus.js';
import { PanelFrame } from './panel-frame.js';
import type { RefusedField } from './refusals.js';
import { ThreatEditor, type EditorFocus } from './threat-editor.js';
import styles from './threat-panel.module.css';
import {
  attachableThreats,
  attachedThreats,
  detachSaid,
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
  const registered = useModelStore((state) => state.present.threats);
  const opened = element === undefined ? undefined : drafts.get(element.id);
  const [expanded, setExpanded] = useState<string>(opened?.threatId ?? '');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const addControl = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const keepHeader = useHeaderKept(list);
  const translator = useTranslator();
  const { t } = translator;
  const attachable =
    element === undefined
      ? []
      : attachableThreats(registered, element.id, translator);
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

  const leave = (threatId: ThreatId): void => {
    const next = threatAfterDeleting(threats, threatId);
    setDraft(undefined);
    if (next === undefined) {
      addControl.current?.focus();
    } else {
      setFocus({ kind: 'disclosure', threatId: next });
    }
  };

  const remove = (threat: Threat): void => {
    dispatch(Action.RemoveThreat({ threatId: threat.id }));
    leave(threat.id);
    const deleted = threat.number;
    announce((speak) => speak('canvas.threat-deleted', { number: deleted }));
  };

  const attach = (threatId: ThreatId, on: Element): boolean => {
    dispatch(Action.AttachThreat({ threatId, elementId: on.id }));
    const attached = threatIn(threatId);
    if (attached?.elements.includes(on.id) !== true) {
      return false;
    }
    const attachedNumber = attached.number;
    announce((speak) =>
      speak('canvas.threat-attached', {
        number: attachedNumber,
        element: elementLabel(on, speak),
      }),
    );
    return true;
  };

  const detach =
    (threat: Threat) =>
    (elementId: ElementId): void => {
      const detached = elementById(modelStore.getState(), elementId);
      dispatch(Action.DetachThreat({ threatId: threat.id, elementId }));
      const kept = threatIn(threat.id);
      const said = detachSaid(threat, detached, kept);
      if (said !== undefined) {
        announce(said);
      }
      if (
        element !== undefined &&
        kept?.elements.includes(element.id) !== true
      ) {
        leave(threat.id);
      }
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
    if (held !== undefined && value !== held.threatId) {
      return;
    }
    if (value !== expanded) {
      resetAnnouncements();
      keepHeader(value === '' ? expanded : value);
    }
    setExpanded(value);
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
          <div className={styles.addLink}>
            <button
              className={styles.add}
              onClick={add}
              ref={addControl}
              type="button"
            >
              {t('panel.add-threat')}
            </button>
            {attachable.length > 0 && (
              <PickExisting
                actionLabel={t('fields.attach-existing-threat')}
                actionText={t('panel.attach')}
                choices={attachable}
                fieldLabel={t('fields.existing-threat')}
                onPick={(threatId) => {
                  if (attach(threatId, subject.element) && held === undefined) {
                    setExpanded(threatId);
                    setFocus({ kind: 'disclosure', threatId });
                  }
                }}
                reason={t('fields.choose-existing-threat-first')}
              />
            )}
          </div>
          {threats.length === 0 ? (
            <p className={styles.instruction}>{t('panel.no-threats')}</p>
          ) : (
            <Accordion.Root
              className={styles.list}
              collapsible
              onValueChange={expand}
              ref={list}
              type="single"
              value={expanded}
            >
              {threats.map((threat) => (
                <ThreatEditor
                  focus={focusIn(focus, threat)}
                  held={held?.threatId === threat.id ? held : undefined}
                  key={threat.id}
                  onAttach={(elementId) => {
                    const on = elementById(modelStore.getState(), elementId);
                    if (on !== undefined) {
                      attach(threat.id, on);
                    }
                  }}
                  onChange={resetAnnouncements}
                  onCommit={threatCommitter(dispatch, threat)}
                  onDelete={() => {
                    remove(threat);
                  }}
                  onDetach={detach(threat)}
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

function threatIn(threatId: ThreatId): Threat | undefined {
  return modelStore
    .getState()
    .present.threats.find((threat) => threat.id === threatId);
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
