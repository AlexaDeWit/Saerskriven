import { threatStatusSchema, type ThreatStatus } from '@saerskriven/model';

import { statusMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import { EnumField } from './enum-field.js';

type StatusFieldProps = {
  readonly value: ThreatStatus;
  readonly onCommit: (status: ThreatStatus) => void;
};

/**
 * Where a threat stands, as a listbox over the model's own status union: the
 * open threat and the six dispositions it can reach, each under its
 * catalogue label.
 */
export function StatusField({ value, onCommit }: StatusFieldProps) {
  const { t } = useTranslator();

  return (
    <EnumField
      label={t('fields.status')}
      labelOf={(option) => t(statusMessages[option])}
      onCommit={onCommit}
      options={threatStatusSchema.options}
      value={value}
    />
  );
}
