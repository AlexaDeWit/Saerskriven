import { parseModel, type Model } from '@saerskriven/model';
import { Either } from 'effect';

declare global {
  interface Window {
    readonly saerskrivenDevelopmentModel?: unknown;
  }
}

/** The global a development session puts a model document on before the studio's own modules run. */
export const developmentModelKey = 'saerskrivenDevelopmentModel';

/** The injected model in a DEV build, and nothing in production or for a document that fails to parse. */
export function developmentModel(): Model | undefined {
  const injected = import.meta.env.DEV
    ? window[developmentModelKey]
    : undefined;
  return injected === undefined
    ? undefined
    : Either.getOrUndefined(parseModel(injected));
}
