import type {
  Actor,
  FlowInput,
  Process,
  Store,
  TrustBoundaryInput,
} from '@saerskriven/model';

/**
 * Actor facts shared by the native and Threat Dragon mappings. Every function
 * here copies only the facts present, so an absent fact stays unknown
 * while an explicit `false` or empty value is kept.
 */
export function actorProperties(source: Pick<Actor, 'providesAuthentication'>) {
  return presentProperties(source, ['providesAuthentication']);
}

/** Process facts shared by the native and Threat Dragon mappings. */
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

/** Store facts shared by the native and Threat Dragon mappings. */
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

/** Flow facts shared by the native and Threat Dragon mappings. */
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

/** Boundary assertions shared by the native and Threat Dragon mappings. */
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
