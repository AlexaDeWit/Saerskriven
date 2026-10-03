import {
  elementsAcross,
  elementsById,
  type Element,
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
import {
  announce,
  announceRefusal,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { elementById } from '../store/selectors.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { inReviewOrder } from '../ui/review-order.js';
import { marked } from './marked.js';
import { historyFocusHandler } from './panel-focus.js';
import { PickExisting } from './pick-existing.js';
import type { RefusedField } from './refusals.js';
import { useShownOrder } from './shown-order.js';
import { ThreatEditor, type EditorFocus } from './threat-editor.js';
import styles from './threat-panel.module.css';
import { useThreatScroll } from './threat-scroll.js';
import {
  attachableThreats,
  attachedThreats,
  attachSaid,
  detachSaid,
  freshThreat,
  nextNumber,
  threatAfterDeleting,
  threatCommitter,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

/** A refused draft retained by the overlay for one element. */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

/** One element, the threats naming it, the drafts the overlay retains, and a request for focus. */
export type ElementThreatsProps = {
  readonly element: Element;
  readonly threats: readonly Threat[];
  readonly drafts: Map<ElementId, HeldDraft>;
  readonly focusing: boolean;
  readonly onFocused: () => void;
};

/**
 * The Threats tab of an element's panel: Add a threat and Attach existing,
 * then the threats naming the element, one expanded at a time and each
 * edited in place. The list is in review order as it mounts and holds that
 * order while it stays mounted, so an edit never moves the threat under
 * the pointer and a threat added meanwhile joins the end. A threat opened
 * by any route lands with its header at the top of the body.
 */
export function ElementThreats({
  element,
  threats,
  drafts,
  focusing,
  onFocused,
}: ElementThreatsProps) {
  const number = useModelStore(nextNumber);
  const registered = useModelStore((state) => state.present.threats);
  const shown = useShownOrder(inReviewOrder(threats));
  const opened = drafts.get(element.id);
  const [expanded, setExpanded] = useState<string>(opened?.threatId ?? '');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const addControl = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const scroll = useThreatScroll(list);
  const translator = useTranslator();
  const { t } = translator;
  const attachable = attachableThreats(registered, element.id, translator);
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
    if (draft === undefined) {
      drafts.delete(element.id);
    } else {
      drafts.set(element.id, draft);
    }
  }, [draft, drafts, element]);

  const restore = useCallback(
    (threatId: ThreatId) => {
      setExpanded(threatId);
      scroll.land(threatId);
      setFocus({ kind: 'title', threatId });
    },
    [scroll],
  );

  useHistoryFocus(addControl, restore);

  useEffect(() => {
    if (!focusing) {
      return;
    }
    addControl.current?.focus();
    onFocused();
  }, [focusing, onFocused]);

  const add = (): void => {
    const threat = freshThreat(number, element.id, t);
    dispatch(Action.AddThreat({ threat }));
    if (threatIn(threat.id) === undefined) {
      return;
    }
    setExpanded(threat.id);
    scroll.land(threat.id);
    setDraft(undefined);
    setFocus({ kind: 'title', threatId: threat.id });
  };

  const leave = (threatId: ThreatId): void => {
    const next = threatAfterDeleting(shown, threatId);
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
    announce(attachSaid(attached, on, presentElements()));
    return true;
  };

  const detach =
    (threat: Threat) =>
    (elementId: ElementId): void => {
      const detached = elementById(modelStore.getState(), elementId);
      dispatch(Action.DetachThreat({ threatId: threat.id, elementId }));
      const kept = threatIn(threat.id);
      const said = detachSaid(threat, detached, kept, presentElements());
      if (said !== undefined) {
        announce(said);
      }
      if (kept?.elements.includes(element.id) !== true) {
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
      if (next === undefined) {
        drafts.delete(element.id);
      } else {
        drafts.set(element.id, next);
      }
      announceRefusal(refusal, heldText);
    };

  const expand = (value: string): void => {
    if (held !== undefined && value !== held.threatId) {
      return;
    }
    if (value !== expanded) {
      resetAnnouncements();
      if (value === '') {
        scroll.keep(expanded);
      } else {
        scroll.land(value);
      }
    }
    setExpanded(value);
  };

  return (
    <>
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
              if (attach(threatId, element) && held === undefined) {
                setExpanded(threatId);
                scroll.land(threatId);
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
          onBlur={scroll.leave}
          onFocus={scroll.follow}
          onKeyDown={scroll.tab}
          onPointerDown={scroll.press}
          onValueChange={expand}
          ref={list}
          type="single"
          value={expanded}
        >
          {shown.map((threat) => (
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
              on={element.id}
              threat={threat}
            />
          ))}
        </Accordion.Root>
      )}
    </>
  );
}

function threatIn(threatId: ThreatId): Threat | undefined {
  return modelStore
    .getState()
    .present.threats.find((threat) => threat.id === threatId);
}

function presentElements(): ReadonlyMap<ElementId, Element> {
  return elementsById(elementsAcross(modelStore.getState().present.diagrams));
}

function focusIn(
  focus: PanelFocus | undefined,
  threat: Threat,
): EditorFocus | undefined {
  return focus?.threatId === threat.id ? focus.kind : undefined;
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
        const item = active?.closest<HTMLElement>(marked.threatItem)?.dataset[
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
