import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canvasClassNames,
  darkPalette,
  lightPalette,
  rgbColour,
} from '@saerskriven/canvas';
import type { Model } from '@saerskriven/model';
import {
  committedModel,
  elementId,
  mitigationId,
  softHyphen,
  threatId,
  threatIn,
} from '@saerskriven/model/fixtures';
import {
  canvasSettled,
  edgesOf,
  onScreen,
  screenBoxOf,
  viewportTransform,
} from './canvas.fixtures.js';
import {
  beforeCanvas,
  chooseByKeyboard,
  chooseInPanel,
  editAnnouncement,
  expandThreat,
  nameField,
  nodeNamed,
  openModelDocument,
  openPlaceholder,
  openTwoDiagrams,
  panelField,
  placeholder,
  runFromMenu,
  scrollPaneTo,
  selectByKeyboard,
  selectNode,
  storefront,
  threatPanel,
  threatSummary,
} from './studio.fixtures.js';
import { registeredChords } from './chords.fixtures.js';

const replayed = /Session token replayed/u;

const shopperWithLongThreats = (): Model => {
  const model = committedModel('two-diagrams.model.json');
  const takeover = threatIn(model, 'th-account-takeover');
  const added = Array.from({ length: 8 }, (unused, index) => ({
    ...takeover,
    id: threatId(`th-shopper-${String(index)}`),
    number: model.lastIssuedThreatNumber + index + 1,
    title:
      index === 0
        ? 'Session token replayed'
        : `Shopper threat ${String(index)}`,
    elements: [elementId('el-shopper')],
  }));
  const steps = Array.from(
    { length: 12 },
    (unused, index) =>
      `Step ${String(index + 1)}: refuse a sign-in the throttle has not cleared.`,
  ).join('\n');
  return {
    ...model,
    lastIssuedThreatNumber: model.lastIssuedThreatNumber + added.length,
    threats: [...model.threats, ...added],
    mitigations: [
      ...model.mitigations,
      ...['Captcha after failures', 'Breached password check'].map(
        (title, index) => ({
          id: mitigationId(`mi-long-${String(index)}`),
          title,
          status: 'proposed' as const,
          threats: [takeover.id, added[0].id],
          prose: steps,
        }),
      ),
    ],
  };
};

const paneBody = (page: Page): Locator =>
  threatPanel(page).locator(':scope > div:last-child');

const insidePaneBody = async (
  page: Page,
  target: Locator,
): Promise<boolean> => {
  const body = await edgesOf(paneBody(page));
  const drawn = await edgesOf(target);
  return drawn.top >= body.top - 0.5 && drawn.bottom <= body.bottom + 0.5;
};

const atPaneTop = async (page: Page, target: Locator): Promise<boolean> =>
  Math.abs((await edgesOf(target)).top - (await edgesOf(paneBody(page))).top) <=
  1.5;

const belowLongTakeover = async (page: Page): Promise<Locator> => {
  await openModelDocument(page, shopperWithLongThreats());
  await selectNode(page, storefront.shopper);
  await expandThreat(page, storefront.takeover);
  const below = threatSummary(page, replayed);
  await expect(below).toHaveAttribute('aria-expanded', 'false');
  return below;
};

