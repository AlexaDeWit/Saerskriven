/**
 * How long a test that mounts the whole studio is given, past the root
 * `vitest.shared.mts` sets: the app's suite, and the shortcut reference tests
 * that reach the reference from the menu and the keys. Each mounts the React
 * Flow canvas, the threat panel and the menu into jsdom at once, and the
 * slowest drives the toolbox and the menu through `userEvent` on top of that.
 * Three runs on a host at load average 37 to 55 put the worst at 6.7 s and a
 * bare render at 5.9 s, which on a sample of three is too near the 10 s root
 * to leave at it. At load average near 2.5 the app's worst takes 0.6 s and
 * the slowest shortcut reference mount 0.5 to 0.7 s.
 */
export const appTimeout = 30_000;
