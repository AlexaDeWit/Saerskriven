import { useSyncExternalStore } from 'react';
import { onCanvasOrPanelChange } from '../store/store.js';

export type Announcement = {
  readonly message: string;
  readonly sequence: number;
};

const nothingSaid: Announcement = { message: '', sequence: 0 };

/** How many characters of a person's own text an announcement quotes before it cuts the rest. */
export const quotedLength = 40;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

let current = nothingSaid;

const listeners = new Set<() => void>();

onCanvasOrPanelChange(clear);

export function announce(message: string): void {
  current = { message, sequence: current.sequence + 1 };
  notify();
}

/**
 * A person's own text as an announcement names it: on one line, in quotation
 * marks, and cut to {@link quotedLength} characters ending in an ellipsis. A
 * name or a record's first line has no length limit, and the region hangs
 * over the canvas.
 */
export function quoted(text: string): string {
  const characters = Array.from(
    graphemes.segment(text.replace(/\s+/gu, ' ').trim()),
    ({ segment }) => segment,
  );
  return characters.length > quotedLength
    ? `“${characters
        .slice(0, quotedLength - 1)
        .join('')
        .trimEnd()}…”`
    : `“${characters.join('')}”`;
}

/** An element's own name as {@link quoted} gives it, or `unnamed` while it has none. */
export function quotedName(name: string, unnamed: string): string {
  return name === '' ? unnamed : quoted(name);
}

export function resetAnnouncements(): void {
  current = nothingSaid;
  notify();
}

function clear(): void {
  if (current.message === '') {
    return;
  }
  current = { ...current, message: '' };
  notify();
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** What was last said, for a spec and for {@link useAnnouncement} alike. */
export function currentAnnouncement(): Announcement {
  return current;
}

/** Subscribes a component to {@link announce}. */
export function useAnnouncement(): Announcement {
  return useSyncExternalStore(
    subscribe,
    currentAnnouncement,
    currentAnnouncement,
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