test(
  'a threat opened below a long open one lands with its header at the top of the pane',
  { tag: '@phone' },
  async ({ page }) => {
    const below = await belowLongTakeover(page);
    expect(await scrollPaneTo(below, 'bottom')).toBe(true);

    await below.click();

    await expect(below).toHaveAttribute('aria-expanded', 'true');
    await expect(threatSummary(page, storefront.takeover)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect.poll(() => atPaneTop(page, below)).toBe(true);
  },
);

test(
  'a threat opened from the keyboard lands at the top of the pane and keeps focus, without scroll anchoring',
  { tag: '@phone' },
  async ({ page }) => {
    const below = await belowLongTakeover(page);
    await paneBody(page).evaluate((body) => {
      body.style.overflowAnchor = 'none';
    });
    await below.focus();
    expect(await scrollPaneTo(below, 'bottom')).toBe(true);

    await page.keyboard.press('Enter');

    await expect(below).toHaveAttribute('aria-expanded', 'true');
    await expect(below).toBeFocused();
    await expect.poll(() => atPaneTop(page, below)).toBe(true);
  },
);

const pressedPartlyClipped = async (
  page: Page,
  header: Locator,
  edge: 'top' | 'bottom',
): Promise<void> => {
  const clipped = 12;
  await header.evaluate((element) => {
    element.focus({ preventScroll: true });
  });
  expect(await scrollPaneTo(header, edge)).toBe(true);
  await paneBody(page).evaluate(
    (body, by) => {
      body.scrollTop += by;
    },
    edge === 'top' ? clipped : -clipped,
  );
  expect(await insidePaneBody(page, header)).toBe(false);
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-expanded', 'true');
};

test(
  'a header pressed while partly above the pane lands at its top as the long threat above collapses',
  { tag: '@phone' },
  async ({ page }) => {
    const below = await belowLongTakeover(page);

    await pressedPartlyClipped(page, below, 'top');

    await expect(below).toBeFocused();
    await expect.poll(() => atPaneTop(page, below)).toBe(true);
  },
);

test(
  'a header pressed while partly below the pane comes up to its top',
  { tag: '@phone' },
  async ({ page }) => {
    await openModelDocument(page, shopperWithLongThreats());
    await selectNode(page, storefront.shopper);
    const lower = threatSummary(page, /Shopper threat 5/u);

    await pressedPartlyClipped(page, lower, 'bottom');

    await expect(lower).toBeFocused();
    await expect.poll(() => atPaneTop(page, lower)).toBe(true);
  },
);

test(
  "an open threat's summary stays pinned at the top of the pane while any of the threat is in it",
  { tag: '@phone' },
  async ({ page }) => {
    const below = await belowLongTakeover(page);
    await below.click();
    await expect.poll(() => atPaneTop(page, below)).toBe(true);
    const item = page.locator('[data-threat-item="th-shopper-0"]');

    await paneBody(page).evaluate((body) => {
      body.scrollTop += Math.round(body.clientHeight / 2);
    });
    expect(await atPaneTop(page, below)).toBe(true);
    expect((await edgesOf(item)).top).toBeLessThan(
      (await edgesOf(paneBody(page))).top - 1,
    );

    await paneBody(page).evaluate((body) => {
      body.scrollTop = body.scrollHeight;
    });
    const end = await edgesOf(item);
    const summary = await edgesOf(below);
    expect(summary.bottom).toBeLessThanOrEqual(end.bottom + 0.5);
    if (end.bottom < (await edgesOf(paneBody(page))).top) {
      expect(await insidePaneBody(page, below)).toBe(false);
    }
  },
);

const focusPlacement = (summary: Locator) =>
  summary.evaluate((header) => {
    let body = header.parentElement;
    while (body !== null && getComputedStyle(body).overflowY !== 'auto') {
      body = body.parentElement;
    }
    const field = document.activeElement;
    if (body === null || !(field instanceof HTMLElement)) {
      return undefined;
    }
    const view = body.getBoundingClientRect();
    const drawn = field.getBoundingClientRect();
    const pinned = header.getBoundingClientRect();
    const tabbable = [
      ...body.querySelectorAll<HTMLElement>(
        'input, textarea, button, [role="combobox"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    const next = tabbable.at(tabbable.indexOf(field) + 1);
    const nextBottom = next?.getBoundingClientRect().bottom ?? drawn.bottom;
    const atEnd = body.scrollTop >= body.scrollHeight - body.clientHeight - 1;
    return {
      clearOfSummary: drawn.top >= pinned.bottom - 0.5,
      inView:
        drawn.bottom <= view.bottom + 0.5 ||
        (drawn.height > view.bottom - pinned.bottom &&
          Math.abs(drawn.top - pinned.bottom) <= 1),
      nextInView:
        nextBottom <= view.bottom + 0.5 ||
        atEnd ||
        nextBottom - drawn.top > view.bottom - pinned.bottom,
      scrolled: body.scrollTop,
    };
  });

test(
  'Tab brings each field of an open threat into view below its pinned summary, with the next field in view under it',
  { tag: '@phone' },
  async ({ page }) => {
    const below = await belowLongTakeover(page);
    await below.click();
    await expect.poll(() => atPaneTop(page, below)).toBe(true);
    await threatPanel(page)
      .getByRole('textbox', { name: 'Title', exact: true })
      .focus();
    const scrolledAt = new Set<number>();

    for (let step = 0; step < 14; step += 1) {
      await page.keyboard.press('Tab');
      const placed = await focusPlacement(below);
      expect(placed, `Tab ${String(step + 1)}`).toMatchObject({
        clearOfSummary: true,
        inView: true,
        nextInView: true,
      });
      scrolledAt.add(placed?.scrolled ?? 0);
    }

    expect(scrolledAt.size).toBeGreaterThan(1);
  },
);

const badgeTone = (node: Locator): Locator =>
  node.locator(`.${canvasClassNames.badgePrimary} circle`);

const titleField = (page: Page): Locator =>
  panelField(page, 'textbox', 'Title');

const panAcross = async (page: Page, by: number): Promise<void> => {
  const pane = await screenBoxOf(page.locator('.react-flow__pane'), 'the pane');
  const from = { x: pane.x + 24, y: pane.y + pane.height / 2 };
  await page.keyboard.down('Space');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by, from.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await canvasSettled(page);
};

test('the panel opens on the element selected and goes when the selection does', async ({
  page,
}) => {
  await openPlaceholder(page);
  await expect(threatPanel(page)).toHaveCount(0);

  const actor = await selectNode(page, placeholder.actor);

  await expect(
    threatPanel(page).getByRole('heading', { name: 'Actor', exact: true }),
  ).toBeVisible();
  await expect(
    threatPanel(page).locator(':focus'),
    'selecting an element does not move focus into the panel',
  ).toHaveCount(0);

  await page.keyboard.press('Escape');

  await expect(actor).not.toHaveClass(/selected/u);
  await expect(threatPanel(page)).toHaveCount(0);
});

test('T hands the panel the keyboard, and the two Escapes give it back and clear the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });
  await expect(actor).toBeFocused();

  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await expect(add).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(threatPanel(page)).toHaveCount(0);
  await expect(actor).toBeFocused();
  await expect(actor).toHaveClass(/selected/u);

  await page.keyboard.press('Escape');

  await expect(actor).not.toHaveClass(/selected/u);
});

test('undoing a threat just added from the keyboard hands focus to Add a threat, and redo hands it back to its Title', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, placeholder.actor);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(titleField(page)).toBeFocused();

  await page.keyboard.press(registeredChords.undo[0]);

  await expect(titleField(page)).toHaveCount(0);
  await expect(add).toBeFocused();

  await page.keyboard.press(registeredChords.redo[0]);

  await expect(titleField(page)).toBeFocused();
  await expect
    .poll(() => atPaneTop(page, threatSummary(page, /New threat/u)))
    .toBe(true);
});

