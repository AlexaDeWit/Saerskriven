import { expect, test } from '@playwright/test';
import { sha256Of } from '@saerskriven/model/fixtures';
import { exportGolden } from './exports.fixtures.js';
import { exportedFile, openFile, twoDiagramsFile } from './studio.fixtures.js';

test('exports the diagram, picture, register and Typst source the CLI writes, byte for byte', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);

  await test.step('the drawing', async () => {
    const output = await exportedFile(page, 'Diagram as SVG: Taking an order');
    expect.soft(output.name).toBe('two-diagrams.svg');
    expect
      .soft(output.bytes)
      .toEqual(exportGolden('two-diagrams-storefront.snapshot.svg'));
  });

  await test.step('the picture', async () => {
    const output = await exportedFile(page, 'Diagram as PNG');
    expect.soft(output.name).toBe('two-diagrams.png');
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
