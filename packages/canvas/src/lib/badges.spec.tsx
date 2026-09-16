import { severitySchema, type Severity, type Threat } from '@saerskriven/model';
import {
  assumptionOf,
  boxAt,
  elementId,
  mitigationOf,
  modelWith,
  threatOf,
} from '@saerskriven/model/fixtures';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  badgeBox,
  badgeExtent,
  badgesByElement,
  flagMark,
  severityMark,
  severityRank,
  ThreatBadgeGlyph,
  type ThreatBadge,
} from './badges.js';
import { everyGlyphModel } from './canvas.fixtures.js';
import { canvasClassNames, severityToneClass } from './stylesheet.js';
import { badgeRadius, canvasType, strokeWidths } from './tokens.js';
import { textExtent } from './typography.js';

const badges = badgesByElement(everyGlyphModel);

const counted = (
  count: number,
  severity: Severity,
  secondary: number,
  flagged = false,
): ThreatBadge => ({ kind: 'counted', count, severity, secondary, flagged });

const flagOnly: ThreatBadge = { kind: 'flag-only' };

type Records = {
  readonly mitigations?: unknown[];
  readonly assumptions?: unknown[];
};

const badgeOfOne = (
  threats: readonly Threat[],
  records?: Records,
): ThreatBadge | undefined =>
  badgesByElement(
    modelWith({
      elements: [
        boxAt('el-one', 0, 0, 'actor', { width: 10, height: 10 }, 'One'),
      ],
      threats,
      ...records,
    }),
  ).get(elementId('el-one'));

const stacked = renderToStaticMarkup(
  <ThreatBadgeGlyph badge={counted(12, 'high', 12)} at={{ x: 0, y: 0 }} />,
);

const countOffsets = [
  ...stacked.matchAll(
    new RegExp(
      `class="${canvasClassNames.badgeCount}"(?: y="(-?[\\d.]+)")?`,
      'gu',
    ),
  ),
].map((found) => Number(found[1] ?? '0'));

const clearanceInsideRing = (
  radius: number,
  fontSize: number,
  offset: number,
  count: string,
): number => {
  const box = textExtent([count], fontSize);
  const corner = Math.hypot(box.width / 2, Math.abs(offset) + box.height / 2);
  return radius - strokeWidths.badgeRing / 2 - corner;
};

describe('severityRank', () => {
  it('ranks every severity the model declares and no other', () => {
    expect(new Set(Object.keys(severityRank))).toEqual(
      new Set<string>(severitySchema.options),
    );
  });

  it('ranks the assessed severities worst last, undecided below them all', () => {
    expect(severityRank.undecided).toBe(0);
    expect(severityRank.low).toBeLessThan(severityRank.medium);
    expect(severityRank.medium).toBeLessThan(severityRank.high);
    expect(severityRank.high).toBeLessThan(severityRank.critical);
  });
});

describe('severityMark', () => {
  it('marks every severity the model declares and no other', () => {
    expect(new Set(Object.keys(severityMark))).toEqual(
      new Set<string>(severitySchema.options),
    );
  });

  it('gives each severity a mark of its own, so no two badges read alike', () => {
    expect(new Set(Object.values(severityMark)).size).toBe(
      severitySchema.options.length,
    );
  });
});

describe('badgesByElement', () => {
  it('colours the badge by the worst severity assessed among the open threats', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'low',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 2,
          severity: 'critical',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 3,
          severity: 'medium',
          status: 'open',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(3, 'critical', 0));
  });

  it('counts the undecided threats in a second badge beside the assessed', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'high',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 2,
          severity: 'undecided',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 3,
          severity: 'undecided',
          status: 'open',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(3, 'high', 2));
  });

  it('shows the neutral badge alone where every open threat is undecided', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'undecided',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 2,
          severity: 'undecided',
          status: 'open',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(2, 'undecided', 0));
  });

  it('counts a threat in any status but open not at all', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'critical',
          status: 'transferred',
          elements: ['el-one'],
        }),
        threatOf({
          number: 2,
          severity: 'high',
          status: 'accepted-risk',
          elements: ['el-one'],
        }),
        threatOf({
          number: 3,
          severity: 'medium',
          status: 'open',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(1, 'medium', 0));
  });

  it('gives an element with no open threat no badge at all', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'critical',
          status: 'accepted-risk',
          elements: ['el-one'],
        }),
      ]),
    ).toBeUndefined();
  });

  it('counts a threat that names one element twice once', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'low',
          status: 'open',
          elements: ['el-one', 'el-one'],
        }),
      ]),
    ).toEqual(counted(1, 'low', 0));
  });

  it('badges a flow as it badges any other element', () => {
    expect(badges.get(elementId('el-request'))).toEqual(counted(1, 'low', 0));
  });
});

