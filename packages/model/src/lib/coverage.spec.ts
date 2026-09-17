import {
  elementId,
  elementIn,
  emptyRegisterModel,
  parsedFixture,
  registerModel,
  threatIn,
} from '../fixtures.js';
import {
  elementsWithoutThreats,
  openThreatsBySeverity,
  threatCountByElement,
} from './coverage.js';
import type { Element } from './elements.js';
import { threatRegisterFixture } from './model.fixtures.js';
import type { Threat } from './threats.js';

const idsOfElements = (elements: Element[]): string[] =>
  elements.map((element) => element.id);

const idsOfThreats = (threats: Threat[]): string[] =>
  threats.map((threat) => threat.id);

describe('elementsWithoutThreats', () => {
  it('returns the elements no threat references, across every diagram', () => {
    expect(elementsWithoutThreats(registerModel)).toEqual([
      elementIn(registerModel, 'element-ledger'),
    ]);
  });

  it('returns every element when the register is empty', () => {
    expect(idsOfElements(elementsWithoutThreats(emptyRegisterModel))).toEqual([
      'element-shopper',
      'element-checkout',
      'element-pay-flow',
      'element-ledger',
      'element-vault',
    ]);
  });
});

describe('openThreatsBySeverity', () => {
  it('groups the open threats under a key for every severity', () => {
    const grouped = openThreatsBySeverity(registerModel);
    expect(idsOfThreats(grouped.low)).toEqual(['threat-flood-checkout']);
    expect(idsOfThreats(grouped.medium)).toEqual([]);
    expect(grouped.high).toEqual([
      threatIn(registerModel, 'threat-spoof-shopper'),
    ]);
    expect(idsOfThreats(grouped.critical)).toEqual(['threat-tamper-payment']);
    expect(idsOfThreats(grouped.undecided)).toEqual([]);
  });
});

describe('threatCountByElement', () => {
  it('counts the threats on every element of the model', () => {
    expect([...threatCountByElement(registerModel)]).toEqual([
      ['element-shopper', 1],
      ['element-checkout', 2],
      ['element-pay-flow', 1],
      ['element-ledger', 0],
      ['element-vault', 1],
    ]);
  });

  it('counts a threat once where it links the same element twice', () => {
    const doubled = structuredClone(threatRegisterFixture);
    doubled.threats[0].elements.push('element-shopper');
    expect(
      threatCountByElement(parsedFixture(doubled)).get(
        elementId('element-shopper'),
      ),
    ).toBe(1);
  });
});
