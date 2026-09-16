import type {
  Actor,
  FlowInput,
  Process,
  Store,
  TrustBoundaryInput,
} from '@saerskriven/model';

/**
 * The actor facts `source` holds, for the native and Threat Dragon mappings.
 * An absent fact stays absent, and an explicit `false` or empty value is kept.
 */
export function actorProperties(source: Pick<Actor, 'providesAuthentication'>) {
  return presentProperties(source, ['providesAuthentication']);
}

/**
 * The process facts `source` holds, for the native and Threat Dragon mappings.
 * An absent fact stays absent, and an explicit `false` or empty value is kept.
 */
export function processProperties(
  source: Pick<
    Process,
    | 'handlesCardPayment'
    | 'handlesGoodsOrServices'
    | 'isWebApplication'
    | 'privilegeLevel'
  >,
) {
  return presentProperties(source, [
    'handlesCardPayment',
    'handlesGoodsOrServices',
    'isWebApplication',
    'privilegeLevel',
  ]);
}

/**
 * The store facts `source` holds, for the native and Threat Dragon mappings.
 * An absent fact stays absent, and an explicit `false` or empty value is kept.
 */
export function storeProperties(
  source: Pick<
    Store,
    | 'isALog'
    | 'isEncrypted'
    | 'isSigned'
    | 'storesCredentials'
    | 'storesInventory'
  >,
) {
  return presentProperties(source, [
    'isALog',
    'isEncrypted',
    'isSigned',
    'storesCredentials',
    'storesInventory',
  ]);
}

/**
 * The flow facts `source` holds, for the native and Threat Dragon mappings.
 * An absent fact stays absent, and an explicit `false` or empty value is kept.
 */
export function flowProperties(
  source: Pick<
    FlowInput,
    'protocol' | 'isEncrypted' | 'isPublicNetwork' | 'trustBoundaryIds'
  >,
) {
  return presentProperties(source, [
    'protocol',
    'isEncrypted',
    'isPublicNetwork',
    'trustBoundaryIds',
  ]);
}

/**
 * The boundary assertions `source` holds, for the native and Threat Dragon
 * mappings. An absent assertion stays absent, and an empty list is kept.
 */
export function boundaryProperties(
  source: Pick<TrustBoundaryInput, 'containedElements' | 'crossingFlows'>,
) {
  return presentProperties(source, ['containedElements', 'crossingFlows']);
}

function presentProperties<T, Key extends keyof T>(
  source: T,
  keys: readonly Key[],
): Partial<Pick<T, Key>> {
  const selected: Partial<Pick<T, Key>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      selected[key] = source[key];
    }
  }
  return selected;
}