describe('the flag on a badge', () => {
  it('flags the counted badge of an element an open flagged threat names', () => {
    expect(
      badgeOfOne(
        [
          threatOf({
            number: 1,
            severity: 'high',
            status: 'open',
            elements: ['el-one'],
          }),
        ],
        {
          assumptions: [
            assumptionOf({
              id: 'as-invalidated',
              status: 'invalidated',
              threats: ['threat-1'],
            }),
          ],
        },
      ),
    ).toEqual(counted(1, 'high', 0, true));
  });

  it('leaves the same element unflagged where no threat on it is flagged', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'high',
          status: 'open',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(1, 'high', 0));
  });

  it('flags the count of open threats for a flagged threat in another status', () => {
    expect(
      badgeOfOne([
        threatOf({
          number: 1,
          severity: 'high',
          status: 'open',
          elements: ['el-one'],
        }),
        threatOf({
          number: 2,
          severity: 'low',
          status: 'mitigated',
          elements: ['el-one'],
        }),
      ]),
    ).toEqual(counted(1, 'high', 0, true));
  });

  it('gives a mitigated threat with no implemented work a flag-only badge', () => {
    const mitigated = [
      threatOf({
        number: 1,
        severity: 'high',
        status: 'mitigated',
        elements: ['el-one'],
      }),
    ];
    expect(
      badgeOfOne(mitigated, {
        mitigations: [
          mitigationOf({
            id: 'mi-proposed',
            status: 'proposed',
            threats: ['threat-1'],
          }),
        ],
      }),
    ).toEqual(flagOnly);
    expect(
      badgeOfOne(mitigated, {
        mitigations: [
          mitigationOf({
            id: 'mi-proposed',
            status: 'proposed',
            threats: ['threat-1'],
          }),
          mitigationOf({
            id: 'mi-implemented',
            status: 'implemented',
            threats: ['threat-1'],
          }),
        ],
      }),
    ).toBeUndefined();
  });

  it.each(['valid', 'unconfirmed'] as const)(
    'raises no flag for a threat resting only on a %s assumption',
    (status) => {
      expect(
        badgeOfOne(
          [
            threatOf({
              number: 1,
              severity: 'high',
              status: 'open',
              elements: ['el-one'],
            }),
            threatOf({
              number: 2,
              severity: 'low',
              status: 'accepted-risk',
              elements: ['el-one'],
            }),
          ],
          {
            assumptions: [
              assumptionOf({
                id: `as-${status}`,
                status,
                threats: ['threat-1', 'threat-2'],
              }),
            ],
          },
        ),
      ).toEqual(counted(1, 'high', 0));
    },
  );

  it('raises no flag from an invalidated assumption that links no threat on the element', () => {
    expect(
      badgeOfOne(
        [
          threatOf({
            number: 1,
            severity: 'high',
            status: 'open',
            elements: ['el-one'],
          }),
        ],
        {
          assumptions: [
            assumptionOf({
              id: 'as-invalidated',
              status: 'invalidated',
              threats: [],
              appliesToModel: true,
            }),
          ],
        },
      ),
    ).toEqual(counted(1, 'high', 0));
  });

  it('flags a flow as it flags any other element', () => {
    expect(badges.get(elementId('el-probe'))).toEqual(
      counted(1, 'medium', 0, true),
    );
    expect(badges.get(elementId('el-edge-zone'))).toEqual(flagOnly);
  });
});

describe('badgeExtent', () => {
  it('reaches its own radius down where there is no second badge', () => {
    const extent = badgeExtent(counted(1, 'low', 0));
    expect(extent.depth).toBe(extent.radius);
  });

  it('reaches past the second badge where one is drawn', () => {
    expect(badgeExtent(counted(3, 'low', 1)).depth).toBeGreaterThan(
      badgeExtent(counted(1, 'low', 0)).depth,
    );
  });

  it('reaches past the flag mark stacked under the counts', () => {
    expect(badgeExtent(counted(3, 'low', 1, true)).depth).toBeGreaterThan(
      badgeExtent(counted(3, 'low', 1)).depth,
    );
    expect(badgeExtent(counted(1, 'low', 0, true)).depth).toBeGreaterThan(
      badgeExtent(counted(1, 'low', 0)).depth,
    );
  });

  it('reaches no further than the flag mark for a flag-only badge', () => {
    expect(badgeExtent(flagOnly)).toEqual({
      radius: badgeRadius.flag,
      depth: badgeRadius.flag,
    });
  });

  it('reaches the same either side, whatever is stacked below', () => {
    expect(badgeExtent(counted(3, 'low', 1)).radius).toBe(
      badgeExtent(counted(1, 'low', 0)).radius,
    );
    expect(badgeExtent(counted(3, 'low', 1, true)).radius).toBe(
      badgeExtent(counted(1, 'low', 0)).radius,
    );
  });
});

