import { Cross2Icon } from '@radix-ui/react-icons';
import type { ElementId, Threat } from '@saerskriven/model';
import { useEffect, useRef } from 'react';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { RequiredBooleanProperty } from './element-property-fields.js';
import { PickExisting } from './pick-existing.js';
import styles from './threat-panel.module.css';
import { attachableElements, threatAttachments } from './threats.js';

/** One threat's attachments and the controls that change them. */
export type AttachmentGroupProps = {
  readonly threat: Threat;
  readonly onAttach: (elementId: ElementId) => void;
  readonly onDetach: (elementId: ElementId) => void;
  readonly onModelLink: (applies: boolean) => void;
};

/**
 * What one threat is on: whether it applies to the whole model, then the
 * elements it names as one row of names each with its own Detach control,
 * above the picker that attaches another. A detach hands focus to the row
 * that takes its place, or with no row left to the whole-model control. The
 * change that takes the threat's last reference removes the threat, so the
 * group goes with it and the panel takes focus from there.
 */
export function AttachmentGroup({
  threat,
  onAttach,
  onDetach,
  onModelLink,
}: AttachmentGroupProps) {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const { t } = useTranslator();
  const group = useRef<HTMLFieldSetElement>(null);
  const detached = useRef<number | undefined>(undefined);
  const attachments = threatAttachments(diagrams, threat, t);
  const attachable = attachableElements(diagrams, threat, t);

  useEffect(() => {
    const index = detached.current;
    detached.current = undefined;
    if (index === undefined) {
      return;
    }
    const rows = group.current?.querySelectorAll<HTMLElement>(
      '[data-detach-element]',
    );
    (
      rows?.[index] ??
      rows?.[index - 1] ??
      group.current?.querySelector<HTMLElement>('[role="combobox"]')
    )?.focus();
  });

  return (
    <fieldset className={styles.records} ref={group}>
      <legend>{t('panel.attached-elements')}</legend>
      <div className={styles.recordBody}>
        <RequiredBooleanProperty
          label={t('fields.applies-to-whole-model')}
          onCommit={onModelLink}
          value={threat.appliesToModel}
        />
        <ul className={styles.attachments}>
          {attachments.map(({ id, label, detach }, index) => (
            <li className={styles.attachment} key={id}>
              <span className={styles.attachmentName}>{label}</span>
              <button
                aria-label={detach}
                className={styles.detach}
                data-detach-element
                onClick={() => {
                  detached.current = index;
                  onDetach(id);
                }}
                type="button"
              >
                <Cross2Icon aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {attachable.length > 0 && (
          <div className={styles.addLink}>
            <PickExisting
              actionLabel={t('fields.attach-existing-element')}
              actionText={t('panel.attach')}
              choices={attachable}
              fieldLabel={t('fields.existing-element')}
              onPick={onAttach}
              reason={t('fields.choose-existing-element-first')}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
