const pseudoLocaleParameter = 'pseudo-locale';

/**
 * Whether the studio was opened with `?pseudo-locale` in its address. Its
 * caller asks only in a development build, so a production bundle drops the
 * pseudo-locale altogether.
 */
export function pseudoLocaleRequested(): boolean {
  return (
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has(pseudoLocaleParameter)
  );
}
