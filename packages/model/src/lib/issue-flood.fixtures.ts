/**
 * More invalid entries under one array than zod 4.6.2 gathers on V8 before
 * the parse throws `RangeError`, for a spec that pins how a read answers an
 * issue flood. A spec whose entry raises more than one issue divides it.
 */
export const floodingEntryCount = 135_000;

/** {@link floodingEntryCount} copies of one entry, each raising one issue. */
export const floodingEntries = <Entry>(entry: Entry): Entry[] =>
  Array.from({ length: floodingEntryCount }, () => entry);
