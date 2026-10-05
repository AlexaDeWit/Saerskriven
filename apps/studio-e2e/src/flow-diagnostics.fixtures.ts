import type { Page, TestInfo } from '@playwright/test';
import { recoverySnapshot } from './studio.fixtures.js';

const captureFlowState = (
  page: Page,
  requestedFlowId: string,
  requestedEndpointIds: readonly string[],
) =>
  page.evaluate(
    ({ flowId, endpointIds }) => {
      const plain = {
        isKeyed(value: unknown): value is Record<string, unknown> {
          return (
            typeof value === 'object' && value !== null && !Array.isArray(value)
          );
        },
        unavailable(reason: string) {
          return { status: 'unavailable', reason };
        },
        scalar(value: unknown) {
          if (value === undefined || value === null) return null;
          return typeof value === 'string'
            ? value.slice(0, 256)
            : typeof value === 'boolean' ||
                (typeof value === 'number' && Number.isFinite(value))
              ? value
              : this.unavailable('field shape changed');
        },
        bounds(element: Element) {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        },
      };
      function record(value: unknown): Record<string, unknown> | null {
        return plain.isKeyed(value) ? value : null;
      }
      const fields = (value: unknown, names: readonly string[]) => {
        if (value === undefined || value === null) return null;
        const object = record(value);
        return object === null
          ? plain.unavailable('record shape changed')
          : Object.fromEntries(
              names.map((name) => [name, plain.scalar(object[name])]),
            );
      };
      const handles = (value: unknown) => {
        if (value === undefined || value === null) return null;
        if (
          !Array.isArray(value) ||
          value.length > 16 ||
          value.some((handle) => record(handle) === null)
        ) {
          return plain.unavailable('handle shape or count changed');
        }
        return value.map((handle) =>
          fields(handle, [
            'id',
            'type',
            'position',
            'x',
            'y',
            'width',
            'height',
          ]),
        );
      };
      const node = (value: unknown, id: string) => {
        if (value === undefined) return { id, status: 'missing' };
        const object = record(value);
        const internals = record(object?.['internals']);
        const userNode = record(internals?.['userNode']);
        if (
          object?.['id'] !== id ||
          internals === null ||
          userNode?.['id'] !== id
        ) {
          return { id, ...plain.unavailable('internal node shape changed') };
        }
        const handleBounds = record(internals['handleBounds']);
        return {
          ...fields(object, ['id', 'width', 'height', 'hidden']),
          position: fields(object['position'], ['x', 'y']),
          measured: fields(object['measured'], ['width', 'height']),
          userMeasured: fields(userNode['measured'], ['width', 'height']),
          positionAbsolute: fields(internals['positionAbsolute'], ['x', 'y']),
          handles: handles(object['handles']),
          handleBounds:
            internals['handleBounds'] !== undefined &&
            internals['handleBounds'] !== null &&
            handleBounds === null
              ? plain.unavailable('handle bounds shape changed')
              : handleBounds === null
                ? null
                : {
                    source: handles(handleBounds['source']),
                    target: handles(handleBounds['target']),
                  },
        };
      };
      const wrapper = document.querySelector('.react-flow');
      const ids = new Set([...new Set(endpointIds)].slice(0, 4));
      const candidates = new Map<object, Record<string, unknown>>();
      let reason = 'no matching provider store';
      if (wrapper !== null) {
        const keys = Object.keys(wrapper).filter((name) =>
          name.startsWith('__reactFiber$'),
        );
        if (keys.length === 1) {
          let fibre: unknown = Reflect.get(wrapper, keys[0]);
          let depth = 0;
          for (; fibre !== null && fibre !== undefined && depth < 64; depth++) {
            const current = record(fibre);
            if (current === null) {
              reason = 'fibre shape changed';
              break;
            }
            const value = record(current['memoizedProps'])?.['value'];
            const holder =
              value !== null &&
              (typeof value === 'object' || typeof value === 'function')
                ? value
                : null;
            const getState: unknown =
              holder === null ? null : Reflect.get(holder, 'getState');
            const subscribe: unknown =
              holder === null ? null : Reflect.get(holder, 'subscribe');
            if (
              holder !== null &&
              typeof getState === 'function' &&
              typeof subscribe === 'function'
            ) {
              let observed: unknown;
              try {
                observed = Reflect.apply(getState, holder, []);
              } catch {
                reason = 'provider read unavailable';
              }
              const state = record(observed);
              if (
                state !== null &&
                state['nodeLookup'] instanceof Map &&
                state['edgeLookup'] instanceof Map &&
                state['domNode'] instanceof Element &&
                state['domNode'].contains(wrapper) &&
                Array.isArray(state['transform']) &&
                state['transform'].length === 3 &&
                state['transform'].every(
                  (part) => typeof part === 'number' && Number.isFinite(part),
                ) &&
                (state['connectionMode'] === 'loose' ||
                  state['connectionMode'] === 'strict')
              ) {
                candidates.set(holder, state);
              }
            }
            fibre = current['return'];
          }
          if (depth === 64 && fibre !== null && fibre !== undefined) {
            candidates.clear();
            reason = 'fibre ancestry exceeds 64';
          }
        } else {
          reason = 'development fibre unavailable or ambiguous';
        }
      }
      const state = candidates.size === 1 ? [...candidates.values()][0] : null;
      let provider: unknown = plain.unavailable(
        candidates.size > 1 ? 'ambiguous provider stores' : reason,
      );
      if (state !== null) {
        const edgeLookup = state['edgeLookup'];
        const nodeLookup = state['nodeLookup'];
        if (edgeLookup instanceof Map && nodeLookup instanceof Map) {
          const edge = record(edgeLookup.get(flowId));
          const validEdge =
            edge !== null &&
            edge['id'] === flowId &&
            typeof edge['source'] === 'string' &&
            typeof edge['target'] === 'string';
          if (validEdge) {
            ids.add(String(edge['source']));
            ids.add(String(edge['target']));
          }
          provider = {
            status: 'available',
            transform: Array.isArray(state['transform'])
              ? state['transform'].map((part) => plain.scalar(part))
              : null,
            connectionMode: state['connectionMode'],
            edge: !edgeLookup.has(flowId)
              ? { id: flowId, status: 'missing' }
              : validEdge
                ? fields(edge, [
                    'id',
                    'source',
                    'target',
                    'sourceHandle',
                    'targetHandle',
                    'hidden',
                  ])
                : plain.unavailable('edge shape changed'),
            nodes: [...ids]
              .slice(0, 6)
              .map((id) => node(nodeLookup.get(id), id)),
          };
        }
      }
      const domNodes = [...ids].slice(0, 6).map((id) => {
        const element = wrapper?.querySelector(
          `[data-testid="rf__node-${CSS.escape(id)}"]`,
        );
        if (!(element instanceof HTMLElement)) return { id, status: 'missing' };
        const style = getComputedStyle(element);
        const nodeHandles = [
          ...element.querySelectorAll('.react-flow__handle'),
        ];
        return {
          id,
          connected: element.isConnected,
          bounds: plain.bounds(element),
          offsetWidth: element.offsetWidth,
          offsetHeight: element.offsetHeight,
          transform: style.transform,
          display: style.display,
          visibility: style.visibility,
          handleCount: nodeHandles.length,
          handles: nodeHandles.slice(0, 16).map((handle) => ({
            id: handle.getAttribute('data-handleid'),
            bounds: plain.bounds(handle),
            offsetWidth:
              handle instanceof HTMLElement ? handle.offsetWidth : null,
            offsetHeight:
              handle instanceof HTMLElement ? handle.offsetHeight : null,
          })),
        };
      });
      const edgeElement = wrapper?.querySelector(
        `[data-testid="rf__edge-${CSS.escape(flowId)}"]`,
      );
      return {
        flowId,
        provider,
        dom: {
          viewport:
            wrapper
              ?.querySelector('.react-flow__viewport')
              ?.getAttribute('style')
              ?.slice(0, 1024) ?? null,
          edgeLayerCount:
            wrapper?.querySelector('.react-flow__edges')?.childElementCount ??
            null,
          edge:
            edgeElement === null || edgeElement === undefined
              ? null
              : { id: flowId, bounds: plain.bounds(edgeElement) },
          nodes: domNodes,
        },
      };
    },
    { flowId: requestedFlowId, endpointIds: requestedEndpointIds },
  );

