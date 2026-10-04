import { Cross1Icon } from '@radix-ui/react-icons';
import { isEmptyName, type ElementId, type Threat } from '@saerskriven/model';
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
  detailsFromThreatRegister,
  leaveThreatRegister,
  registerFocusHandler,
  useThreatRegisterOpen,
} from './threat-register-state.js';
import styles from './threat-register.module.css';
import { threatAttachments } from './threats.js';

/** The global threat index, with rows opening individual editors and links selecting diagram elements. */
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
          className={styles.details}
          onClick={detailsFromThreatRegister}
          type="button"
        >
          {t('panel.details')}
        </button>
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
          {isEmptyName(threat.title) ? (
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
