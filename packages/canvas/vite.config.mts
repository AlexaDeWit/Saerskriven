import { reactLib } from '../../vite.shared.mts';

export default reactLib(import.meta.dirname, {
  // jsdom implements no ResizeObserver, and specs here fail without one. The
  // module stubs one that observes nothing.
  setupFiles: ['./src/test-setup.ts'],
});
