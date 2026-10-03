// Element methods jsdom implements nowhere, stubbed for the component specs.
// Radix's Select reads and releases pointer capture and scrolls an option into
// view while it opens its listbox, and the canvas's own drags take and release
// capture. An unimplemented method there fails the interaction rather than the
// assertion, so a spec would go red for the wrong reason. Each stub is the
// smallest shape the caller reads. The ResizeObserver stub is in
// vitest.jsdom-setup.mts at the workspace root, which the canvas package's
// specs load too.

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
