import { Cross1Icon } from '@radix-ui/react-icons';
import type { ElementId, Threat } from '@saerskriven/model';
import { Fragment, memo, useEffect, useId, useRef, useState } from 'react';
import { announce } from '../canvas/announcements.js';
import { revealElement } from '../canvas/diagrams.js';
import { closingOn } from '../commands/binding.js';
import { describeContextualShortcuts } from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { inReviewOrder } from '../ui/review-order.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { marked, markedWithin } from './marked.js';
import { useShownOrder } from './shown-order.js';
import { SeverityChip, StatusMark } from './threat-marks.js';
import {
  carriedChoice,
  chooseInThreatRegister,
  closeThreatRegister,
  leaveThreatRegister,
  registerFocusHandler,
  useThreatRegisterOpen,
} from './threat-register-state.js';
import styles from './threat-register.module.css';
import { threatAttachments } from './threats.js';

/**
 * The threat register while it is open, over the canvas area left of the
 * panel: every threat in the model as a table of number, title, elements,
 * severity and status, in review order as it opens and held while it stays
 * open, as the model panel's list is. A threat that applies to the model
 * leads its elements with the whole model. Choosing a row opens its threat
 * on the model panel and marks the row, leaving focus there, or where the
 * register hides that panel under it, closes the register onto the threat
 * and marks the row as the register next opens. An element's name closes the
 * register and selects the element. `cover` is how much of the canvas the
 * panel covers, the default panel width standing in while no panel is open,
 * so a first choice opens the model panel without moving the register.
 * Canvas-only parent renders do not rerender it.
 */
export const ThreatRegister = memo(function ThreatRegister({
  cover,
}: {
  readonly cover: number;
}) {
  const open = useThreatRegisterOpen();
  return open ? <Register cover={cover} /> : null;
});

function Register({ cover }: { readonly cover: number }) {
  const threats = useModelStore((state) => state.present.threats);
  const shown = useShownOrder(inReviewOrder(threats));
  const [chosen, setChosen] = useState(carriedChoice);
  const body = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const keyboardDescriptionId = useId();
  const { t } = useTranslator();

  useEffect(
    () =>
      registerFocusHandler(() => {
        const rows = body.current;
        const row =
          (chosen === undefined
            ? undefined
            : markedWithin(rows, 'registerRow', chosen)) ??
          rows?.querySelector<HTMLElement>(marked.registerRow) ??
          undefined;
        const target =
          row?.querySelector<HTMLElement>(`.${styles.choose}`) ?? close.current;
        target?.focus();
      }),
    [chosen],
  );

  const choose = (threat: Threat): void => {
    const { number } = threat;
    chooseInThreatRegister(threat.id, () => {
      setChosen(threat.id);
      announce((speak) =>
        speak('canvas.threat-opened-in-model-panel', { number }),
      );
    });
  };

  return (
    <section
      aria-describedby={keyboardDescriptionId}
      aria-label={t('commands.label-threat-register')}
      className={styles.register}
      data-pane=""
      onKeyDownCapture={closeOnEscape}
      style={{
        insetInlineEnd: `calc(max(var(--saer-panel-cover), ${String(cover)}px) + var(--saer-space-3))`,
      }}
    >
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts(
          ['close-threat-register'],
          hostPlatform,
          t,
        )}
      </VisuallyHidden>
      <header className={styles.header}>
        <h2 className={styles.heading} id={headingId}>
          {t('commands.label-threat-register')}{' '}
          <span className={styles.count}>{threats.length}</span>
        </h2>
        <button
          aria-label={t('panel.close-register')}
          className={styles.close}
          onClick={() => {
            closeThreatRegister();
          }}
          ref={close}
          type="button"
        >
          <Cross1Icon aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body} ref={body}>
        {shown.length === 0 ? (
          <p className={styles.empty}>{t('panel.no-model-threats')}</p>
        ) : (
          <table aria-labelledby={headingId} className={styles.table}>
            <thead>
              <tr>
                <th scope="col">
                  <span aria-hidden="true">
                    {t('panel.register-number-short')}
                  </span>
                  <VisuallyHidden>{t('panel.register-number')}</VisuallyHidden>
                </th>
                <th className={styles.titleColumn} scope="col">
                  {t('fields.title')}
                </th>
                <th className={styles.elementsColumn} scope="col">
                  {t('panel.register-elements')}
                </th>
                <th scope="col">{t('fields.severity')}</th>
                <th scope="col">{t('fields.status')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((threat) => (
                <RegisterRow
                  chosen={threat.id === chosen}
                  key={threat.id}
                  onChoose={() => {
                    choose(threat);
                  }}
                  onFollow={followElement}
                  threat={threat}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function followElement(elementId: ElementId): void {
  leaveThreatRegister();
  revealElement(elementId);
}

const closeOnEscape = closingOn('close-threat-register', closeThreatRegister);

function RegisterRow({
  threat,
  chosen,
  onChoose,
  onFollow,
}: {
  readonly threat: Threat;
  readonly chosen: boolean;
  readonly onChoose: () => void;
  readonly onFollow: (elementId: ElementId) => void;
}) {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const { t, locale } = useTranslator();
  const placed: readonly Placement[] = [
    ...(threat.appliesToModel ? [{ label: t('panel.whole-model') }] : []),
    ...threatAttachments(diagrams, threat, t),
  ];

  return (
    <tr
      className={styles.row}
      data-chosen={chosen ? '' : undefined}
      data-register-row={threat.id}
    >
      <th className={styles.number} scope="row">
        {threat.number}
      </th>
      <td>
        <button
          aria-current={chosen ? 'true' : undefined}
          className={styles.choose}
          onClick={(event) => {
            event.currentTarget.focus();
            onChoose();
          }}
          type="button"
        >
          {threat.title === '' ? (
            <span className={styles.untitled}>
              {t('panel.untitled-threat', { number: threat.number })}
            </span>
          ) : (
            threat.title
          )}
        </button>
      </td>
      <td className={styles.elements}>
        {placed.length === 0 ? (
          <span className={styles.none}>{t('panel.no-element')}</span>
        ) : (
          listed(placed, locale).map((part, index) => {
            const text = typeof part === 'string' ? part : part.label;
            const id = typeof part === 'string' ? undefined : part.id;
            return id === undefined ? (
              <Fragment key={index}>{text}</Fragment>
            ) : (
              <button
                className={styles.link}
                key={id}
                onClick={() => {
                  onFollow(id);
                }}
                type="button"
              >
                {text}
              </button>
            );
          })
        )}
      </td>
      <td className={styles.mark}>
        <SeverityChip headed severity={threat.severity} />
      </td>
      <td className={styles.mark}>
        <StatusMark headed status={threat.status} />
      </td>
    </tr>
  );
}

type Placement = { readonly label: string; readonly id?: ElementId };

function listed<Item extends { readonly label: string }>(
  items: readonly Item[],
  locale: string,
): readonly (Item | string)[] {
  const waiting = [...items];
  return new Intl.ListFormat(locale, { type: 'conjunction' })
    .formatToParts(items.map(({ label }) => label))
    .map((part) =>
      part.type === 'element' ? (waiting.shift() ?? part.value) : part.value,
    );
}
