import {
  elementsById,
  flowEnds,
  type Element,
  type ElementId,
} from '@saerskriven/model';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useEffect, useId, useState } from 'react';
import { closingOn } from '../commands/binding.js';
import { diagramTitle } from '../messages/diagram-title.js';
import { kindMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import { distinctTexts, optionName } from '../panel/distinct-labels.js';
import { labelledElement } from '../panel/threats.js';
import { activeDiagram } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import type { OptionText } from '../ui/enum-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  addExisting,
  cancelAddExisting,
  closeAddExisting,
  existingEntries,
  focusAddExisting,
  useAddExistingOpen,
  type ExistingEntry,
} from './add-existing.js';
import { flowEndsText } from './names.js';
import styles from './add-existing-picker.module.css';

/**
 * The Add existing element picker under the chrome card, mounted only while
 * it is open: a checkbox for each element and each flow the diagram on
 * screen does not place, and Add, which places the ones picked at the centre
 * of the view. Escape and Cancel put it away and hand focus back.
 */
export function AddExistingPicker() {
  return useAddExistingOpen() ? <Picker /> : null;
}

const cancelOnEscape = closingOn('close-add-existing', cancelAddExisting);

function Picker() {
  const model = useModelStore((state) => state.present);
  const diagram = useModelStore(activeDiagram);
  const flow = useReactFlow();
  const view = useStoreApi();
  const [picked, setPicked] = useState<ReadonlySet<ElementId>>(() => new Set());
  const headingId = useId();
  const reasonId = useId();
  const { t } = useTranslator();

  useEffect(() => {
    focusAddExisting();
  }, []);

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
    <section
      aria-labelledby={headingId}
      className={styles.picker}
      data-add-existing=""
      onKeyDownCapture={cancelOnEscape}
    >
      <h2 className={styles.heading} id={headingId}>
        {t('commands.label-add-existing')}
      </h2>
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
      <div className={styles.actions}>
        <button
          aria-describedby={chosen.length === 0 ? reasonId : undefined}
          aria-disabled={chosen.length === 0}
          className={styles.action}
          onClick={add}
          type="button"
        >
          {chosen.length === 0
            ? t('panel.add')
            : t('tools.add-picked', { count: chosen.length })}
        </button>
        <button
          className={styles.action}
          onClick={cancelAddExisting}
          type="button"
        >
          {t('tools.cancel')}
        </button>
      </div>
      {chosen.length === 0 && (
        <VisuallyHidden id={reasonId}>
          {t('tools.pick-existing-first')}
        </VisuallyHidden>
      )}
    </section>
  );
}

function EntryGroup({
  entries,
  legend,
  model,
  onToggle,
  picked,
}: {
  readonly entries: readonly ExistingEntry[];
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
  onToggle,
  text,
}: {
  readonly checked: boolean;
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly entry: ExistingEntry;
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
          onChange={() => {
            onToggle(element.id);
          }}
          type="checkbox"
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
