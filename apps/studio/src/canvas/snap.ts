import { externalStore } from '../ui/external-store.js';
import { announce } from './announcements.js';

let enabled = false;

const snapStore = externalStore(currentSnap);

/** Whether pointer movement snaps nodes to the visible grid. */
export function currentSnap(): boolean {
  return enabled;
}

/** Toggles snapping without changing the document or history. */
export function toggleSnap(): void {
  enabled = !enabled;
  snapStore.notify();
  announce(enabled ? 'Snap to grid on.' : 'Snap to grid off.');
}

/** Subscribes a control to the snap setting. */
export function useSnap(): boolean {
  return snapStore.use();
}
