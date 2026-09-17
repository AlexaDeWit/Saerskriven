import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Runs axe-core over the page, or over the elements `within` selects, and
 * fails with each violation's rule, impact and targets, `state` saying what
 * the studio was showing. An audit stays page-wide wherever nothing is hidden
 * from assistive technology, which holds for the non-modal menu and for a
 * notice. An open Radix listbox hides the rest of the page, which axe's
 * page-level rules read as a page that lost its main and its heading, so a
 * listbox is audited on its own.
 */
export const audit = async (
  page: Page,
  state: string,
  within?: string,
): Promise<void> => {
  const builder = new AxeBuilder({ page });
  const { violations, incomplete } = await (
    within === undefined ? builder : builder.include(within)
  ).analyze();
  const report = violations
    .map(
      (violation) =>
        `${violation.id} [${violation.impact ?? 'unrated'}] ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    )
    .join('\n');
  const undecided = incomplete.map((result) => result.id).join(', ');

  expect(
    violations.map((violation) => violation.id),
    `axe-core reported, with the studio ${state}:\n${report}\nnot gated, axe could not settle: ${undecided || 'nothing'}`,
  ).toEqual([]);
};
