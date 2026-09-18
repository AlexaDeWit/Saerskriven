import { severitySchema, type Severity } from '@saerskriven/model';

import { severityMessages } from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import { EnumField } from './enum-field.js';

type SeverityFieldProps = {
  readonly value: Severity;
  readonly onCommit: (severity: Severity) => void;
};

/**
 * The severity of a threat, as a listbox over the model's own severity union,
 * each option under its catalogue label.
 */
export function SeverityField({ value, onCommit }: SeverityFieldProps) {
  const { t } = useTranslator();

  return (
    <EnumField
      label={t('fields.severity')}
      labelOf={(option) => t(severityMessages[option])}
      onCommit={onCommit}
      options={severitySchema.options}
      value={value}
    />
  );
}
