import { plural, text } from '@saerskriven/i18n';

const id = { id: 'text' } as const;

const name = { name: 'text' } as const;

const path = { path: 'text' } as const;

const numbered = { number: 'number' } as const;

const titled = { number: 'number', title: 'text' } as const;

const onThreat = { threat: 'text' } as const;

/**
 * The lines of a studio report, one per divergence that loses something:
 * the subject named as the studio shows it, then what was lost. A code
 * whose subject is the model words its own subject from the source's data.
 * A subject or a lost link naming an element kind has a message for each
 * kind, so no locale composes an article onto the kind.
 */
export const divergenceMessages = {
  line: text({ subject: 'text', detail: 'text' }),
  kept: text({ line: 'text' }),
  threat: text(titled),
  'threat-untitled': text(numbered),
  'subject-threat': text(titled),
  'subject-threat-untitled': text(numbered),
  'subject-diagram': text({ title: 'text' }),
  'subject-actor': text(),
  'subject-actor-named': text(name),
  'subject-process': text(),
  'subject-process-named': text(name),
  'subject-store': text(),
  'subject-store-named': text(name),
  'subject-text': text(),
  'subject-text-named': text(name),
  'subject-flow-named': text(name),
  'subject-trust-boundary': text(),
  'subject-trust-boundary-named': text(name),
  'subject-mitigation': text({ title: 'text' }),
  'subject-mitigation-on': text(onThreat),
  'subject-mitigation-untitled': text(),
  'subject-assumption-on': text(onThreat),
  'subject-assumption-on-model': text(),
  'subject-assumption': text(),
  'whole-threat': text(),
  'whole-mitigation': text(),
  'whole-assumption': text(),
  'split-into-copies': plural('count'),
  'note-name-dropped': text(),
  'scope-marking-dropped': text(),
  'threat-attachment-stray-text': text(),
  'threat-attachment-stray-text-named': text(name),
  'threat-attachment-stray-trust-boundary': text(),
  'threat-attachment-stray-trust-boundary-named': text(name),
  'threat-attachment-stray-unknown': text(),
  'threat-category-unnamed': text(),
  'mitigation-records-merged': plural('count'),
  'mitigation-title-merged': text(),
  'mitigation-status-dropped': text({ status: 'text', inferred: 'text' }),
  'threat-status-unmapped': text({ status: 'text' }),
  'threat-severity-unmapped': text({ severity: 'text' }),
  'threat-category-eop-suit': text(),
  'threat-category-unmapped': text({ category: 'text' }),
  'key-undeclared': text(path),
  'assumption-element-links-dropped': text(),
  'otm-threat-split': text(id),
  'otm-threat-status-unmapped': text({ status: 'text' }),
  'otm-mitigation-split': text(id),
  'otm-mitigation-status-retained': text({ id: 'text', status: 'text' }),
  'otm-mitigation-unlinked': text(id),
  'otm-assets-as-descriptions': text(),
  'otm-components-as-processes': text(),
  'tmbom-control-proposed': text(name),
  'tmbom-control-unlinked': text(name),
  'tmbom-flow-fields-as-prose': text(),
  'tmbom-data-set-as-prose': text(name),
  'tmbom-data-set-dropped': text(name),
  'field-not-retained': text(path),
} as const;
