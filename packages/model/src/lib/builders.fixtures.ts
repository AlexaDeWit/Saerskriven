import { parsedFixture } from '../fixtures.js';
import {
  assumptionSchema,
  type Assumption,
  type AssumptionInput,
} from './assumptions.js';
import type { Point, Size } from './geometry.js';
import {
  mitigationSchema,
  type Mitigation,
  type MitigationInput,
} from './mitigations.js';
import type { Diagram } from './model.js';
import type { Model } from './parse.js';
import { threatSchema, type Threat, type ThreatInput } from './threats.js';

/**
 * An element drawn as a box, in scope and undescribed, in the schema's input
 * shape. Named by its id unless a name is given.
 */
export const boxAt = (
  id: string,
  x: number,
  y: number,
  kind = 'actor',
  size: Size = { width: 120, height: 80 },
  name = id,
) => ({
  kind,
  id,
  name,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size,
});

/** A flow end attached to an element on no pinned side. */
export const attached = (element: string) => ({ kind: 'attached', element });

/** A one-way flow named `Flow` under the id `el-flow`, between two ends. */
export const flowBetween = (
  source: unknown,
  target: unknown,
  waypoints: readonly Point[],
) => ({
  kind: 'flow',
  id: 'el-flow',
  name: 'Flow',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source,
  target,
  waypoints,
  bidirectional: false,
});

/** A straight one-way flow between two elements, named by its id unless a name is given. */
export const flowFrom = (
  id: string,
  source: string,
  target: string,
  name = id,
) => ({
  ...flowBetween(attached(source), attached(target), []),
  id,
  name,
});

/** A trust boundary drawn as a curve through the waypoints. */
export const curveBoundary = (
  id: string,
  waypoints: readonly Point[],
  name = '',
) => ({
  kind: 'trust-boundary',
  id,
  name,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  shape: { kind: 'curve', waypoints },
});

/**
 * A threat under `threat-<number>`: an open, medium STRIDE tampering threat
 * on no element unless the fields say otherwise.
 */
export const threatOf = (
  fields: { readonly number: number } & Partial<ThreatInput>,
): Threat =>
  threatSchema.parse({
    id: `threat-${String(fields.number)}`,
    title: `Threat ${String(fields.number)}`,
    category: { methodology: 'STRIDE', category: 'tampering' },
    severity: 'medium',
    status: 'open',
    description: '',
    elements: [],
    ...fields,
  });

/** An untitled, proposed mitigation with no prose unless the fields say otherwise. */
export const mitigationOf = (
  fields: Pick<MitigationInput, 'id'> &
    Partial<Omit<MitigationInput, 'threats'>> & {
      readonly threats: readonly string[];
    },
): Mitigation =>
  mitigationSchema.parse({
    title: '',
    prose: '',
    status: 'proposed',
    ...fields,
  });

/** An unconfirmed assumption with no prose, scoped to its threats unless the fields say otherwise. */
export const assumptionOf = (
  fields: Pick<AssumptionInput, 'id'> &
    Partial<Omit<AssumptionInput, 'threats'>> & {
      readonly threats: readonly string[];
    },
): Assumption =>
  assumptionSchema.parse({
    prose: '',
    status: 'unconfirmed',
    appliesToModel: false,
    ...fields,
  });

type Parts<D, T extends { readonly number: number }, M, A> = {
  readonly title?: string;
  readonly diagrams?: readonly D[];
  readonly threats?: readonly T[];
  readonly mitigations?: readonly M[];
  readonly assumptions?: readonly A[];
};

const envelope = <D, T extends { readonly number: number }, M, A>({
  title = 'Sample',
  diagrams = [],
  threats = [],
  mitigations = [],
  assumptions = [],
}: Parts<D, T, M, A>) => ({
  metadata: { title, owner: '', description: '', contributors: [] },
  diagrams: [...diagrams],
  threats: [...threats],
  lastIssuedThreatNumber: Math.max(0, ...threats.map(({ number }) => number)),
  mitigations: [...mitigations],
  assumptions: [...assumptions],
});

/**
 * A model assembled from records already typed, without a parse, so a
 * renderer spec can hand over what the parser would refuse, such as a
 * control character in a title or a threat linked to no element the model
 * holds. The last issued number is the highest threat number.
 */
export const modelFrom = (
  parts: Parts<Diagram, Threat, Mitigation, Assumption>,
): Model => envelope(parts);

/**
 * A parsed model of the given parts in the schema's input shape. `elements`
 * become one diagram `d` titled `Diagram`, `diagrams` replace it, and the
 * last issued number is the highest threat number.
 */
export const modelWith = ({
  elements,
  diagrams = elements === undefined
    ? []
    : [{ id: 'd', title: 'Diagram', elements: [...elements] }],
  ...parts
}: Parts<unknown, { readonly number: number }, unknown, unknown> & {
  readonly elements?: readonly unknown[];
}): Model => parsedFixture(envelope({ ...parts, diagrams }));
