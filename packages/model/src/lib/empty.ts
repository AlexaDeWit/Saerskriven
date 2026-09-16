import { Either } from 'effect';
import { parseModel, type Model } from './parse.js';

/**
 * A model with nothing in it: metadata blank, every collection empty, and no
 * threat number issued yet. It comes through {@link parseModel}, and a parse
 * failure throws when the package loads.
 */
export const emptyModel: Model = Either.getOrThrowWith(
  parseModel({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: [],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  }),
  () => new Error('The empty model does not parse.'),
);
