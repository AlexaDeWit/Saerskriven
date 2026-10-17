import {
  elementsById,
  flowEnds,
  type Element,
  type ElementId,
} from '@saerskriven/model';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { closingOn } from '../commands/binding.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { diagramTitle } from '../messages/diagram-title.js';
import { kindMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import { distinctTexts, optionName } from '../panel/distinct-labels.js';
import { labelledElement } from '../panel/threats.js';
import { activeDiagram, activeDiagramId } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import type { OptionText } from '../ui/enum-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  addExisting,
  cancelAddExisting,
  closeAddExisting,
  existingEntries,
  focusAddExisting,
  usePickerMode,
  type ExistingEntry,
} from './add-existing.js';
import { spokenElement } from './announcements.js';
import { focusElement } from './edits.js';
import { mergeEntries, mergeInto } from './merge-into.js';
import { flowEndsText } from './names.js';
import styles from './add-existing-picker.module.css';

/**
 * The picker under the chrome card, mounted only while it is open. Each entry
 * is one box naming an element and the diagrams it is on, and the box is the
 * control: a click anywhere on it, or Space or Enter, picks it. For Add
 * existing element each box is a toggle button for an element the diagram on
 * screen does not place, which the same again puts back, and Add places the
 * ones picked at the centre of the view. For Merge an element into this one
 * each box is filled by a native radio button, for every other element of the
 * kind of the one kept, so the arrow keys choose as they move, and Merge
 * merges the one picked into it, focus going to the element kept even where
 * the merge is refused. Each list is a group the picker's heading names. It
 * goes away when another diagram is shown. Escape and Cancel put either away
 * and hand focus back.
 */
export function AddExistingPicker() {
  const mode = usePickerMode();
  if (mode === undefined) {
    return null;
  }
  return mode.kind === 'add' ? (
    <AddPicker />
  ) : (
    <MergePicker into={mode.into} key={mode.into} />
  );
}

const cancelOnEscape = closingOn('close-add-existing', cancelAddExisting);

