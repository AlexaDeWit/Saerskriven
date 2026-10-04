import { expect, test } from '@playwright/test';
import { committedText, sha256Of } from '@saerskriven/model/fixtures';
import { canvasSettled } from './canvas.fixtures.js';
import { exportGolden } from './exports.fixtures.js';
import {
  exportedFile,
  downloaded,
  openMenu,
  menuItem,
  openFile,
  openFallback,
  openText,
  twoDiagramsFile,
} from './studio.fixtures.js';

test('exports the diagram, picture, register and Typst source the CLI writes, byte for byte', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);

  await test.step('the drawing', async () => {
    const output = await exportedFile(page, 'Diagram as SVG');
    expect.soft(output.name).toBe('two-diagrams - Taking an order.svg');
    expect
      .soft(output.bytes)
      .toEqual(exportGolden('two-diagrams-storefront.snapshot.svg'));
  });

  await test.step('the picture', async () => {
    const output = await exportedFile(page, 'Diagram as PNG');
    expect.soft(output.name).toBe('two-diagrams - Taking an order.png');
    expect
      .soft(sha256Of(output.bytes))
      .toBe(sha256Of(exportGolden('two-diagrams-storefront.snapshot.png')));
  });

  await test.step('the register', async () => {
    const output = await exportedFile(page, 'Register as Markdown');
    expect.soft(output.name).toBe('two-diagrams.md');
    expect
      .soft(output.bytes)
      .toEqual(exportGolden('two-diagrams.register.snapshot.md'));
  });

  await test.step('the Typst source', async () => {
    const output = await exportedFile(page, 'Model as Typst');
    expect.soft(output.name).toBe('two-diagrams.typ');
    expect
      .soft(output.bytes)
      .toEqual(exportGolden('two-diagrams.snapshot.typ'));
  });
});

test('names the open diagram, cleaned for a file name, when the model has several', async ({
  page,
}) => {
  const text = committedText(twoDiagramsFile).replace(
    'title: Taking an order',
    'title: "Orders: A/B?"',
  );
  await openFallback(page);
  await openText(page, 'two-diagrams.yaml', text);
  await canvasSettled(page);

  const drawing = await exportedFile(page, 'Diagram as SVG');
  const picture = await exportedFile(page, 'Diagram as PNG');

  expect(drawing.name).toBe('two-diagrams - Orders_ A_B_.svg');
  expect(picture.name).toBe('two-diagrams - Orders_ A_B_.png');
});

test('opts into Mermaid Markdown and returns to register-only output', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);
  await openMenu(page);
  await menuItem(page, 'Export').hover();
  const include = page.getByRole('menuitemcheckbox', {
    name: 'Include diagrams in Markdown',
  });
  await expect(include).not.toBeChecked();
  await include.focus();
  await page.keyboard.press('Space');
  await expect(include).toBeChecked();
  const combined = await downloaded(page, () =>
    menuItem(page, 'Register as Markdown').click(),
  );
  expect(combined.bytes).toEqual(
    exportGolden('two-diagrams.mermaid.snapshot.md'),
  );
  await openMenu(page);
  await menuItem(page, 'Export').hover();
  await expect(include).toBeChecked();
  await include.click();
  const register = await downloaded(page, () =>
    menuItem(page, 'Register as Markdown').click(),
  );
  expect(register.bytes).toEqual(
    exportGolden('two-diagrams.register.snapshot.md'),
  );
});
