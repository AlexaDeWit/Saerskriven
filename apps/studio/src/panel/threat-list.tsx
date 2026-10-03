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
import { useShallow } from 'zustand/react/shallow';
import {
  announce,
  announceRefusal,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { elementById } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { inReviewOrder } from '../ui/review-order.js';
import { markedWithin } from './marked.js';
import {
  arrivingThreat,
  historyFocusHandler,
  modelListHandler,
  settleArrivingThreat,
  type ThreatRequest,
} from './panel-focus.js';
import { PickExisting } from './pick-existing.js';
import type { RefusedField } from './refusals.js';
import { useShownOrder } from './shown-order.js';
import { ThreatEditor, type EditorFocus } from './threat-editor.js';
import styles from './threat-panel.module.css';
import { useThreatScroll, type ThreatScroll } from './threat-scroll.js';
import {
  attachableThreats,
  attachedThreats,
  attachSaid,
  detachSaid,
  freshThreat,
  modelThreats,
  nextNumber,
  threatAfterDeleting,
  threatCommitter,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

/** A refused draft retained by the overlay for one threat list. */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

/**
 * The refused drafts the overlay retains, one per threat list: an element's
 * under its id, and the model's under `undefined`.
 */
export type HeldDrafts = Map<ElementId | undefined, HeldDraft>;

type ListControls = {
  readonly held: HeldDraft | undefined;
  readonly attach: (threatId: ThreatId, on: Element) => boolean;
  readonly open: (threatId: ThreatId, focus: EditorFocus) => void;
};

/**
 * The element whose threats are listed, or `undefined` for every threat in
 * the model, the drafts the overlay retains, and the control focus goes to
 * where no threat is left to take it: Add a threat on an element, which the
 * list draws on that ref, and the Threats tab on the model. The model's list
 * calls `onRequested` before it opens a threat asked for from outside it.
 */
export type ThreatListProps = {
  readonly element: Element | undefined;
  readonly drafts: HeldDrafts;
  readonly home: RefObject<HTMLButtonElement | null>;
  readonly onRequested?: () => void;
};

/**
 * The Threats tab of either panel. On an element, Add a threat and Attach
 * existing, then the threats naming the element. On the model, every threat
 * in the model and no add, since a threat is added on an element. One threat
 * is expanded at a time and each is edited in place. The list is in review
 * order as it mounts and holds that order while it stays mounted, so an edit
 * never moves the threat under the pointer and a threat added meanwhile joins
 * the end. A threat opened by any route lands with its header at the top of
 * the body, the routes into the model's list from outside it
 * (`openInModelPanel`) included. A threat leaves the list when it leaves the
 * model, or on an element's list when it leaves the element.
 */
export function ThreatList({
  element,
  drafts,
  home,
  onRequested,
}: ThreatListProps) {
  const on = element?.id;
  const listed = element === undefined ? modelThreats : attachedThreats;
  const threats = useModelStore(useShallow(listed));
  const { t } = useTranslator();
  const shown = useShownOrder(inReviewOrder(threats));
  const opened = drafts.get(on);
  const [arrival] = useState(() =>
    element === undefined && opened === undefined
      ? arrivingThreat()
      : undefined,
  );
  const [expanded, setExpanded] = useState<string>(
    opened?.threatId ?? arrival?.threatId ?? '',
  );
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const list = useRef<HTMLDivElement>(null);
  const scroll = useThreatScroll(list);
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
      drafts.delete(on);
    } else {
      drafts.set(on, draft);
    }
  }, [draft, drafts, on]);

  const restore = useCallback(
    (threatId: ThreatId) => {
      setExpanded(threatId);
      scroll.land(threatId);
      setFocus({ kind: 'title', threatId });
    },
    [scroll],
  );

  useHistoryFocus(home, listed, restore);

  useRequestedThreats({
    listsModel: element === undefined,
    arrival,
    held,
    expanded,
    list,
    home,
    scroll,
    show: setExpanded,
    onRequested,
  });

  const open = (threatId: ThreatId, kind: EditorFocus): void => {
    setExpanded(threatId);
    scroll.land(threatId);
    setDraft(undefined);
    setFocus({ kind, threatId });
  };

  const leave = (threatId: ThreatId): void => {
    const next = threatAfterDeleting(shown, threatId);
    setDraft(undefined);
    if (next === undefined) {
      home.current?.focus();
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

  const attach = (threatId: ThreatId, target: Element): boolean => {
    dispatch(Action.AttachThreat({ threatId, elementId: target.id }));
    const attached = threatIn(threatId);
    if (attached?.elements.includes(target.id) !== true) {
      return false;
    }
    announce(attachSaid(attached, target, presentElements()));
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
      if (
        kept === undefined ||
        (on !== undefined && !kept.elements.includes(on))
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
      if (next === undefined) {
        drafts.delete(on);
      } else {
        drafts.set(on, next);
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
      {element !== undefined && (
        <AddThreat
          addControl={home}
          element={element}
          list={{ held, attach, open }}
        />
      )}
      {threats.length === 0 ? (
        <p className={styles.instruction}>
          {t(
            element === undefined
              ? 'panel.no-model-threats'
              : 'panel.no-threats',
          )}
        </p>
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
                const target = elementById(modelStore.getState(), elementId);
                if (target !== undefined) {
                  attach(threat.id, target);
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
              on={on}
              threat={threat}
            />
          ))}
        </Accordion.Root>
      )}
    </>
  );
}

function AddThreat({
  element,
  list,
  addControl,
}: {
  readonly element: Element;
  readonly list: ListControls;
  readonly addControl: RefObject<HTMLButtonElement | null>;
}) {
  const number = useModelStore(nextNumber);
  const registered = useModelStore((state) => state.present.threats);
  const translator = useTranslator();
  const { t } = translator;
  const attachable = attachableThreats(registered, element.id, translator);

  const add = (): void => {
    const threat = freshThreat(number, element.id, t);
    dispatch(Action.AddThreat({ threat }));
    if (threatIn(threat.id) !== undefined) {
      list.open(threat.id, 'title');
    }
  };

  return (
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
            if (list.attach(threatId, element) && list.held === undefined) {
              list.open(threatId, 'disclosure');
            }
          }}
          reason={t('fields.choose-existing-threat-first')}
        />
      )}
    </div>
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