test('an element the panel would cover stays where it was drawn', async ({
  page,
}) => {
  await openPlaceholder(page);
  const store = nodeNamed(page, placeholder.store);
  const covered = await edgesOf(store);
  const before = await viewportTransform(page);

  await selectByKeyboard(page, placeholder.store);

  const panel = await edgesOf(threatPanel(page));
  expect(
    covered.right,
    'the element was drawn where the panel opens',
  ).toBeGreaterThan(panel.left);
  expect(await viewportTransform(page)).toBe(before);
  expect(await edgesOf(store)).toEqual(covered);
});

test('a node just inside the panel edge stays where it is when selected', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  await selectNode(page, placeholder.actor);
  const panel = await edgesOf(threatPanel(page));
  await page.keyboard.press('Escape');
  await expect(threatPanel(page)).toHaveCount(0);

  const justInside = 10;
  await panAcross(page, panel.left + justInside - (await edgesOf(actor)).right);
  const covered = await edgesOf(actor);
  expect(
    covered.right,
    'the node ends under the panel, in the strip its padding and border draw',
  ).toBeGreaterThan(panel.left);

  const before = await viewportTransform(page);
  await selectNode(page, placeholder.actor);

  expect(await viewportTransform(page)).toBe(before);
  expect((await edgesOf(actor)).right).toBeGreaterThan(panel.left);
});

test('a draft the model refused comes back when its element is selected again, or when T reopens the panel', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, placeholder.actor);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  await titleField(page).fill(`Soft${softHyphen}hyphen`);
  await titleField(page).press('Enter');
  await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');

  await test.step('selected again', async () => {
    await selectByKeyboard(page, placeholder.store);
    await expect(titleField(page)).toHaveCount(0);
    await selectByKeyboard(page, placeholder.actor);

    await expect(titleField(page)).toHaveValue(`Soft${softHyphen}hyphen`);
    await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');
  });

  await test.step('Escape from the field closes the panel over the draft, and T reopens it', async () => {
    await titleField(page).press(registeredChords['select-tool'][1]);

    await expect(threatPanel(page)).toHaveCount(0);
    await expect(actor).toHaveClass(/selected/u);
    await expect(actor).toBeFocused();

    await page.keyboard.press(registeredChords['focus-threats'][0]);

    await expect(titleField(page)).toHaveValue(`Soft${softHyphen}hyphen`);
    await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');
  });
});

