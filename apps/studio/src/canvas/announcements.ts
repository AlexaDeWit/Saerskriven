import { onCanvasOrPanelChange } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import type { RefusedDraft } from '../ui/text-field.js';

type Announcement = {
  readonly message: string;
  readonly sequence: number;
};

const nothingSaid: Announcement = { message: '', sequence: 0 };

/** How many grapheme clusters of a record's first line an announcement quotes. */
export const recordQuoteLength = 24;

/** How many grapheme clusters of an element, flow or diagram name an announcement quotes. */
export const nameQuoteLength = 40;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

let current = nothingSaid;

const announcementStore = externalStore(currentAnnouncement);

onCanvasOrPanelChange(clear);

/** Says `message` in the canvas announcement. Its sequence moves, so repeated words announce again. */
export function announce(message: string): void {
  current = { message, sequence: current.sequence + 1 };
  announcementStore.notify();
}

/** Says a refusal, unless its text is `heldText`, the draft already refused in that field. */
export function announceRefusal(
  refused: RefusedDraft | undefined,
  heldText?: string,
): void {
  if (refused !== undefined && refused.text !== heldText) {
    announce(refused.said);
  }
}

/**
 * A person's own text as an announcement quotes it: on one line, and cut to
 * `bound` grapheme clusters ending in an ellipsis. The quotation marks
 * belong to the message.
 */
export function excerpt(text: string, bound: number): string {
  const clusters = Array.from(
    graphemes.segment(text.replace(/\s+/gu, ' ').trim()),
    ({ segment }) => segment,
  );
  return clusters.length > bound
    ? `${clusters
        .slice(0, bound - 1)
        .join('')
        .trimEnd()}…`
    : clusters.join('');
}

/** {@link excerpt} in English quotation marks. */
export function quoted(text: string, bound: number): string {
  return `“${excerpt(text, bound)}”`;
}

/** An element's own name quoted to {@link nameQuoteLength}, or `unnamed` while it has none. */
export function quotedName(name: string, unnamed: string): string {
  return name === '' ? unnamed : quoted(name, nameQuoteLength);
}

/** Clears the announcement and its sequence. */
export function resetAnnouncements(): void {
  current = nothingSaid;
  announcementStore.notify();
}

/** What was last said. */
export function currentAnnouncement(): Announcement {
  return current;
}

/** Subscribes a component to {@link announce}. */
export function useAnnouncement(): Announcement {
  return announcementStore.use();
}

function clear(): void {
  if (current.message === '') {
    return;
  }
  current = { ...current, message: '' };
  announcementStore.notify();
}