/** Evidence failures cannot replace the assertion failure. */
export const withFailureEvidence = async (
  attachments: Pick<TestInfo, 'attach'>,
  assertion: () => Promise<void>,
  capture: () => Promise<unknown>,
  recover: () => Promise<string | null>,
): Promise<void> => {
  try {
    await assertion();
  } catch (originalFailure) {
    try {
      let snapshot: unknown;
      try {
        snapshot = await capture();
      } catch {
        snapshot = {
          status: 'unavailable',
          reason: 'browser state capture failed',
        };
      }
      let recovery: unknown;
      try {
        const stored = await recover();
        const envelope: unknown = stored === null ? null : JSON.parse(stored);
        const version =
          typeof envelope === 'object' &&
          envelope !== null &&
          'version' in envelope &&
          typeof envelope.version === 'number' &&
          Number.isFinite(envelope.version)
            ? envelope.version
            : null;
        recovery = {
          format: 'native-wire-envelope',
          status: stored === null ? 'missing' : 'available',
          byteLength: Buffer.byteLength(stored ?? '', 'utf8'),
          version,
        };
      } catch {
        recovery = {
          format: 'native-wire-envelope',
          status: 'unavailable',
          reason: 'storage read refused or envelope invalid',
        };
      }
      await attachments.attach('flow-failure-state', {
        body: JSON.stringify({ snapshot, recovery }),
        contentType: 'application/json',
      });
    } catch {
      throw originalFailure;
    }
    throw originalFailure;
  }
};

/** Reads the provider synchronously before recovery, only on an assertion failure. */
export const withFlowFailureEvidence = (
  page: Page,
  attachments: Pick<TestInfo, 'attach'>,
  flowId: string,
  endpointIds: readonly string[],
  assertion: () => Promise<void>,
): Promise<void> =>
  withFailureEvidence(
    attachments,
    assertion,
    () => captureFlowState(page, flowId, endpointIds),
    () => recoverySnapshot(page),
  );