test('a threat added in the panel reaches the canvas as a badge, and its severity colours it', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const webShop = await selectNode(page, storefront.webShop);
  await expect(
    page.getByRole('heading', { name: 'Web shop', exact: true }),
  ).toBeVisible();

  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();

  await expect(titleField(page)).toBeFocused();
  await expect(editAnnouncement(page)).toBeEmpty();
  await expect(
    nodeNamed(page, 'Web shop, process, 1 open threat, severity not assessed'),
  ).toBeVisible();
  await expect(webShop.locator(`.${canvasClassNames.badgeMark}`)).toHaveText(
    '?',
  );
  await expect(badgeTone(webShop)).toHaveClass(canvasClassNames.toneNeutral);

  await chooseInPanel(page, 'Severity', 'Critical');

  await expect(
    nodeNamed(
      page,
      'Web shop, process, 1 open threat, highest severity critical',
    ),
  ).toBeVisible();
  await expect(webShop.locator(`.${canvasClassNames.badgeMark}`)).toHaveText(
    'C',
  );
  await expect(badgeTone(webShop)).toHaveClass(canvasClassNames.toneCritical);
});

test('a status chosen in the panel takes the threat out of the count the canvas draws', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const shopper = await selectNode(page, storefront.shopper);
  await expect(shopper).toHaveAccessibleName(
    /1 open threat, highest severity high/u,
  );

  await threatSummary(page, storefront.takeover).click();
  await chooseInPanel(page, 'Status', 'Mitigated');

  await expect(shopper).not.toHaveAccessibleName(/open threat/u);
});

test('a threat deleted in the panel leaves the canvas, and undo puts it back', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const shopper = await selectNode(page, storefront.shopper);
  await expect(shopper).toHaveAccessibleName(/1 open threat/u);

  await threatSummary(page, storefront.takeover).click();
  await threatPanel(page)
    .getByRole('button', { name: 'Delete threat 1', exact: true })
    .click();

  await expect(editAnnouncement(page)).toContainText('1');
  await expect(threatSummary(page, storefront.takeover)).toHaveCount(0);
  await expect(shopper).not.toHaveAccessibleName(/open threat/u);

  await runFromMenu(page, 'Undo');

  await expect(threatSummary(page, storefront.takeover)).toHaveCount(1);
  await expect(shopper).toHaveAccessibleName(/1 open threat/u);
});

