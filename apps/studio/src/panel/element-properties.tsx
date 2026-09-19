import type { Element, ElementId, ElementProperties } from '@saerskriven/model';
import { Collapsible } from 'radix-ui';
import { useEffect, useState } from 'react';
import {
  announceRefusal,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { dispatch, useModelStore } from '../store/store.js';
import type { RefusedDraft } from '../ui/text-field.js';
import {
  BooleanProperty,
  TextProperty,
  RelationshipProperty,
} from './element-property-fields.js';
import styles from './element-properties.module.css';

type PropertyDraft = RefusedDraft & { readonly value: string | undefined };

/** Refused property drafts persist across selection changes and panel closing. */
export type ElementPropertyDrafts = Map<ElementId, Map<string, PropertyDraft>>;

/** Edits the selected element's security facts through the model store's history and validation. */
export function ElementPropertiesEditor({
  elementId,
  drafts,
}: {
  readonly elementId: ElementId;
  readonly drafts?: ElementPropertyDrafts;
}) {
  const { t } = useTranslator();
  const diagrams = useModelStore((state) => state.present.diagrams);
  const diagram = diagrams.find((candidate) =>
    candidate.elements.some((element) => element.id === elementId),
  );
  const element = diagram?.elements.find(
    (candidate) => candidate.id === elementId,
  );
  const [refusals, setRefusals] = useState(
    () => drafts?.get(elementId) ?? new Map<string, PropertyDraft>(),
  );
  const [open, setOpen] = useState(refusals.size > 0);
  const [hasOpened, setHasOpened] = useState(refusals.size > 0);
  const current = new Map(
    [...refusals].filter(
      ([field, draft]) => propertyValue(element, field) === draft.value,
    ),
  );
  if (current.size !== refusals.size) {
    setRefusals(current);
  }
  useEffect(() => {
    drafts?.set(elementId, refusals);
  }, [drafts, elementId, refusals]);
  if (
    element === undefined ||
    element.kind === 'text' ||
    diagram === undefined
  ) {
    return null;
  }
  const commit = (properties: ElementProperties) => {
    resetAnnouncements();
    dispatch(Action.SetElementProperties({ elementId, properties }));
  };
  const refused = (field: string) => (draft: RefusedDraft | undefined) => {
    if (draft === undefined && !refusals.has(field)) {
      return;
    }
    const next = new Map(refusals);
    if (draft === undefined) {
      next.delete(field);
    } else {
      next.set(field, { ...draft, value: propertyValue(element, field) });
      setOpen(true);
      announceRefusal(draft, refusals.get(field)?.text);
    }
    setRefusals(next);
  };
  return (
    <Collapsible.Root
      className={styles.properties}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setHasOpened(true);
        }
        setOpen(next || current.size > 0);
      }}
    >
      <Collapsible.Trigger className={styles.trigger}>
        {t('panel.security-properties')}{' '}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.content} forceMount hidden={!open}>
        <p className={styles.hint}>{t('panel.not-recorded-hint')}</p>
        {hasOpened && (
          <PropertyFields
            element={element}
            elements={diagram.elements}
            commit={commit}
            refused={refused}
            drafts={current}
          />
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function propertyValue(
  element: Element | undefined,
  field: string,
): string | undefined {
  if (field === 'protocol' && element?.kind === 'flow') {
    return element.protocol;
  }
  if (field === 'privilegeLevel' && element?.kind === 'process') {
    return element.privilegeLevel;
  }
  return undefined;
}

function PropertyFields({
  element,
  elements,
  commit,
  refused,
  drafts,
}: {
  readonly element: Exclude<Element, { kind: 'text' }>;
  readonly elements: readonly Element[];
  readonly commit: (properties: ElementProperties) => void;
  readonly refused: (
    field: string,
  ) => (draft: RefusedDraft | undefined) => void;
  readonly drafts: ReadonlyMap<string, PropertyDraft>;
}) {
  const { t } = useTranslator();

  if (element.kind === 'actor') {
    return (
      <>
        <BooleanProperty
          label={t('fields.provides-authentication')}
          value={element.providesAuthentication}
          onCommit={(value) => {
            commit({ kind: 'actor', providesAuthentication: value });
          }}
        />
      </>
    );
  }
  if (element.kind === 'process') {
    return (
      <>
        <BooleanProperty
          label={t('fields.handles-card-payments')}
          value={element.handlesCardPayment}
          onCommit={(value) => {
            commit({ kind: 'process', handlesCardPayment: value });
          }}
        />
        <BooleanProperty
          label={t('fields.handles-goods-or-services')}
          value={element.handlesGoodsOrServices}
          onCommit={(value) => {
            commit({ kind: 'process', handlesGoodsOrServices: value });
          }}
        />
        <BooleanProperty
          label={t('fields.web-application')}
          value={element.isWebApplication}
          onCommit={(value) => {
            commit({ kind: 'process', isWebApplication: value });
          }}
        />
        <TextProperty
          label={(speak) => speak('fields.privilege-level')}
          value={element.privilegeLevel}
          held={drafts.get('privilegeLevel')?.text}
          onRefused={refused('privilegeLevel')}
          onCommit={(value) => {
            commit({ kind: 'process', privilegeLevel: value });
          }}
        />
      </>
    );
  }
  if (element.kind === 'store') {
    return (
      <>
        <BooleanProperty
          label={t('fields.log-store')}
          value={element.isALog}
          onCommit={(value) => {
            commit({ kind: 'store', isALog: value });
          }}
        />
        <BooleanProperty
          label={t('fields.encrypted-storage')}
          value={element.isEncrypted}
          onCommit={(value) => {
            commit({ kind: 'store', isEncrypted: value });
          }}
        />
        <BooleanProperty
          label={t('fields.signed-storage')}
          value={element.isSigned}
          onCommit={(value) => {
            commit({ kind: 'store', isSigned: value });
          }}
        />
        <BooleanProperty
          label={t('fields.stores-credentials')}
          value={element.storesCredentials}
          onCommit={(value) => {
            commit({ kind: 'store', storesCredentials: value });
          }}
        />
        <BooleanProperty
          label={t('fields.stores-inventory')}
          value={element.storesInventory}
          onCommit={(value) => {
            commit({ kind: 'store', storesInventory: value });
          }}
        />
      </>
    );
  }
  if (element.kind === 'flow') {
    return (
      <>
        <BooleanProperty
          label={t('fields.encrypted-flow')}
          value={element.isEncrypted}
          onCommit={(value) => {
            commit({ kind: 'flow', isEncrypted: value });
          }}
        />
        <BooleanProperty
          label={t('fields.public-network')}
          value={element.isPublicNetwork}
          onCommit={(value) => {
            commit({ kind: 'flow', isPublicNetwork: value });
          }}
        />
        <TextProperty
          label={(speak) => speak('fields.protocol')}
          value={element.protocol}
          held={drafts.get('protocol')?.text}
          onRefused={refused('protocol')}
          onCommit={(value) => {
            commit({ kind: 'flow', protocol: value });
          }}
        />
        <RelationshipProperty
          label={t('fields.crossed-trust-boundaries')}
          lowerLabel={t('fields.crossed-trust-boundaries-lower')}
          value={element.trustBoundaryIds}
          choices={elements.filter(
            (candidate) => candidate.kind === 'trust-boundary',
          )}
          onCommit={(value) => {
            commit({ kind: 'flow', trustBoundaryIds: value });
          }}
        />
      </>
    );
  }
  return (
    <>
      <RelationshipProperty
        label={t('fields.contained-elements')}
        lowerLabel={t('fields.contained-elements-lower')}
        value={element.containedElements}
        choices={elements.filter((candidate) => candidate.id !== element.id)}
        onCommit={(value) => {
          commit({ kind: 'trust-boundary', containedElements: value });
        }}
      />
      <RelationshipProperty
        label={t('fields.crossing-flows')}
        lowerLabel={t('fields.crossing-flows-lower')}
        value={element.crossingFlows}
        choices={elements.filter((candidate) => candidate.kind === 'flow')}
        onCommit={(value) => {
          commit({ kind: 'trust-boundary', crossingFlows: value });
        }}
      />
    </>
  );
}
