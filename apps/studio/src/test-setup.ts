// Element methods jsdom implements nowhere, stubbed for the component specs.
// A missing one fails the interaction rather than the assertion, so a spec
// would go red for the wrong reason. Each stub is the smallest shape its
// callers read.

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
