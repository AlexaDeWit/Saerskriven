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
import {
  changedModel,
  dispatch,
  modelStore,
  useModelStore,
} from '../store/store.js';
import { inReviewOrder } from '../ui/review-order.js';
import { refusedFieldSelector } from '../ui/text-field.js';
import { marked, markedWithin } from './marked.js';
import {
  arrivingThreat,
  historyFocusHandler,
  modelListHandler,
  settleArrivingThreat,
  type ListFocus,
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
  registeredThreats,
  removedSaid,
  threatAfterDeleting,
  threatCommitter,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

/** A refused draft retained by the overlay for one threat list. */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

/** Retained refusals use an element's id or `undefined` for the global editor. */
export type HeldDrafts = Map<ElementId | undefined, HeldDraft>;

type ListControls = {
  readonly held: HeldDraft | undefined;
  readonly attach: (threatId: ThreatId, on: Element) => boolean;
  readonly open: (threatId: ThreatId, focus: EditorFocus) => void;
  readonly focus: (on: ListFocus) => void;
};

/** `home` receives focus after the last threat leaves, and requests reveal the editor's tab. */
export type ThreatListProps = {
  readonly element: Element | undefined;
  readonly drafts: HeldDrafts;
  readonly home: RefObject<HTMLButtonElement | null>;
  readonly onRequested?: () => void;
  readonly onDetails?: () => void;
};

/** Edits contextual threats or a Register choice while retaining refused drafts. */
export function ThreatList({
  element,
  drafts,
  home,
  onRequested,
  onDetails,
}: ThreatListProps) {
  const on = element?.id;
  const listed = element === undefined ? registeredThreats : attachedThreats;
  const contextual = element === undefined ? modelThreats : attachedThreats;
  const threats = useModelStore(useShallow(listed));
  const context = useModelStore(useShallow(contextual));
  const { t } = useTranslator();
  const shown = useShownOrder(inReviewOrder(context));
  const opened = drafts.get(on);
  const [arrival] = useState(() => {
    const asked = element === undefined ? arrivingThreat() : undefined;
    return heldOnAnother(opened, asked?.threatId) ? undefined : asked;
  });
  const [expanded, setExpanded] = useState<string>(
    opened?.threatId ?? arrival?.threatId ?? '',
  );
  const [chosen, setChosen] = useState<ThreatId | undefined>(
    arrival?.threatId ??
      (opened !== undefined && !context.some(({ id }) => id === opened.threatId)
        ? opened.threatId
        : undefined),
  );
  const show = useCallback((threatId: ThreatId | '') => {
    setExpanded(threatId);
    if (threatId !== '') {
      setChosen((previous) => (previous === undefined ? undefined : threatId));
    }
  }, []);
  const choose = useCallback((threatId: ThreatId) => {
    setChosen(threatId);
    setExpanded(threatId);
  }, []);
  const editing = threats.find(({ id }) => id === expanded);
  const drawn =
    element !== undefined
      ? shown
      : chosen !== undefined
        ? threats.filter((threat) => threat.id === chosen)
        : editing !== undefined && !context.some(({ id }) => id === editing.id)
          ? [...shown, editing]
          : shown;
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
      if (heldOnAnother(held, threatId)) {
        return;
      }
      show(threatId);
      scroll.land(threatId);
      setFocus({ kind: 'title', threatId });
    },
    [held, scroll, show],
  );

  const focusOn = useCallback(
    (where: ListFocus) => {
      if (where === 'details') {
        home.current
          ?.closest('[data-pane]')
          ?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) input')
          ?.focus();
        return;
      }
      const target =
        (where === 'refusal'
          ? list.current?.querySelector<HTMLElement>(refusedFieldSelector)
          : undefined) ??
        markedWithin(
          list.current,
          'threatItem',
          expanded,
        )?.querySelector<HTMLElement>(`.${styles.disclosure}`);
      if (
        target !== undefined &&
        target !== null &&
        target.closest('[hidden]') === null
      ) {
        target.focus();
      } else {
        home.current?.focus();
      }
    },
    [expanded, home],
  );

  useHistoryFocus(home, listed, restore);

  useRequestedThreats({
    listsModel: element === undefined,
    arrival,
    held,
    expanded,
    list,
    scroll,
    show: choose,
    focus: focusOn,
    onRequested,
    onDetails,
  });

  const open = (threatId: ThreatId, kind: EditorFocus): void => {
    show(threatId);
    scroll.land(threatId);
    setFocus({ kind, threatId });
  };

  const leave = (threatId: ThreatId): void => {
    const next =
      threatAfterDeleting(shown, threatId) ??
      shown.find(({ id }) => id !== threatId)?.id;
    setDraft(undefined);
    if (element === undefined) {
      setExpanded('');
      setChosen(next);
    }
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

  const linkToModel =
    (threat: Threat) =>
    (applies: boolean): void => {
      const threatId = threat.id;
      const changed = changedModel(
        applies
          ? Action.LinkThreatToModel({ threatId })
          : Action.UnlinkThreatFromModel({ threatId }),
      );
      if (changed && threatIn(threatId) === undefined) {
        announce(removedSaid(threat));
        leave(threatId);
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
    if (heldOnAnother(held, value)) {
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
    show(threats.find((threat) => threat.id === value)?.id ?? '');
  };

  return (
    <>
      <AddThreat
        addControl={element === undefined ? undefined : home}
        element={element}
        list={{ held, attach, open, focus: focusOn }}
      />
      {drawn.length === 0 ? (
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
          {drawn.map((threat) => (
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
              onModelLink={linkToModel(threat)}
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
  readonly element: Element | undefined;
  readonly list: ListControls;
  readonly addControl: RefObject<HTMLButtonElement | null> | undefined;
}) {
  const number = useModelStore(nextNumber);
  const { t } = useTranslator();

  const add = (): void => {
    const threat = freshThreat(number, element?.id, t);
    if (heldOnAnother(list.held, threat.id)) {
      list.focus('refusal');
      return;
    }
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
      {element !== undefined && (
        <AttachExisting element={element} list={list} />
      )}
    </div>
  );
}

function AttachExisting({
  element,
  list,
}: {
  readonly element: Element;
  readonly list: ListControls;
}) {
  const registered = useModelStore((state) => state.present.threats);
  const translator = useTranslator();
  const { t } = translator;
  const attachable = attachableThreats(registered, element.id, translator);

  return attachable.length === 0 ? null : (
    <PickExisting
      actionLabel={t('fields.attach-existing-threat')}
      actionText={t('panel.attach')}
      choices={attachable}
      fieldLabel={t('fields.existing-threat')}
      onPick={(threatId) => {
        if (
          list.attach(threatId, element) &&
          !heldOnAnother(list.held, threatId)
        ) {
          list.open(threatId, 'disclosure');
        }
      }}
      reason={t('fields.choose-existing-threat-first')}
    />
  );
}

function attach(threatId: ThreatId, target: Element): boolean {
  dispatch(Action.AttachThreat({ threatId, elementId: target.id }));
  const attached = threatIn(threatId);
  if (attached?.elements.includes(target.id) !== true) {
    return false;
  }
  announce(attachSaid(attached, target, presentElements()));
  return true;
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

function heldOnAnother(
  held: HeldDraft | undefined,
  threatId: string | undefined,
): boolean {
  return held !== undefined && held.threatId !== threatId;
}

type RequestedThreats = {
  readonly listsModel: boolean;
  readonly arrival: ThreatRequest | undefined;
  readonly held: HeldDraft | undefined;
  readonly expanded: string;
  readonly list: RefObject<HTMLElement | null>;
  readonly scroll: ThreatScroll;
  readonly show: (threatId: ThreatId) => void;
  readonly focus: (on: ListFocus) => void;
  readonly onRequested: (() => void) | undefined;
  readonly onDetails: (() => void) | undefined;
};

function useRequestedThreats({
  listsModel,
  arrival,
  held,
  expanded,
  list,
  scroll,
  show,
  focus,
  onRequested,
  onDetails,
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
        if (heldOnAnother(held, threatId)) {
          return;
        }
        onRequested?.();
        show(threatId);
        scroll.land(threatId);
        opened();
      },
      showTab: () => {
        onRequested?.();
      },
      showDetails: () => {
        onDetails?.();
      },
      focus,
      hidden: (threatId) => {
        const drawn = list.current;
        if (drawn === null || getComputedStyle(drawn).visibility !== 'hidden') {
          return undefined;
        }
        if (heldOnAnother(held, threatId)) {
          return 'refused';
        }
        return threatId === expanded ? 'opened' : undefined;
      },
    });
  }, [
    expanded,
    focus,
    held,
    list,
    listsModel,
    onDetails,
    onRequested,
    scroll,
    show,
  ]);
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
        const item = active?.closest<HTMLElement>(marked.threatItem)?.dataset[
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
