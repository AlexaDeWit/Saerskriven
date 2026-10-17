import type { OtmDocument } from '@saerskriven/wire-otm';
import { placedModelFrom } from './codec.js';
import { importContext } from './import-model.js';
import { otmGraph } from './otm-graph.js';
import { otmRegister } from './otm-register.js';

/**
 * Converts OTM into a native model, a diagram for each diagram
 * representation and a threat for each occurrence. `model` parses the
 * conversion once `context` holds no failure and no issue.
 */
export function mapOtm(document: OtmDocument) {
  const context = importContext();
  context.fields(document, [
    'otmVersion',
    'project',
    'components',
    'dataflows',
    'trustZones',
    'threats',
    'mitigations',
    'assets',
    'representations',
  ]);
  const project = context.fields(document.project, [
    'id',
    'name',
    'description',
    'owner',
  ]);
  const graph = otmGraph(document, context);
  const { threats, mitigations, descriptionLines } = otmRegister(
    document,
    context,
  );
  context.omitted(document);
  const input = {
    metadata: {
      title: project.name,
      owner: project.owner ?? '',
      description: context.text([
        project.description ?? '',
        ...descriptionLines,
      ]),
      contributors: [],
    },
    elements: graph.elements,
    diagrams: graph.diagrams,
    threats,
    mitigations,
    assumptions: [],
    lastIssuedThreatNumber: threats.length,
  };
  return { context, model: () => placedModelFrom(input) };
}