test('every field of a threat is reachable and editable from the keyboard, add and delete included', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await canvasSettled(page);
  const printer = await selectNode(page, /^Label printer, process/u);
  const add = threatPanel(page).getByRole('button', { name: 'Add a threat' });

  await add.focus();
  await page.keyboard.press('Enter');

  const title = titleField(page);
  await expect(title).toBeFocused();
  await title.press('ControlOrMeta+a');
  await page.keyboard.type('Queue poisoning');
  await page.keyboard.press('Tab');

  await expect(panelField(page, 'combobox', 'Category')).toBeFocused();
  await chooseByKeyboard(page, 'ArrowDown');
  await expect(panelField(page, 'combobox', 'Category')).toContainText(
    'Tampering',
  );

  await page.keyboard.press('Tab');
  const description = panelField(page, 'textbox', 'Description');
  await expect(description).toBeFocused();
  await page.keyboard.type('The queue accepts a job nobody enqueued.');

  const mitigations = threatPanel(page).getByRole('group', {
    name: 'Mitigations',
  });
  await page.keyboard.press('Tab');
  await expect(
    mitigations.getByRole('button', { name: 'Add mitigation', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  const recordTitle = mitigations.getByRole('textbox', {
    name: 'Mitigation 1 title',
    exact: true,
  });
  await expect(recordTitle).toBeFocused();
  await page.keyboard.type('Sign every job.');
  await page.keyboard.press('Tab');
  await expect(
    mitigations.getByRole('textbox', {
      name: 'Mitigation 1 description',
      exact: true,
    }),
  ).toBeFocused();
  await expect(description).toHaveValue(
    'The queue accepts a job nobody enqueued.',
  );

  for (const [group, role, control] of [
    ['Mitigations', 'button', 'Add mitigation'],
    ['Mitigations', 'combobox', 'Existing mitigation'],
    ['Mitigations', 'button', 'Link existing mitigation'],
    ['Assumptions', 'button', 'Add assumption'],
    ['Assumptions', 'combobox', 'Existing assumption'],
    ['Assumptions', 'button', 'Link existing assumption'],
  ] as const) {
    await page.keyboard.press('Tab');
    await expect(
      threatPanel(page)
        .getByRole('group', { name: group })
        .getByRole(role, { name: control, exact: true }),
    ).toBeFocused();
  }

  await page.keyboard.press('Tab');
  await expect(panelField(page, 'combobox', 'Severity')).toBeFocused();
  await chooseByKeyboard(page, 'ArrowUp');
  await expect(panelField(page, 'combobox', 'Severity')).toContainText(
    'Critical',
  );

  await page.keyboard.press('Tab');
  await expect(panelField(page, 'combobox', 'Status')).toBeFocused();

  for (const [group, role, control] of [
    ['Attached elements', 'button', 'Detach Label printer'],
    ['Attached elements', 'combobox', 'Existing element'],
    ['Attached elements', 'button', 'Attach existing element'],
  ] as const) {
    await page.keyboard.press('Tab');
    await expect(
      threatPanel(page)
        .getByRole('group', { name: group })
        .getByRole(role, { name: control, exact: true }),
    ).toBeFocused();
  }

  await page.keyboard.press('Tab');
  const remove = threatPanel(page).getByRole('button', {
    name: 'Delete threat 12',
  });
  await expect(remove).toBeFocused();

  await expect(threatSummary(page, /Queue poisoning/u)).toBeVisible();
  await expect(printer).toHaveAccessibleName(
    /1 open threat, highest severity critical/u,
  );

  await runFromMenu(page, 'Undo');
  await expect(panelField(page, 'combobox', 'Severity')).toContainText(
    'Undecided',
  );
  await runFromMenu(page, 'Undo');
  await expect(recordTitle).toHaveCount(0);
  await expect(description).toHaveValue(
    'The queue accepts a job nobody enqueued.',
  );
  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue('');

  await remove.focus();
  await page.keyboard.press('Enter');

  await expect(add).toBeFocused();
  await expect(printer).toHaveAccessibleName('Label printer, process');
});

test('a flow selected on the canvas opens its own threats in the panel', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(
    threatPanel(page).getByRole('heading', {
      name: /^browse the catalogue/u,
    }),
  ).toBeVisible();
  await expect(threatSummary(page, storefront.basketPrice)).toHaveCount(0);
  await expect(threatSummary(page, storefront.takeover)).toBeVisible();
});

test('collapsed summaries expose severity and status without an empty content strip', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, placeholder.actor);
  const panel = threatPanel(page);
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  const summary = threatSummary(page, /New threat/u);
  await expect(summary).toHaveAccessibleName(
    /Severity: Undecided.*Status: Open/u,
  );
  await chooseInPanel(page, 'Severity', 'High');
  const contentId = await summary.getAttribute('aria-controls');
  await summary.click();
  const content = page.locator(`[id="${contentId ?? ''}"]`);
  await expect(content).toBeHidden();
  expect(
    await content.evaluate((node) => node.getBoundingClientRect().height),
  ).toBe(0);
  expect(await content.locator('input, textarea, button').count()).toBe(0);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toHaveAccessibleName(/Severity: High.*Status: Open/u);
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await expect(summary.locator('circle')).toHaveCSS(
      'fill',
      rgbColour((mode === 'dark' ? darkPalette : lightPalette).toneHigh),
    );
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await summary.focus();
  await page.keyboard.press('Enter');
  await chooseInPanel(page, 'Status', 'Mitigated');
  await summary.click();
  await expect(summary).toHaveAccessibleName(
    /Severity: High.*Status: Mitigated/u,
  );
  await expect(nodeNamed(page, placeholder.actor)).toHaveAccessibleName(
    /1 open threat, highest severity medium/u,
  );
  await page.keyboard.press('Tab');
  expect(
    await panel
      .locator('input:focus, textarea:focus, [role="combobox"]:focus')
      .count(),
  ).toBe(0);
});

