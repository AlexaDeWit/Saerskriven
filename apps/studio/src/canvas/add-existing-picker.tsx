import {
  elementsById,
  flowEnds,
  type Element,
  type ElementId,
} from '@saerskriven/model';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { closingOn } from '../commands/binding.js';
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
 * The picker under the chrome card, mounted only while it is open. For Add
 * existing element it holds a checkbox for each element and each flow the
 * diagram on screen does not place, and Add places the ones picked at the
 * centre of the view. For Merge an element into this one it holds a radio
 * button for each other element of the kind of the one kept, and Merge
 * merges the one picked into it, focus going to the element kept even where
 * the merge is refused. It goes away when another diagram is shown. Escape
 * and Cancel put either away and hand focus back.
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
  const { t } = useTranslator();

  const entries =
    diagram === undefined
      ? { elements: [], flows: [] }
      : existingEntries(model, diagram.id);
  const chosen = [...entries.elements, ...entries.flows]
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
      onAction={add}
      ready={chosen.length > 0}
      unready={t('tools.pick-existing-first')}
    >
      {entries.elements.length === 0 && entries.flows.length === 0 ? (
        <p className={styles.none}>
          {t('canvas.nothing-to-add', {
            diagram: diagramTitle(diagram?.title ?? '', t),
          })}
        </p>
      ) : (
        <div className={styles.choices}>
          <EntryGroup
            entries={entries.elements}
            legend={t('tools.existing-elements')}
            model={model.elements}
            onToggle={toggle}
            picked={picked}
          />
          <EntryGroup
            entries={entries.flows}
            legend={t('tools.existing-flows')}
            model={model.elements}
            onToggle={toggle}
            picked={picked}
          />
        </div>
      )}
    </PickerFrame>
  );
}

function MergePicker({ into }: { readonly into: ElementId }) {
  const model = useModelStore((state) => state.present);
  const shown = useModelStore(activeDiagramId);
  const [openedOn] = useState(shown);
  const [chosen, setChosen] = useState<ElementId | undefined>(undefined);
  const group = useId();
  const { t } = useTranslator();

  useEffect(() => {
    if (shown !== openedOn) {
      closeAddExisting();
    }
  }, [shown, openedOn]);

  const kept = model.elements.find(({ id }) => id === into);
  const entries = mergeEntries(model, into);
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
      onAction={merge}
      ready={picked !== undefined}
      unready={t('tools.pick-merge-first')}
    >
      {entries.length === 0 ? (
        <p className={styles.none}>{t('tools.nothing-to-merge')}</p>
      ) : (
        <div className={styles.choices}>
          <EntryGroup
            entries={entries}
            group={group}
            legend={t('tools.merge-choice')}
            model={model.elements}
            onToggle={setChosen}
            picked={new Set(picked === undefined ? [] : [picked])}
          />
        </div>
      )}
    </PickerFrame>
  );
}

function PickerFrame({
  action,
  children,
  heading,
  onAction,
  ready,
  unready,
}: {
  readonly action: string;
  readonly children: ReactNode;
  readonly heading: string;
  readonly onAction: () => void;
  readonly ready: boolean;
  readonly unready: string;
}) {
  const headingId = useId();
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

function EntryGroup({
  entries,
  group,
  legend,
  model,
  onToggle,
  picked,
}: {
  readonly entries: readonly ExistingEntry[];
  readonly group?: string;
  readonly legend: string;
  readonly model: readonly Element[];
  readonly onToggle: (id: ElementId) => void;
  readonly picked: ReadonlySet<ElementId>;
}) {
  const { t } = useTranslator();
  if (entries.length === 0) {
    return null;
  }
  const elements = elementsById(model);
  const labelled = distinctTexts(
    entries.map((entry) => ({
      ...labelledElement(entry.element, elements, t),
      entry,
    })),
  );
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <ul className={styles.entries}>
        {labelled.map(([{ entry }, text]) => (
          <Entry
            checked={picked.has(entry.element.id)}
            elements={elements}
            entry={entry}
            group={group}
            key={entry.element.id}
            onToggle={onToggle}
            text={text}
          />
        ))}
      </ul>
    </fieldset>
  );
}

function Entry({
  checked,
  elements,
  entry,
  group,
  onToggle,
  text,
}: {
  readonly checked: boolean;
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly entry: ExistingEntry;
  readonly group: string | undefined;
  readonly onToggle: (id: ElementId) => void;
  readonly text: OptionText;
}) {
  const detailId = useId();
  const { t } = useTranslator();
  const { element, diagrams } = entry;
  const what =
    element.kind === 'flow'
      ? flowEndsText(flowEnds(element, elements), t)
      : t(kindMessages[element.kind]);

  return (
    <li className={styles.entry}>
      <label className={styles.choice}>
        <input
          aria-describedby={detailId}
          checked={checked}
          className={styles.box}
          name={group}
          onChange={() => {
            onToggle(element.id);
          }}
          type={group === undefined ? 'checkbox' : 'radio'}
        />
        <span>{optionName(text)}</span>
      </label>
      <span className={styles.detail} id={detailId}>
        {t('tools.existing-detail', {
          what,
          diagrams: diagrams.map(({ title }) => diagramTitle(title, t)),
        })}
      </span>
    </li>
  );
}
