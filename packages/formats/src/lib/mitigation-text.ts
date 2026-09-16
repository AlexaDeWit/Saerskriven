import {
  inNumberOrder,
  type MitigationInput,
  type MitigationStatus,
  type ThreatStatus,
} from '@saerskriven/model';

/** One threat of a format that holds one mitigation text per threat. */
export type ThreatWithText = {
  readonly id: string;
  readonly number: number;
  readonly status: ThreatStatus;
  readonly text: string;
};

/**
 * The status a threat's one mitigation text reads as: `implemented` on a
 * `mitigated` threat and `proposed` on any other. It is inferred only across
 * a one-to-one correspondence between a threat and its text.
 */
export function inferredMitigationStatus(
  status: ThreatStatus,
): MitigationStatus {
  return status === 'mitigated' ? 'implemented' : 'proposed';
}

/**
 * One mitigation record for each threat with a non-empty text, in threat
 * number order whatever order `threats` holds, so the Threat Dragon read and
 * the v1 to v2 migration make the same records of one model: an empty title,
 * the text as its prose, the status {@link inferredMitigationStatus} gives,
 * and a link to that threat alone.
 *
 * A record's id is `<threat id>-mitigation`, or that with the first free
 * suffix of `-2`, `-3` and on, where `taken` holds every id the model already
 * has and each chosen id joins it before the next threat. Where no taken id
 * ends in `-mitigation`, no suffix is needed.
 */
export function mitigationsFromText(
  threats: readonly ThreatWithText[],
  taken: Iterable<string>,
): MitigationInput[] {
  const held = new Set(taken);
  return inNumberOrder(threats).flatMap((threat) => {
    if (threat.text === '') {
      return [];
    }
    const id = freeId(`${threat.id}-mitigation`, held);
    held.add(id);
    return [
      {
        id,
        title: '',
        prose: threat.text,
        status: inferredMitigationStatus(threat.status),
        threats: [threat.id],
      },
    ];
  });
}

/**
 * The records of a model, or of a document mapped to one, whose ids a
 * mitigation id must not repeat.
 */
export type IdHolder = {
  readonly diagrams: readonly (Identified & {
    readonly elements: readonly Identified[];
  })[];
  readonly threats: readonly Identified[];
  readonly mitigations: readonly Identified[];
  readonly assumptions: readonly Identified[];
};

/** Every id `holder` holds, for the `taken` of {@link mitigationsFromText}. */
export function idsHeld(holder: IdHolder): string[] {
  return [
    ...holder.diagrams.flatMap((diagram) => [
      diagram.id,
      ...diagram.elements.map((element) => element.id),
    ]),
    ...holder.threats.map((threat) => threat.id),
    ...holder.mitigations.map((mitigation) => mitigation.id),
    ...holder.assumptions.map((assumption) => assumption.id),
  ];
}

type Identified = { readonly id: string };

function freeId(base: string, held: ReadonlySet<string>): string {
  let candidate = base;
  for (let suffix = 2; held.has(candidate); suffix += 1) {
    candidate = `${base}-${String(suffix)}`;
  }
  return candidate;
}
