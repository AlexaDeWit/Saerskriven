// jsdom implements no ResizeObserver. A mounted React Flow constructs one for
// its pane, so a spec that mounts the canvas throws before its first
// assertion, in the canvas package and in the studio alike. sharedTest in
// vitest.shared.mts loads this file into every jsdom project. The stub
// observes nothing, so a spec never sees a resize reported.
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
