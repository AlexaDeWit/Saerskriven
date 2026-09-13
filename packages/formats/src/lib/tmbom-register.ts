import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import {
  unlinkedMitigationLine,
  type ImportAssumption,
  type ImportContext,
  type ImportMitigation,
  type ImportThreat,
} from './import-model.js';
import { tmbomNodeId } from './tmbom-graph.js';

/**
 * Imports threats, controls and assumptions. A control naming no threat
 * becomes a model description line, and every assumption applies to the
 * model, so no record lacks a reference.
 */
export function tmbomRegister(document: TmbomDocument, context: ImportContext) {
  const threatIndex = context.index(
    document.threats ?? [],
    (threat) => threat.symbolic_name,
    'threats',
  );
  context.index(
    document.controls ?? [],
    (control) => control.symbolic_name,
    'controls',
  );
  const threats = tmbomThreats(document, context);
  const { mitigations, descriptionLines } = tmbomControls(
    document,
    context,
    threatIndex,
  );
  const assumptions = tmbomAssumptions(document, context);
  if (threats.length > 0)
    context.report(
      'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.',
    );
  return { threats, mitigations, assumptions, descriptionLines };
}

function tmbomThreats(
  document: TmbomDocument,
  context: ImportContext,
): ImportThreat[] {
  const componentIndex = new Set(
    document.components.map((component) => component.symbolic_name),
  );
  return (document.threats ?? []).map((threat, index) => {
    context.fields(threat, [
      'symbolic_name',
      'title',
      'description',
      'components_affected',
      'event',
    ]);
    for (const id of threat.components_affected ?? [])
      if (!componentIndex.has(id))
        context.problem(
          ['threats', index, 'components_affected'],
          `Unknown component ${JSON.stringify(id)}`,
        );
    return {
      id: context.id('tmbom-threat', threat.symbolic_name),
      number: index + 1,
      title: context.text([threat.title]),
      description: context.text([
        threat.description,
        `Trigger: ${threat.event}`,
      ]),
      severity: 'undecided',
      status: 'open',
      category: {
        methodology: 'custom',
        methodologyName: 'TM-BOM',
        category: 'Unspecified',
      },
      elements: (threat.components_affected ?? []).map((id) =>
        tmbomNodeId('process', id, context),
      ),
    };
  });
}

function tmbomControls(
  document: TmbomDocument,
  context: ImportContext,
  threatIndex: ReadonlyMap<string, unknown>,
) {
  const mitigations: ImportMitigation[] = [];
  const descriptionLines: string[] = [];
  for (const control of document.controls ?? []) {
    if (control.status === 'retired' || control.status === 'wont_do') continue;
    context.fields(control, [
      'symbolic_name',
      'title',
      'description',
      'threats',
      'status',
    ]);
    for (const id of control.threats)
      if (!threatIndex.has(id))
        context.problem(
          ['controls', control.symbolic_name, 'threats'],
          `Unknown threat ${JSON.stringify(id)}`,
        );
    const status =
      control.status === 'active'
        ? ('implemented' as const)
        : ('proposed' as const);
    if (control.threats.length === 0) {
      descriptionLines.push(
        unlinkedMitigationLine(
          context,
          `Control ${JSON.stringify(control.symbolic_name)}`,
          [
            'Mitigation: ',
            control.title,
            ' (',
            status,
            ', source status ',
            control.status,
            '). ',
            control.description,
          ],
        ),
      );
      continue;
    }
    if (control.status !== 'active' && control.status !== 'suggested')
      context.report(
        `Control ${JSON.stringify(control.symbolic_name)} imports as proposed. Its original status remains in the description.`,
      );
    mitigations.push({
      id: context.id('tmbom-control', control.symbolic_name),
      title: context.text([control.title]),
      prose: context.text([
        control.description,
        `Source status: ${control.status}`,
      ]),
      status,
      threats: control.threats.map((id) => context.id('tmbom-threat', id)),
    });
  }
  return { mitigations, descriptionLines };
}

function tmbomAssumptions(
  document: TmbomDocument,
  context: ImportContext,
): ImportAssumption[] {
  return (document.assumptions ?? []).map((assumption, index) => {
    context.fields(assumption, ['description', 'validity']);
    return {
      id: context.id('tmbom-assumption', String(index)),
      prose: context.text([assumption.description]),
      status: assumptionStatus[assumption.validity],
      threats: [],
      appliesToModel: true,
    };
  });
}

const assumptionStatus = {
  confirmed: 'valid',
  rejected: 'invalidated',
  unconfirmed: 'unconfirmed',
} as const satisfies Record<
  NonNullable<TmbomDocument['assumptions']>[number]['validity'],
  ImportAssumption['status']
>;
