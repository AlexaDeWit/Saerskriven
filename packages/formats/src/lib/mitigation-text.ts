import {
  inNumberOrder,
  type mitigationSchema,
  type MitigationStatus,
  type ThreatStatus,
} from '@saerskriven/model';
import type { z } from 'zod';

type MitigationInput = z.input<typeof mitigationSchema>;

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
 * number order whatever order `threats` holds, so every format that holds one
 * text per threat makes the same records in the same order: an empty title,
 * the text as its prose, the status {@link inferredMitigationStatus} gives,
 * and a link to that threat alone.
 *
 * A record's id is `<threat id>-mitigation`, or that with the first of `-2`,
 * `-3` and on that is free, where `taken` holds every id the model already
 * has and each id chosen joins it before the next threat. So no chosen id
 * repeats one in `taken` or another chosen here. Where `taken` holds no id
 * ending in `-mitigation`, no suffix is ever needed, since distinct threat
 * ids give distinct ids, and a record's id then depends on its threat's id
 * alone.
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

type Identified = { readonly id: string };

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

function freeId(base: string, held: ReadonlySet<string>): string {
  let candidate = base;
  for (let suffix = 2; held.has(candidate); suffix += 1) {
    candidate = `${base}-${String(suffix)}`;
  }
  return candidate;
}
