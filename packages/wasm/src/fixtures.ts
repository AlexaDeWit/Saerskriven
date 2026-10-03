import { readFileSync } from 'node:fs';

/**
 * A refusal that throws its sentence, for the build-asset locators a fixture
 * or spec calls: an asset the flake shell should have put in place fails the
 * spec that asked for it.
 */
export const stop = (sentence: string): never => {
  throw new Error(sentence);
};

/**
 * Whether the variable naming a flake-built module is unset or empty, which is
 * what running outside the flake shell looks like, so a suite that runs the
 * module skips there. Inside the shell the variable is always set, and a
 * module that is not at the path it names fails the suite.
 */
export const unbuilt = (variable: string): boolean =>
  process.env[variable] === undefined || process.env[variable] === '';

/**
 * The bytes of the module `locate` finds, read at the first call and held for
 * the rest of the suite. A module the locator refuses fails the spec that
 * asked for it.
 */
export const builtModule = (
  locate: (refuse: (sentence: string) => never) => string,
): (() => Uint8Array) => {
  let read: Uint8Array | undefined;
  return () => (read ??= new Uint8Array(readFileSync(locate(stop))));
};

const wasmHeader = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

const typeSection = 1;

const functionSection = 3;

const memorySection = 5;

const exportSection = 7;

const codeSection = 10;

const answersOneI32 = [0x60, 0, 1, 0x7f];

const functionExport = 0x00;

const memoryExport = 0x02;

const endOfBody = 0x0b;

const unsignedLeb128 = (value: number): number[] =>
  value < 0x80
    ? [value]
    : [(value & 0x7f) | 0x80, ...unsignedLeb128(value >>> 7)];

const sized = (bytes: readonly number[]): number[] => [
  ...unsignedLeb128(bytes.length),
  ...bytes,
];

const section = (id: number, body: readonly number[]): number[] => [
  id,
  ...sized(body),
];

const named = (name: string): number[] =>
  sized([...new TextEncoder().encode(name)]);

/**
 * A module with one page of growable memory that exports `memory` and every
 * name in `calls` as one function answering what `body` leaves, for a driver
 * spec to reach what a built module never does. Each call ignores its
 * arguments.
 */
export const moduleWhoseEveryCall = (
  calls: readonly string[],
  body: readonly number[],
): Uint8Array =>
  new Uint8Array([
    ...wasmHeader,
    ...section(typeSection, [1, ...answersOneI32]),
    ...section(functionSection, [1, 0]),
    ...section(memorySection, [1, 0, 1]),
    ...section(exportSection, [
      ...unsignedLeb128(calls.length + 1),
      ...named('memory'),
      memoryExport,
      0,
      ...calls.flatMap((name) => [...named(name), functionExport, 0]),
    ]),
    ...section(codeSection, [1, ...sized([0, ...body, endOfBody])]),
  ]);

/** A body that traps, as an allocation the module cannot make does. */
export const trapping: readonly number[] = [0x00];

/** A body answering 2147483647, an address past one page of memory. */
export const answeringPastMemory: readonly number[] = [
  0x41, 0xff, 0xff, 0xff, 0xff, 0x07,
];

/**
 * A body that grows memory by one page and answers 65536, an address the old
 * page did not reach, so a view made before the call is over a buffer the
 * growth detached.
 */
export const growingAPage: readonly number[] = [
  0x41, 0x01, 0x40, 0x00, 0x1a, 0x41, 0x80, 0x80, 0x04,
];
