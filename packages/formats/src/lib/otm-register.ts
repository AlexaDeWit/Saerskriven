import type {
  MitigationInput,
  MitigationStatus,
  ThreatInput,
  ThreatStatus,
} from '@saerskriven/model';
import type { OtmDocument } from '@saerskriven/wire-otm';
import {
  labeledClause,
  unlinkedMitigationLine,
  type ImportContext,
} from './import-model.js';

/**
 * The OTM threats and mitigations as native records, one threat record per
 * occurrence so each keeps its own treatment. A threat definition no
 * occurrence names becomes a threat on no element that does not apply to the
 * model: the file attached it to nothing, which says nothing of the whole
 * model. A mitigation definition no occurrence names becomes a line of the
 * model description.
 */
export function otmRegister(document: OtmDocument, context: ImportContext) {
  const definitions = context.index(
    document.threats ?? [],
    (item) => item.id,
    'threats',
  );
  const register: Register = {
    context,
    mitigationDefinitions: context.index(
      document.mitigations ?? [],
      (item) => item.id,
      'mitigations',
    ),
    threats: [],
    mitigations: [],
    referencedThreats: new Set(),
    referencedMitigations: new Set(),
  };
  for (const component of document.components ?? []) {
    addOccurrences(
      register,
      definitions,
      component.threats ?? [],
      context.id('otm-component', component.id),
    );
  }
  for (const flow of document.dataflows ?? []) {
    addOccurrences(
      register,
      definitions,
      flow.threats ?? [],
      context.id('otm-flow', flow.id),
    );
  }
  for (const definition of definitions.values()) {
    if (!register.referencedThreats.has(definition.id)) {
      addThreat(register, definition, undefined, 'unattached', []);
    }
  }
  return {
    threats: register.threats,
    mitigations: register.mitigations,
    descriptionLines: unlinkedMitigationLines(register),
  };
}

type Component = NonNullable<OtmDocument['components']>[number];

type Occurrence = NonNullable<Component['threats']>[number];

type Definition = NonNullable<OtmDocument['threats']>[number];

type MitigationDefinition = NonNullable<OtmDocument['mitigations']>[number];

type Register = {
  readonly context: ImportContext;
  readonly mitigationDefinitions: ReadonlyMap<string, MitigationDefinition>;
  readonly threats: ThreatInput[];
  readonly mitigations: MitigationInput[];
  readonly referencedThreats: Set<string>;
  readonly referencedMitigations: Set<string>;
};

function addOccurrences(
  register: Register,
  definitions: ReadonlyMap<string, Definition>,
  occurrences: readonly Occurrence[],
  owner: string,
): void {
  for (const occurrence of occurrences) {
    const definition = definitions.get(occurrence.threat);
    if (definition === undefined) {
      register.context.problem(['threats'], {
        code: 'unknown-source-reference',
        parameters: { id: occurrence.threat, kind: 'threat' },
      });
    } else {
      addThreat(register, definition, occurrence, owner, [owner]);
    }
  }
}

function addThreat(
  register: Register,
  definition: Definition,
  occurrence: Occurrence | undefined,
  owner: string,
  attached: readonly string[],
): void {
  const { context, threats, referencedThreats } = register;
  if (context.failure !== undefined) {
    return;
  }
  context.fields(definition, ['id', 'name', 'description']);
  if (referencedThreats.has(definition.id)) {
    context.report(
      { code: 'otm-threat-split', parameters: { id: definition.id } },
      'split',
    );
  }
  referencedThreats.add(definition.id);
  const id = context.id(
    'otm-threat',
    definition.id,
    owner,
    String(threats.length),
  );
  const state = occurrence?.state === '' ? undefined : occurrence?.state;
  if (occurrence !== undefined) {
    context.fields(occurrence, ['threat', 'state', 'mitigations']);
  }
  const status = otmThreatStatus(state, id, context);
  threats.push({
    id,
    number: threats.length + 1,
    title: context.text([definition.name]),
    description: context.text([
      definition.description ?? '',
      ...labeledClause('Source status: ', state),
    ]),
    category: {
      methodology: 'custom',
      methodologyName: 'OTM',
      category: 'Unspecified',
    },
    severity: 'undecided',
    status,
    elements: [...attached],
    appliesToModel: false,
  });
  context.report({
    code: 'otm-threat-undecided',
    parameters: { id: definition.id },
  });
  for (const mitigation of otmMitigations(register, occurrence, id)) {
    register.mitigations.push(mitigation);
  }
}

