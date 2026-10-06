import { useEffect, useEffectEvent, useRef } from 'react';

/** Cancels a held gesture on blur before sending the window release its mouse listener waits for. */
export function useHeldMouse(
  startsGesture: (event: MouseEvent) => boolean,
  cancel: () => void,
  active: () => boolean = () => false,
): void {
  const pressed = useRef<number | undefined>(undefined);
  const press = useEffectEvent((event: MouseEvent): void => {
    if (startsGesture(event)) {
      pressed.current = event.button;
    }
  });
  const blurred = useEffectEvent((): void => {
    const button = pressed.current;
    if (button === undefined && !active()) {
      return;
    }
    cancel();
    window.dispatchEvent(new MouseEvent('mouseup', { button, view: window }));
  });
  useEffect(() => {
    const release = (): void => {
      pressed.current = undefined;
    };
    window.addEventListener('mousedown', press, true);
    window.addEventListener('mouseup', release, true);
    window.addEventListener('blur', blurred);
    return () => {
      window.removeEventListener('mousedown', press, true);
      window.removeEventListener('mouseup', release, true);
      window.removeEventListener('blur', blurred);
    };
  }, []);
}
