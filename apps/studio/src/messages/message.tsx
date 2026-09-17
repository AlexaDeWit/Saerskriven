import type { MessageOf, ParameterValues } from '@saerskriven/i18n';
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { StudioMessageId, StudioMessages } from './catalogues.js';
import { useTranslator } from './locale.js';

/** What a `node` parameter of a rendered message may be. */
export type MessageNode = ReactElement | string;

const shown = (part: unknown): ReactNode =>
  typeof part === 'string' || isValidElement(part) ? part : null;

/**
 * A message rendered in the active locale. A `node` parameter is an element
 * placed where its placeholder stands, so a message never carries markup. A
 * message without parameters reads better through `useTranslator().t`.
 */
export function Message<Id extends StudioMessageId>({
  id,
  params,
}: {
  readonly id: Id;
  readonly params: ParameterValues<MessageOf<StudioMessages, Id>, MessageNode>;
}): ReactNode {
  const { parts } = useTranslator();
  return Children.toArray(parts(id, params).map(shown));
}