test('keyboard width changes preserve the viewport and persist across selection and close', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  const panel = threatPanel(page);
  const normal = await edgesOf(panel);
  expect(normal.width).toBeGreaterThan(346);
  await panAcross(page, normal.left - 10 - (await edgesOf(actor)).right);
  const before = await edgesOf(actor);
  const viewportBefore = await viewportTransform(page);
  await panel.getByRole('button', { name: 'Widen pane' }).focus();
  await page.keyboard.press('Enter');
  await canvasSettled(page);
  const wide = await edgesOf(panel);
  expect(wide.width).toBeGreaterThan(normal.width);
  expect(before.right).toBeGreaterThan(wide.left);
  expect(await viewportTransform(page)).toBe(viewportBefore);
  expect(await edgesOf(actor)).toEqual(before);
  const storeBeforeSelection = await edgesOf(
    nodeNamed(page, placeholder.store),
  );
  const viewportBeforeSelection = await viewportTransform(page);
  await selectByKeyboard(page, placeholder.store);
  expect((await edgesOf(panel)).width).toBe(wide.width);
  expect(await viewportTransform(page)).toBe(viewportBeforeSelection);
  expect(await edgesOf(nodeNamed(page, placeholder.store))).toEqual(
    storeBeforeSelection,
  );
  await panel.getByRole('button', { name: 'Close threats' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, placeholder.store)).toBeFocused();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  expect((await edgesOf(panel)).width).toBe(wide.width);
  const beforeRestore = await viewportTransform(page);
  await panel.getByRole('button', { name: 'Restore pane width' }).focus();
  await page.keyboard.press('Space');
  await canvasSettled(page);
  expect((await edgesOf(panel)).width).toBe(normal.width);
  expect(await viewportTransform(page)).toBe(beforeRestore);
});

const scrollsInside = (field: Locator): Promise<boolean> =>
  field.evaluate((node) => node.scrollHeight > node.clientHeight + 1);

test('prose starts at two lines and grows with its text without scrolling inside, keeps manual resizing, and commits once through pane controls', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, placeholder.actor);
  const panel = threatPanel(page);
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  const description = panel.getByRole('textbox', {
    name: 'Description',
    exact: true,
  });
  const recordProse = panel.getByRole('textbox', {
    name: 'Mitigation 1 description',
    exact: true,
  });
  const initial = await edgesOf(description);
  const lineHeight = await description.evaluate((node) =>
    Number.parseFloat(getComputedStyle(node).lineHeight),
  );
  expect(initial.height).toBeGreaterThanOrEqual(lineHeight * 2);
  expect(initial.height).toBeLessThan(lineHeight * 4);
  const prose = Array.from(
    { length: 80 },
    (_, index) => `Line ${String(index)} of a long threat description.`,
  ).join('\n');
  await description.fill(prose);
  const grown = await edgesOf(description);
  expect(grown.height).toBeGreaterThan(lineHeight * 80);
  expect(await scrollsInside(description)).toBe(false);
  expect(await scrollsInside(paneBody(page))).toBe(true);
  await panel.getByRole('button', { name: 'Widen pane' }).click();
  await expect(description).toHaveValue(prose);
  await panel
    .getByRole('button', { name: 'Add mitigation', exact: true })
    .click();
  const recordInitial = await edgesOf(recordProse);
  expect(recordInitial.height).toBeGreaterThanOrEqual(lineHeight * 2);
  expect(recordInitial.height).toBeLessThan(lineHeight * 4);
  await recordProse.fill(prose.split('\n').slice(0, 30).join('\n'));
  const recordGrown = await edgesOf(recordProse);
  expect(recordGrown.height).toBeGreaterThan(lineHeight * 30);
  expect(await scrollsInside(recordProse)).toBe(false);
  await recordProse.fill(prose.split('\n').slice(0, 6).join('\n'));
  const heading = await edgesOf(panel.getByRole('heading', { level: 2 }));
  await recordProse.scrollIntoViewIfNeeded();
  expect((await edgesOf(panel.getByRole('heading', { level: 2 }))).top).toBe(
    heading.top,
  );
  await expect(
    panel.getByRole('button', { name: 'Close threats' }),
  ).toBeVisible();
  await recordProse.scrollIntoViewIfNeeded();
  const manual = await edgesOf(recordProse);
  await page.mouse.move(manual.right - 5, manual.bottom - 5);
  await page.mouse.down();
  await page.mouse.move(manual.right - 5, manual.bottom + 40, { steps: 5 });
  await page.mouse.up();
  await expect(recordProse).toHaveCSS('resize', 'vertical');
  const resized = (await edgesOf(recordProse)).height;
  expect(resized).toBeGreaterThan(manual.height);
  await recordProse.press('End');
  await recordProse.press('x');
  expect((await edgesOf(recordProse)).height).toBe(resized);
  await recordProse.press('Backspace');
  expect((await edgesOf(recordProse)).height).toBe(resized);
  await runFromMenu(page, 'Undo');
  await expect(recordProse).toHaveCount(0);
  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue('');
  await runFromMenu(page, 'Redo');
  await expect(description).toHaveValue(prose);
  await description.fill(`Draft${softHyphen}text`);
  await panel.getByRole('button', { name: 'Restore pane width' }).click();
  await expect(description).toHaveAttribute('aria-invalid', 'true');
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await expect(description).toHaveValue(`Draft${softHyphen}text`);
  await expect(description).toHaveAttribute('aria-invalid', 'true');
});

