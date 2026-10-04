import { useEffect, useEffectEvent, useRef } from 'react';

/** Cancels a held gesture on blur before sending the window release its mouse listener waits for. */
export function useHeldMouse(
  startsGesture: (event: MouseEvent) => boolean,
  cancel: () => void,
  active: () => boolean = () => false,
): void {
  const pressed = useRef(false);
  const press = useEffectEvent((event: MouseEvent): void => {
    if (startsGesture(event)) {
      pressed.current = true;
    }
  });
  const blurred = useEffectEvent((): void => {
    if (!pressed.current && !active()) {
      return;
    }
    cancel();
    window.dispatchEvent(new MouseEvent('mouseup', { view: window }));
  });
  useEffect(() => {
    const release = (): void => {
      pressed.current = false;
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