describe('the ring a badge cuts itself out with', () => {
  it('leaves a two-digit count inside the disc it cuts, at both badge sizes, the ring and the count being the one cream and a count touching it reading as none', () => {
    const [primary, secondary] = countOffsets;
    expect(countOffsets).toHaveLength(2);
    expect(
      clearanceInsideRing(
        badgeRadius.primary,
        canvasType.badgeCount,
        primary,
        '12',
      ),
    ).toBeGreaterThan(0);
    expect(
      clearanceInsideRing(
        badgeRadius.secondary,
        canvasType.secondaryBadgeCount,
        secondary,
        '12',
      ),
    ).toBeGreaterThan(0);
  });
});

describe('ThreatBadgeGlyph', () => {
  it('draws the count in the tone of the badge severity', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph badge={counted(4, 'high', 0)} at={{ x: 160, y: 0 }} />,
    );
    expect(markup).toContain('transform="translate(160, 0)"');
    expect(markup).toContain(`class="${severityToneClass.high}"`);
    expect(markup).toContain('>4</text>');
    expect(markup).not.toContain(canvasClassNames.badgeSecondary);
  });

  it('marks the severity in text, so the tone is not the only thing saying it', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph badge={counted(4, 'high', 0)} at={{ x: 0, y: 0 }} />,
    );
    expect(markup).toContain(canvasClassNames.badgeMark);
    expect(markup).toContain(`>${severityMark.high}</text>`);
  });

  it('stacks the undecided count under the primary badge', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph
        badge={counted(5, 'critical', 2)}
        at={{ x: 0, y: 0 }}
      />,
    );
    expect(markup).toContain(canvasClassNames.badgeSecondary);
    expect(markup).toContain(`class="${severityToneClass.undecided}"`);
    expect(markup).toContain('>2</text>');
  });

  it('marks a flag with a triangle and a glyph no severity mark uses', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph
        badge={counted(4, 'high', 2, true)}
        at={{ x: 0, y: 0 }}
      />,
    );
    expect(markup).toContain(`class="${canvasClassNames.badgeFlag}"`);
    expect(markup).toContain(`class="${canvasClassNames.toneFlag}"`);
    expect(markup).toContain(`>${flagMark}</text>`);
    expect(markup).toContain('>4</text>');
    expect(Object.values(severityMark)).not.toContain(flagMark);
  });

  it('draws the flag mark beneath the counts, inside the box the badge reports', () => {
    const badge = counted(4, 'high', 2, true);
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph badge={badge} at={{ x: 0, y: 0 }} />,
    );
    const centre = Number(
      new RegExp(
        `class="${canvasClassNames.badgeFlag}" transform="translate\\(0, ([\\d.]+)\\)"`,
        'u',
      ).exec(markup)?.[1],
    );
    expect(centre - badgeRadius.flag).toBeGreaterThan(
      badgeExtent(counted(4, 'high', 2)).depth,
    );
    expect(centre + badgeRadius.flag).toBe(
      badgeBox({ x: 0, y: 0 }, badge).maxY,
    );
  });

  it('draws a flag-only badge as the flag mark with no count or severity', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph badge={flagOnly} at={{ x: 0, y: 0 }} />,
    );
    expect(markup).toContain(canvasClassNames.badgeFlag);
    expect(markup).not.toContain(canvasClassNames.badgePrimary);
    expect(markup).not.toContain(canvasClassNames.badgeCount);
  });

  it('leaves the flag mark off an unflagged badge', () => {
    expect(
      renderToStaticMarkup(
        <ThreatBadgeGlyph badge={counted(4, 'high', 2)} at={{ x: 0, y: 0 }} />,
      ),
    ).not.toContain(canvasClassNames.badgeFlag);
  });
});