test('long titles and fields remain usable in a narrow viewport', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectByKeyboard(page, storefront.shopper);
  const panel = threatPanel(page);
  await threatSummary(page, storefront.takeover).click();
  const severityField = panelField(page, 'combobox', 'Severity');
  const statusField = panelField(page, 'combobox', 'Status');
  const desktopSeverity = await edgesOf(severityField);
  const desktopStatus = await edgesOf(statusField);
  expect(desktopStatus.top).toBe(desktopSeverity.top);
  await titleField(page).fill('A long threat title '.repeat(15));
  await titleField(page).press('Enter');
  await page.setViewportSize({ width: 360, height: 640 });
  await panel.getByRole('button', { name: 'Widen pane' }).click();
  const bounds = await edgesOf(panel);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(360);
  expect(
    await panel.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await onScreen(severityField);
  await onScreen(statusField);
  const severity = await edgesOf(severityField);
  const status = await edgesOf(statusField);
  expect(severity.left).toBeGreaterThanOrEqual(bounds.left);
  expect(severity.right).toBeLessThanOrEqual(bounds.right);
  expect(status.left).toBeGreaterThanOrEqual(bounds.left);
  expect(status.right).toBeLessThanOrEqual(bounds.right);
  expect(
    status.left >= severity.right || status.top >= severity.bottom,
    'Severity and Status overlap',
  ).toBe(true);
  await chooseInPanel(page, 'Severity', 'Critical');
  await expect(severityField).toContainText('Critical');
  await chooseInPanel(page, 'Status', 'Mitigated');
  await expect(statusField).toContainText('Mitigated');
  const longSummary = threatSummary(page, /A long threat title/u);
  await longSummary.scrollIntoViewIfNeeded();
  expect((await edgesOf(longSummary)).right).toBeLessThanOrEqual(bounds.right);
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, storefront.shopper)).toBeFocused();
});

test('a long element name leaves the pane heading and editor reachable', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('Enter');
  const name = nameField(page, 'Actor');
  await name.fill('A long system component name '.repeat(30));
  await name.press('Enter');
  await page.setViewportSize({ width: 360, height: 640 });
  const panel = threatPanel(page);
  const heading = panel.getByRole('heading', { level: 2 });
  await panel.getByRole('button', { name: 'Widen pane' }).focus();
  await page.keyboard.press('Tab');
  await expect(heading).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => heading.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press('Shift+Tab');
  await expect(panel.getByRole('button', { name: 'Widen pane' })).toBeFocused();
  await page.keyboard.press('Enter');
  await panel.getByRole('button', { name: 'Add a threat' }).click();
  await expect(titleField(page)).toBeFocused();
  await titleField(page).fill('A threat under a long element name');
  await titleField(page).press('Enter');
  const description = panel.getByRole('textbox', {
    name: 'Description',
    exact: true,
  });
  await description.fill('The editor remains reachable.');
  await panel.getByRole('button', { name: 'Close threats' }).click();
  await expect(panel).toHaveCount(0);
  await expect(nodeNamed(page, /^A long system component name/u)).toBeFocused();
  await page.keyboard.press(registeredChords['focus-threats'][0]);
  await threatSummary(page, /A threat under a long element name/u).click();
  await expect(description).toHaveValue('The editor remains reachable.');
});
