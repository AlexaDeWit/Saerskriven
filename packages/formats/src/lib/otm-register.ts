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
 * occurrence so each keeps its own treatment. A mitigation definition no
 * occurrence names becomes a line of the model description.
 */
export function otmRegister(document: OtmDocument, context: ImportContext) {
  const { fields, report } = context;
  const definitions = context.index(
    document.threats ?? [],
    (item) => item.id,
    'threats',
  );
  const mitigationDefinitions = context.index(
    document.mitigations ?? [],
    (item) => item.id,
    'mitigations',
  );
  const threats: ThreatInput[] = [];
  const mitigations: MitigationInput[] = [];
  const referencedThreats = new Set<string>();
  const referencedMitigations = new Set<string>();
  const addThreat = (
    definition: Definition,
    occurrence: Occurrence | undefined,
    owner: string,
    attached: readonly string[],
  ): void => {
    if (context.failure !== undefined) {
      return;
    }
    fields(definition, ['id', 'name', 'description']);
    if (referencedThreats.has(definition.id)) {
      report(
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
    const occurrenceState = occurrence?.state;
    const state = occurrenceState === '' ? undefined : occurrenceState;
    if (occurrence !== undefined) {
      fields(occurrence, ['threat', 'state', 'mitigations']);
    }
    const status = otmThreatStatus(state, context);
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
    });
    report({
      code: 'otm-threat-undecided',
      parameters: { id: definition.id },
    });
    for (const mitigation of otmMitigations(
      occurrence,
      id,
      mitigationDefinitions,
      referencedMitigations,
      context,
    )) {
      mitigations.push(mitigation);
    }
  };
  const occurrences = (
    items: readonly Occurrence[],
    owner: string,
    attached: readonly string[],
  ): void => {
    for (const occurrence of items) {
      const definition = definitions.get(occurrence.threat);
      if (definition === undefined) {
        context.problem(
          ['threats'],
          `Unknown threat ${JSON.stringify(occurrence.threat)}`,
        );
      } else {
        addThreat(definition, occurrence, owner, attached);
      }
    }
  };
  for (const component of document.components ?? []) {
    const id = context.id('otm-component', component.id);
    occurrences(component.threats ?? [], id, [id]);
  }
  for (const flow of document.dataflows ?? []) {
    const id = context.id('otm-flow', flow.id);
    occurrences(flow.threats ?? [], id, [id]);
  }
  for (const definition of definitions.values()) {
    if (!referencedThreats.has(definition.id)) {
      addThreat(definition, undefined, 'unattached', []);
    }
  }
  const descriptionLines = [...mitigationDefinitions.values()].flatMap(
    (definition) => {
      if (referencedMitigations.has(definition.id)) {
        return [];
      }
      fields(definition, ['id', 'name', 'description']);
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
    },
  );
  return { threats, mitigations, descriptionLines };
}

type Component = NonNullable<OtmDocument['components']>[number];

type Occurrence = NonNullable<Component['threats']>[number];

type Definition = NonNullable<OtmDocument['threats']>[number];

type MitigationDefinition = NonNullable<OtmDocument['mitigations']>[number];

function otmMitigations(
  occurrence: Occurrence | undefined,
  threatId: string,
  definitions: ReadonlyMap<string, MitigationDefinition>,
  referenced: Set<string>,
  context: ImportContext,
): MitigationInput[] {
  const { fields, report } = context;
  const mitigations: MitigationInput[] = [];
  for (const [index, given] of (occurrence?.mitigations ?? []).entries()) {
    if (given === null || given.mitigation === null) {
      continue;
    }
    const mitigation = definitions.get(given.mitigation);
    if (mitigation === undefined) {
      context.problem(
        ['mitigations', index],
        `Unknown mitigation ${JSON.stringify(given.mitigation)}`,
      );
      continue;
    }
    fields(given, ['mitigation', 'state']);
    fields(mitigation, ['id', 'name', 'description']);
    if (referenced.has(mitigation.id)) {
      report(
        { code: 'otm-mitigation-split', parameters: { id: mitigation.id } },
        'split',
      );
    }
    referenced.add(mitigation.id);
    const status = otmMitigationStatus(given.state);
    if (
      status === 'proposed' &&
      given.state !== 'required' &&
      given.state !== 'proposed' &&
      given.state !== ''
    ) {
      report({
        code: 'otm-mitigation-status-retained',
        parameters: { id: mitigation.id, status: given.state },
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

function otmThreatStatus(
  state: string | undefined,
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
        parameters: { status: state },
      });
      return 'open';
  }
}

function otmMitigationStatus(
  state: string | null | undefined,
): MitigationStatus {
  return state === 'implemented' || state === 'verified' ? state : 'proposed';
}
