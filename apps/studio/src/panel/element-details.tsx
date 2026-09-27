import type { Element, ElementDetailsChange } from '@saerskriven/model';
import { resetAnnouncements } from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import type { Said } from '../messages/said.js';
import { ProseField, type RefusedDraft } from '../ui/text-field.js';
import { RequiredBooleanProperty } from './element-property-fields.js';

/** The element details that can hold a refused draft. */
export type DetailField = 'description' | 'reasonOutOfScope';

/**
 * Whether the reason field shows: while the flag is set or the element holds a
 * reason, so it never hides text a file holds.
 */
export function showsReason(element: Element): boolean {
  return element.outOfScope || element.reasonOutOfScope !== '';
}

/** The accessible name of an element's description field, after its name or its kind. */
export function descriptionLabel(element: Element): Said {
  const { name, kind } = element;
  return (speak) =>
    name === ''
      ? speak(`fields.description-of-${kind}`)
      : speak('fields.description-of', { name });
}

/**
 * An element's description, out-of-scope flag and reason, for every kind. Each
 * field commits a change naming it alone, and text the element already holds
 * commits nothing.
 */
export function ElementDetails({
  element,
  held,
  onCommit,
  onRefused,
}: {
  readonly element: Element;
  readonly held: (field: DetailField) => string | undefined;
  readonly onCommit: (change: ElementDetailsChange) => void;
  readonly onRefused: (
    field: DetailField,
  ) => (draft: RefusedDraft | undefined) => void;
}) {
  const { t } = useTranslator();
  const commitText =
    (field: DetailField) =>
    (text: string): void => {
      if (element[field] === text) {
        return;
      }
      onCommit(
        field === 'description'
          ? { description: text }
          : { reasonOutOfScope: text },
      );
    };

  return (
    <>
      <ProseField
        compact
        held={held('description')}
        label={descriptionLabel(element)}
        onChange={resetAnnouncements}
        onCommit={commitText('description')}
        onRefused={onRefused('description')}
        shownLabel={t('fields.description')}
        value={element.description}
      />
      <RequiredBooleanProperty
        label={t('fields.out-of-scope')}
        onCommit={(outOfScope) => {
          onCommit({ outOfScope });
        }}
        value={element.outOfScope}
      />
      {showsReason(element) && (
        <ProseField
          compact
          held={held('reasonOutOfScope')}
          label={(speak) => speak('fields.reason-out-of-scope')}
          onChange={resetAnnouncements}
          onCommit={commitText('reasonOutOfScope')}
          onRefused={onRefused('reasonOutOfScope')}
          value={element.reasonOutOfScope}
        />
      )}
    </>
  );
}
