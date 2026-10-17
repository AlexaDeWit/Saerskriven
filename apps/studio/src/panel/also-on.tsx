import type { ElementId } from '@saerskriven/model';
import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { revealElement } from '../canvas/diagrams.js';
import { otherDiagrams } from '../canvas/other-diagrams.js';
import { diagramTitle } from '../messages/diagram-title.js';
import { useTranslator } from '../messages/locale.js';
import { Message } from '../messages/message.js';
import { activeDiagramId } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { listed } from '../ui/listed.js';
import styles from './threat-panel.module.css';

/**
 * The line under an element's heading naming the other diagrams it is on,
 * each name a button that shows that diagram with the element selected and
 * focused. An element on the diagram on screen alone draws no line.
 */
export function AlsoOn({ elementId }: { readonly elementId: ElementId }) {
  const diagrams = useModelStore(
    useShallow((state) => {
      const shownOn = activeDiagramId(state);
      return shownOn === undefined
        ? []
        : otherDiagrams(state.present, elementId, shownOn);
    }),
  );
  const { t, locale } = useTranslator();
  if (diagrams.length === 0) {
    return null;
  }
  const names = diagrams.map(({ id, title }) => ({
    id,
    label: diagramTitle(title, t),
  }));

  return (
    <p className={styles.alsoOn}>
      <Message
        id="panel.also-on-diagrams"
        params={{
          diagrams: (
            <Fragment key="diagrams">
              {listed(names, locale).map((part, index) =>
                typeof part === 'string' ? (
                  <Fragment key={index}>{part}</Fragment>
                ) : (
                  <button
                    aria-label={t('panel.show-on-diagram', {
                      diagram: part.label,
                    })}
                    className={styles.alsoOnLink}
                    key={part.id}
                    onClick={() => {
                      revealElement(elementId, part.id);
                    }}
                    type="button"
                  >
                    {part.label}
                  </button>
                ),
              )}
            </Fragment>
          ),
        }}
      />
    </p>
  );
}