type RequestedThreats = {
  readonly listsModel: boolean;
  readonly arrival: ThreatRequest | undefined;
  readonly held: HeldDraft | undefined;
  readonly expanded: string;
  readonly list: RefObject<HTMLElement | null>;
  readonly home: RefObject<HTMLElement | null>;
  readonly scroll: ThreatScroll;
  readonly show: (threatId: ThreatId) => void;
  readonly onRequested: (() => void) | undefined;
};

function useRequestedThreats({
  listsModel,
  arrival,
  held,
  expanded,
  list,
  home,
  scroll,
  show,
  onRequested,
}: RequestedThreats): void {
  const answered = useRef(false);

  useEffect(() => {
    if (!listsModel) {
      return;
    }
    settleArrivingThreat();
    if (arrival === undefined) {
      return;
    }
    scroll.land(arrival.threatId);
    if (!answered.current) {
      answered.current = true;
      arrival.opened();
    }
  }, [arrival, listsModel, scroll]);

  useEffect(() => {
    if (!listsModel) {
      return undefined;
    }
    return modelListHandler({
      open: ({ threatId, opened }) => {
        if (held !== undefined && held.threatId !== threatId) {
          return;
        }
        onRequested?.();
        show(threatId);
        scroll.land(threatId);
        opened();
      },
      focus: () => {
        const summary = markedWithin(
          list.current,
          'threatItem',
          expanded,
        )?.querySelector<HTMLElement>(`.${styles.disclosure}`);
        if (
          summary !== undefined &&
          summary !== null &&
          summary.closest('[hidden]') === null
        ) {
          summary.focus();
        } else {
          home.current?.focus();
        }
      },
    });
  }, [expanded, held, home, list, listsModel, onRequested, scroll, show]);
}

function useHistoryFocus(
  home: RefObject<HTMLElement | null>,
  listed: (state: State) => readonly Threat[],
  restore: (threatId: ThreatId) => void,
): void {
  const undone = useRef<ThreatId | undefined>(undefined);
  const toHome = useRef(false);

  useEffect(() => {
    if (toHome.current) {
      toHome.current = false;
      home.current?.focus();
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
        const holder = listed(modelStore.getState()).find(
          ({ id }) => id === item,
        );
        const onHome = active !== null && active === home.current;
        return () => {
          const present = listed(modelStore.getState());
          const restored = present.find(({ id }) => id === undone.current);
          if (
            holder !== undefined &&
            !present.some(({ id }) => id === holder.id)
          ) {
            undone.current = holder.id;
            toHome.current = true;
          } else if (restored !== undefined) {
            undone.current = undefined;
            if (onHome) {
              restore(restored.id);
            }
          }
        };
      }),
    [home, listed, restore],
  );
}
