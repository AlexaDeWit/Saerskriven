import {
  openThreatsBySeverity,
  severitySchema,
  threatFlags,
  type ElementId,
  type Model,
  type Point,
  type Severity,
  type Size,
} from '@saerskriven/model';
import type { ReactElement } from 'react';
import { shiftedBy, type Box } from './geometry.js';
import type { NodeBox } from './handles.js';
import { svgNumber } from './numbers.js';
import { polylinePath, translate } from './paths.js';
import { canvasClassNames, severityToneClass } from './stylesheet.js';
import { badgeRadius } from './tokens.js';

const badgeGap = 3;

const countOffset = -3;

const markOffset = 7.5;

const flagMarkOffset = 4;

const secondaryCentre = badgeRadius.primary + badgeGap + badgeRadius.secondary;

/**
 * Order of the severities, worst last. `undecided` ranks zero because it is
 * the absence of an assessment, so the rank also says whether a severity has
 * been assessed at all.
 */
export const severityRank = {
  undecided: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const satisfies Record<Severity, number>;

/**
 * The marks a threat badge letters, which the app drawing it supplies in its
 * reader's language: one per severity under the count, so the severity reads
 * with the colour ignored, and `flag` inside the flag mark's triangle. The
 * marks of one set differ from each other.
 */
export type BadgeMarks = {
  readonly severity: { readonly [S in Severity]: string };
  readonly flag: string;
};

/**
 * What an element's badge says. A `counted` badge has open threats naming
 * the element: `count` is how many, `severity` the worst assessed among them
 * or `undecided` where none has been assessed, and `secondary` what the
 * second badge carries, how many of them are undecided, zero where every one
 * is. `flagged` is whether any threat naming the element, in any status,
 * carries a flag. A `flag-only` badge is an element no open threat names
 * that a flagged threat does, and draws the flag mark with no count.
 */
export type ThreatBadge =
  | {
      readonly kind: 'counted';
      readonly count: number;
      readonly severity: Severity;
      readonly secondary: number;
      readonly flagged: boolean;
    }
  | { readonly kind: 'flag-only' };

type CountedBadge = Extract<ThreatBadge, { kind: 'counted' }>;

/**
 * The badge each element earns, keyed by element id, over the whole model.
 * Open is the model's own definition, taken from `openThreatsBySeverity`, so
 * a badge, the register and the CLI count one set of threats, and a flag is
 * the one `threatFlags` derives. An element no open and no flagged threat
 * names has no entry.
 */
export function badgesByElement(model: Model): Map<ElementId, ThreatBadge> {
  const counted = openCountsByElement(model);
  const flagged = flaggedElements(model);
  return new Map(
    [...new Set([...counted.keys(), ...flagged])].map((element) => {
      const bySeverity = counted.get(element);
      return [
        element,
        bySeverity === undefined
          ? { kind: 'flag-only' }
          : { ...badgeOf(bySeverity), flagged: flagged.has(element) },
      ];
    }),
  );
}

/**
 * Where an element's badge hangs on its box: the top-right corner, in the
 * element's own coordinates.
 */
export function badgeAnchor(size: Size): Point {
  return { x: size.width, y: 0 };
}

/** {@link badgeAnchor} in diagram coordinates, for a placed node. */
export function placedBadgeAnchor(box: NodeBox): Point {
  return shiftedBy(badgeAnchor(box.size), box.position);
}

/** How far a badge reaches from the point it hangs on. */
export type BadgeExtent = {
  readonly radius: number;
  readonly depth: number;
};

/**
 * How far a badge reaches from the point it hangs on: `radius` to either
 * side and above, `depth` below, where a secondary badge and a flag mark
 * stack.
 */
export function badgeExtent(badge: ThreatBadge): BadgeExtent {
  if (badge.kind === 'flag-only') {
    return { radius: badgeRadius.flag, depth: badgeRadius.flag };
  }
  return {
    radius: badgeRadius.primary,
    depth: badge.flagged
      ? flagCentre(badge) + badgeRadius.flag
      : countsDepth(badge),
  };
}

/** The box a badge fills when it hangs on `at`, in the coordinates of `at`. */
export function badgeBox(at: Point, badge: ThreatBadge): Box {
  const extent = badgeExtent(badge);
  return {
    minX: at.x - extent.radius,
    minY: at.y - extent.radius,
    maxX: at.x + extent.radius,
    maxY: at.y + extent.depth,
  };
}

/**
 * The stacked threat badge, hanging on `at`. A counted badge's primary
 * carries the count over the mark of its severity, so the tone repeats what
 * the mark already says rather than carrying it alone. `countOffset` and
 * `markOffset` keep the two apart by a margin of about 1.6 user units, so a
 * mark carrying a diacritic, such as the fr-CA high-severity `É`, clears the
 * count above it at the default export size. The secondary sits beneath the
 * primary and is left out where the model gives the two nothing to say
 * apart, and the flag mark sits beneath both. A flag-only badge is the flag
 * mark alone, centred on `at`.
 */
export function ThreatBadgeGlyph({
  badge,
  at,
  marks,
}: {
  readonly badge: ThreatBadge;
  readonly at: Point;
  readonly marks: BadgeMarks;
}): ReactElement {
  return (
    <g className={canvasClassNames.badge} transform={translate(at)}>
      {badge.kind === 'flag-only' ? (
        <FlagMarkGlyph centre={0} mark={marks.flag} />
      ) : (
        <>
          <g className={canvasClassNames.badgePrimary}>
            <circle
              className={severityToneClass[badge.severity]}
              r={svgNumber(badgeRadius.primary)}
            />
            <text
              className={canvasClassNames.badgeCount}
              y={svgNumber(countOffset)}
            >
              {badge.count}
            </text>
            <text
              className={canvasClassNames.badgeMark}
              y={svgNumber(markOffset)}
            >
              {marks.severity[badge.severity]}
            </text>
          </g>
          {badge.secondary === 0 ? null : (
            <g
              className={canvasClassNames.badgeSecondary}
              transform={translate({ x: 0, y: secondaryCentre })}
            >
              <circle
                className={severityToneClass.undecided}
                r={svgNumber(badgeRadius.secondary)}
              />
              <text className={canvasClassNames.badgeCount}>
                {badge.secondary}
              </text>
            </g>
          )}
          {badge.flagged ? (
            <FlagMarkGlyph centre={flagCentre(badge)} mark={marks.flag} />
          ) : null}
        </>
      )}
    </g>
  );
}

function FlagMarkGlyph({
  centre,
  mark,
}: {
  readonly centre: number;
  readonly mark: string;
}): ReactElement {
  const reach = badgeRadius.flag;
  return (
    <g
      className={canvasClassNames.badgeFlag}
      transform={translate({ x: 0, y: centre })}
    >
      <path
        className={canvasClassNames.toneFlag}
        d={`${polylinePath([
          { x: 0, y: -reach },
          { x: reach, y: reach },
          { x: -reach, y: reach },
        ])} Z`}
      />
      <text
        className={canvasClassNames.badgeMark}
        y={svgNumber(flagMarkOffset)}
      >
        {mark}
      </text>
    </g>
  );
}

function countsDepth(badge: CountedBadge): number {
  return badge.secondary === 0
    ? badgeRadius.primary
    : secondaryCentre + badgeRadius.secondary;
}

function flagCentre(badge: CountedBadge): number {
  return countsDepth(badge) + badgeGap + badgeRadius.flag;
}

function openCountsByElement(
  model: Model,
): Map<ElementId, Map<Severity, number>> {
  const counted = new Map<ElementId, Map<Severity, number>>();
  const open = openThreatsBySeverity(model);
  for (const severity of severitySchema.options) {
    for (const threat of open[severity]) {
      for (const element of new Set(threat.elements)) {
        const bySeverity = counted.get(element) ?? new Map<Severity, number>();
        bySeverity.set(severity, (bySeverity.get(severity) ?? 0) + 1);
        counted.set(element, bySeverity);
      }
    }
  }
  return counted;
}

function flaggedElements(model: Model): Set<ElementId> {
  return new Set(
    model.threats.flatMap((threat) =>
      threatFlags(model, threat).length === 0 ? [] : threat.elements,
    ),
  );
}

function badgeOf(
  bySeverity: ReadonlyMap<Severity, number>,
): Omit<CountedBadge, 'flagged'> {
  let count = 0;
  let worst: Severity = 'undecided';
  for (const [severity, held] of bySeverity) {
    count += held;
    if (severityRank[severity] > severityRank[worst]) {
      worst = severity;
    }
  }
  const undecided = bySeverity.get('undecided') ?? 0;
  return {
    kind: 'counted',
    count,
    severity: worst,
    secondary: undecided === count ? 0 : undecided,
  };
}