function AddPicker() {
  const model = useModelStore((state) => state.present);
  const diagram = useModelStore(activeDiagram);
  const flow = useReactFlow();
  const view = useStoreApi();
  const [picked, setPicked] = useState<ReadonlySet<ElementId>>(() => new Set());
  const headingId = useId();
  const { t } = useTranslator();

  const entries =
    diagram === undefined ? [] : existingEntries(model, diagram.id);
  const elements = elementsById(model.elements);
  const chosen = entries
    .map(({ element }) => element.id)
    .filter((id) => picked.has(id));

  const toggle = (id: ElementId): void => {
    setPicked((held) => {
      const next = new Set(held);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };

  const add = (): void => {
    if (chosen.length === 0) {
      return;
    }
    const { x, y, zoom } = flow.getViewport();
    const { width, height } = view.getState();
    closeAddExisting();
    addExisting(chosen, {
      x: (width / 2 - x) / zoom,
      y: (height / 2 - y) / zoom,
    });
  };

  return (
    <PickerFrame
      action={
        chosen.length === 0
          ? t('panel.add')
          : t('tools.add-picked', { count: chosen.length })
      }
      heading={t('commands.label-add-existing')}
      headingId={headingId}
      onAction={add}
      ready={chosen.length > 0}
      unready={t('tools.pick-existing-first')}
    >
      {entries.length === 0 ? (
        <p className={styles.none}>
          {t('canvas.nothing-to-add', {
            diagram: diagramTitle(diagram?.title ?? '', t),
          })}
        </p>
      ) : (
        <fieldset aria-labelledby={headingId} className={styles.group}>
          <div className={styles.choices}>
            {labelledEntries(entries, elements, t).map(([entry, text]) => (
              <ToggleEntry
                elements={elements}
                entry={entry}
                key={entry.element.id}
                onToggle={toggle}
                pressed={picked.has(entry.element.id)}
                text={text}
              />
            ))}
          </div>
        </fieldset>
      )}
    </PickerFrame>
  );
}

function MergePicker({ into }: { readonly into: ElementId }) {
  const model = useModelStore((state) => state.present);
  const shown = useModelStore(activeDiagramId);
  const [openedOn] = useState(shown);
  const [chosen, setChosen] = useState<ElementId | undefined>(undefined);
  const headingId = useId();
  const group = useId();
  const { t } = useTranslator();

  useEffect(() => {
    if (shown !== openedOn) {
      closeAddExisting();
    }
  }, [shown, openedOn]);

  const kept = model.elements.find(({ id }) => id === into);
  const entries = mergeEntries(model, into);
  const elements = elementsById(model.elements);
  const picked = entries.some(({ element }) => element.id === chosen)
    ? chosen
    : undefined;

  const merge = (): void => {
    if (picked === undefined) {
      return;
    }
    closeAddExisting();
    if (!mergeInto(picked, into)) {
      focusElement(into);
    }
  };

  return (
    <PickerFrame
      action={t('tools.merge')}
      heading={t('tools.merge-into', {
        name: kept === undefined ? '' : spokenElement(t, kept),
      })}
      headingId={headingId}
      onAction={merge}
      ready={picked !== undefined}
      unready={t('tools.pick-merge-first')}
    >
      {entries.length === 0 ? (
        <p className={styles.none}>{t('tools.nothing-to-merge')}</p>
      ) : (
        <fieldset aria-labelledby={headingId} className={styles.group}>
          <div className={styles.choices}>
            {labelledEntries(entries, elements, t).map(([entry, text]) => (
              <RadioEntry
                checked={entry.element.id === picked}
                elements={elements}
                entry={entry}
                group={group}
                key={entry.element.id}
                onChoose={setChosen}
                text={text}
              />
            ))}
          </div>
        </fieldset>
      )}
    </PickerFrame>
  );
}

function PickerFrame({
  action,
  children,
  heading,
  headingId,
  onAction,
  ready,
  unready,
}: {
  readonly action: string;
  readonly children: ReactNode;
  readonly heading: string;
  readonly headingId: string;
  readonly onAction: () => void;
  readonly ready: boolean;
  readonly unready: string;
}) {
  const reasonId = useId();
  const { t } = useTranslator();

  useEffect(() => {
    focusAddExisting();
  }, []);

  return (
    <section
      aria-labelledby={headingId}
      className={styles.picker}
      data-add-existing=""
      onKeyDownCapture={cancelOnEscape}
    >
      <h2 className={styles.heading} id={headingId}>
        {heading}
      </h2>
      {children}
      <div className={styles.actions}>
        <button
          aria-describedby={ready ? undefined : reasonId}
          aria-disabled={!ready}
          className={styles.action}
          onClick={onAction}
          type="button"
        >
          {action}
        </button>
        <button
          className={styles.action}
          onClick={cancelAddExisting}
          type="button"
        >
          {t('tools.cancel')}
        </button>
      </div>
      {!ready && <VisuallyHidden id={reasonId}>{unready}</VisuallyHidden>}
    </section>
  );
}

function labelledEntries(
  entries: readonly ExistingEntry[],
  elements: ReadonlyMap<ElementId, Element>,
  t: StudioTranslator['t'],
): readonly (readonly [ExistingEntry, OptionText])[] {
  return distinctTexts(
    entries.map((entry) => ({
      ...labelledElement(entry.element, elements, t),
      entry,
    })),
  ).map(([{ entry }, text]) => [entry, text]);
}

type EntryProps = {
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly entry: ExistingEntry;
  readonly text: OptionText;
};

function ToggleEntry({
  onToggle,
  pressed,
  ...lines
}: EntryProps & {
  readonly onToggle: (id: ElementId) => void;
  readonly pressed: boolean;
}) {
  const nameId = useId();
  const detailId = useId();
  return (
    <button
      aria-describedby={detailId}
      aria-labelledby={nameId}
      aria-pressed={pressed}
      className={styles.entry}
      onClick={() => {
        onToggle(lines.entry.element.id);
      }}
      type="button"
    >
      <EntryLines {...lines} detailId={detailId} nameId={nameId} />
    </button>
  );
}

function RadioEntry({
  checked,
  group,
  onChoose,
  ...lines
}: EntryProps & {
  readonly checked: boolean;
  readonly group: string;
  readonly onChoose: (id: ElementId) => void;
}) {
  const nameId = useId();
  const detailId = useId();
  const choose = (): void => {
    onChoose(lines.entry.element.id);
  };
  return (
    <label className={styles.entry}>
      <input
        aria-describedby={detailId}
        aria-labelledby={nameId}
        checked={checked}
        className={styles.fill}
        name={group}
        onChange={choose}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            choose();
          }
        }}
        type="radio"
      />
      <EntryLines {...lines} detailId={detailId} nameId={nameId} />
    </label>
  );
}

function EntryLines({
  detailId,
  elements,
  entry,
  nameId,
  text,
}: EntryProps & { readonly detailId: string; readonly nameId: string }) {
  const { t } = useTranslator();
  const { element, diagrams } = entry;
  const what =
    element.kind === 'flow'
      ? flowEndsText(flowEnds(element, elements), t)
      : t(kindMessages[element.kind]);
  return (
    <>
      <span id={nameId}>{optionName(text)}</span>
      <span className={styles.detail} id={detailId}>
        {t('tools.existing-detail', {
          what,
          diagrams: diagrams.map(({ title }) => diagramTitle(title, t)),
        })}
      </span>
    </>
  );
}
