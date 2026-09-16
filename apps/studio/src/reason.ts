/** An Error's message, or any other thrown or rejected value as text. */
export function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
