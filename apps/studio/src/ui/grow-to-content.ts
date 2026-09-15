function pixels(value: string): number {
  return Number.parseFloat(value) || 0;
}

/** Whether the browser sizes a form control to its content from CSS `field-sizing` alone. */
export function sizesFieldsToContent(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');
}

/**
 * The `height` that shows all of a textarea's text, in the box its
 * `box-sizing` measures: `scrollHeight` counts the padding but not the
 * border. Nothing while the element has no layout.
 */
export function contentHeight(
  element: HTMLTextAreaElement,
): number | undefined {
  if (element.scrollHeight <= 0) {
    return undefined;
  }
  const style = getComputedStyle(element);
  return style.boxSizing === 'border-box'
    ? element.scrollHeight +
        pixels(style.borderTopWidth) +
        pixels(style.borderBottomWidth)
    : element.scrollHeight -
        pixels(style.paddingTop) -
        pixels(style.paddingBottom);
}

/**
 * Sets a textarea's height to its content, clearing it first so it can
 * shrink. The CSS minimum and maximum sizes still bound it, and past the
 * maximum it scrolls. Call it from a layout effect that runs every render.
 */
export function growToContent(element: HTMLTextAreaElement | null): void {
  if (element === null) {
    return;
  }
  element.style.height = '';
  const height = contentHeight(element);
  if (height !== undefined) {
    element.style.height = `${String(height)}px`;
  }
}