function otmMitigations(
  { context, mitigationDefinitions, referencedMitigations }: Register,
  occurrence: Occurrence | undefined,
  threatId: string,
): MitigationInput[] {
  const mitigations: MitigationInput[] = [];
  for (const [index, given] of (occurrence?.mitigations ?? []).entries()) {
    if (given === null || given.mitigation === null) {
      continue;
    }
    const mitigation = mitigationDefinitions.get(given.mitigation);
    if (mitigation === undefined) {
      context.problem(['mitigations', index], {
        code: 'unknown-source-reference',
        parameters: { id: given.mitigation, kind: 'mitigation' },
      });
      continue;
    }
    context.fields(given, ['mitigation', 'state']);
    context.fields(mitigation, ['id', 'name', 'description']);
    if (referencedMitigations.has(mitigation.id)) {
      context.report(
        { code: 'otm-mitigation-split', parameters: { id: mitigation.id } },
        'split',
      );
    }
    referencedMitigations.add(mitigation.id);
    const status = otmMitigationStatus(given.state);
    if (
      status === 'proposed' &&
      given.state !== 'required' &&
      given.state !== 'proposed' &&
      given.state !== ''
    ) {
      context.report({
        code: 'otm-mitigation-status-retained',
        parameters: {
          id: mitigation.id,
          status: given.state,
          threat: threatId,
        },
      });
    }
    mitigations.push({
      id: context.id('otm-mitigation', mitigation.id, threatId, String(index)),
      title: context.text([mitigation.name]),
      prose: context.text([
        mitigation.description ?? '',
        ...labeledClause('Source status: ', given.state),
      ]),
      status,
      threats: [threatId],
    });
  }
  return mitigations;
}

function unlinkedMitigationLines({
  context,
  mitigationDefinitions,
  referencedMitigations,
}: Register): string[] {
  return [...mitigationDefinitions.values()].flatMap((definition) => {
    if (referencedMitigations.has(definition.id)) {
      return [];
    }
    context.fields(definition, ['id', 'name', 'description']);
    const description = definition.description ?? '';
    return [
      unlinkedMitigationLine(
        context,
        {
          code: 'otm-mitigation-unlinked',
          parameters: { id: definition.id },
        },
        [
          ...(definition.name === ''
            ? ['Mitigation']
            : ['Mitigation: ', definition.name]),
          ...(description === '' ? [] : ['. ', description]),
        ],
      ),
    ];
  });
}

function otmThreatStatus(
  state: string | undefined,
  threat: string,
  context: ImportContext,
): ThreatStatus {
  switch (state) {
    case 'exposed':
    case 'open':
      return 'open';
    case 'mitigated':
      return 'mitigated';
    case 'accepted':
    case 'accepted-risk':
      return 'accepted-risk';
    case 'transferred':
      return 'transferred';
    case 'avoided':
      return 'avoided';
    case 'eliminated':
      return 'eliminated';
    case 'not-applicable':
      return 'not-applicable';
    case undefined:
    default:
      context.report({
        code: 'otm-threat-status-unmapped',
        parameters: { status: state, threat },
      });
      return 'open';
  }
}

function otmMitigationStatus(
  state: string | null | undefined,
): MitigationStatus {
  return state === 'implemented' || state === 'verified' ? state : 'proposed';
}
