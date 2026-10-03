// jsdom implements no ResizeObserver, and both jsdom projects mount code that
// constructs one. The stub observes nothing, so no spec sees a resize.
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
