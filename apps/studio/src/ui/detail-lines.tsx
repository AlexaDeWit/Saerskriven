import type { ReactNode } from 'react';

/** Lines of a notice as a list, folded into a disclosure under `summary` when one is given. */
export function DetailLines({
  className,
  lines,
  summary,
}: {
  readonly className: string;
  readonly lines: readonly string[];
  readonly summary?: ReactNode;
}) {
  const list = (
    <ul className={className}>
      {lines.map((line, index) => (
        <li key={`${String(index)} ${line}`}>{line}</li>
      ))}
    </ul>
  );
  return summary === undefined ? (
    list
  ) : (
    <details>
      <summary>{summary}</summary>
      {list}
    </details>
  );
}
