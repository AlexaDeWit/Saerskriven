import type {
  AssumptionInput,
  MitigationInput,
  ThreatInput,
} from '@saerskriven/model';
import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import {
  labeledClause,
  unlinkedMitigationLine,
  type ImportContext,
} from './import-model.js';
import { tmbomNodeId } from './tmbom-graph.js';

/**
 * The TM-BOM threats, controls and assumptions as native records. A control
 * naming no threat becomes a line of the model description, and every
 * assumption applies to the model, so no record lacks a reference.
 */
export function tmbomRegister(document: TmbomDocument, context: ImportContext) {
  const sourceThreats = document.threats ?? [];
  const controls = document.controls ?? [];
  const threatIndex = context.index(
    sourceThreats,
    (threat) => threat.symbolic_name,
    'threats',
  );
  context.index(controls, (control) => control.symbolic_name, 'controls');
  const threats = tmbomThreats(document, sourceThreats, context);
  const { mitigations, descriptionLines } = tmbomControls(
    controls,
    context,
    threatIndex,
  );
  const assumptions = tmbomAssumptions(document, context);
  if (threats.length > 0) {
    context.report({ code: 'tmbom-threats-undecided' });
  }
  return { threats, mitigations, assumptions, descriptionLines };
}

function tmbomThreats(
  document: TmbomDocument,
  sourceThreats: NonNullable<TmbomDocument['threats']>,
  context: ImportContext,
): ThreatInput[] {
  const componentIndex = new Set(
    document.components.map((component) => component.symbolic_name),
  );
  return sourceThreats.map((threat, index) => {
    context.fields(threat, [
      'symbolic_name',
      'title',
      'description',
      'components_affected',
      'event',
    ]);
    for (const id of threat.components_affected ?? []) {
      if (!componentIndex.has(id)) {
        context.problem(['threats', index, 'components_affected'], {
          code: 'unknown-source-reference',
          parameters: { id, kind: 'component' },
        });
      }
    }
    return {
      id: context.id('tmbom-threat', threat.symbolic_name),
      number: index + 1,
      title: context.text([threat.title]),
      description: context.text([
        threat.description,
        ...labeledClause('Trigger: ', threat.event),
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
  controls: NonNullable<TmbomDocument['controls']>,
  context: ImportContext,
  threatIndex: ReadonlyMap<string, unknown>,
) {
  const mitigations: MitigationInput[] = [];
  const descriptionLines: string[] = [];
  for (const control of controls) {
    if (control.status === 'retired' || control.status === 'wont_do') {
      continue;
    }
    context.fields(control, [
      'symbolic_name',
      'title',
      'description',
      'threats',
      'status',
    ]);
    for (const id of control.threats) {
      if (!threatIndex.has(id)) {
        context.problem(['controls', control.symbolic_name, 'threats'], {
          code: 'unknown-source-reference',
          parameters: { id, kind: 'threat' },
        });
      }
    }
    const status =
      control.status === 'active'
        ? ('implemented' as const)
        : ('proposed' as const);
    if (control.threats.length === 0) {
      descriptionLines.push(
        unlinkedMitigationLine(
          context,
          {
            code: 'tmbom-control-unlinked',
            parameters: { name: control.symbolic_name },
          },
          [
            ...(control.title === ''
              ? ['Mitigation']
              : ['Mitigation: ', control.title]),
            ' (',
            status,
            ', source status ',
            control.status,
            ...(control.description === ''
              ? [').']
              : ['). ', control.description]),
          ],
        ),
      );
      continue;
    }
    if (control.status !== 'active' && control.status !== 'suggested') {
      context.report({
        code: 'tmbom-control-proposed',
        parameters: { name: control.symbolic_name },
      });
    }
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
): AssumptionInput[] {
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
  AssumptionInput['status']
>;
