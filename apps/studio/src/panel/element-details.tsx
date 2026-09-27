import type { Element, ElementDetailsChange } from '@saerskriven/model';
import { resetAnnouncements } from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { ProseField, type RefusedDraft } from '../ui/text-field.js';
import { RequiredBooleanProperty } from './element-property-fields.js';
import { elementLabel } from './threats.js';

/** The element details that can hold a refused draft. */
export type DetailField = 'description' | 'reasonOutOfScope';

/**
 * An element's description, out-of-scope flag and reason, for every kind. Each
 * field commits a change naming it alone, and text the element already holds
 * commits nothing. The reason shows while the flag is set or the element holds
 * a reason, so it never hides text a file holds. Clearing the flag drops a
 * refused reason draft along with the field it was typed in.
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
        label={(speak) =>
          speak('fields.description-of', {
            element: elementLabel(element, speak),
          })
        }
        onChange={resetAnnouncements}
        onCommit={commitText('description')}
        onRefused={onRefused('description')}
        shownLabel={t('fields.description')}
        value={element.description}
      />
      <RequiredBooleanProperty
        label={t('fields.out-of-scope')}
        onCommit={(outOfScope) => {
          if (!outOfScope && element.reasonOutOfScope === '') {
            onRefused('reasonOutOfScope')(undefined);
          }
          onCommit({ outOfScope });
        }}
        value={element.outOfScope}
      />
      {(element.outOfScope || element.reasonOutOfScope !== '') && (
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
