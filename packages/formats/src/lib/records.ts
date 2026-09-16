/** Whether a value is an object other than null or an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a value holds other values under keys, an array's indices included. */
export function isKeyed(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
