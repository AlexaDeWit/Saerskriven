import { Either } from 'effect';
import { blobsOf, pngMagic, resourceProseOf } from '../fixtures.js';
import { dataNotInstructions, prefaced } from './preface.js';
import { builtRasterizer, rasterizerUnbuilt } from './rasterizer.fixtures.js';
import {
  answerOf,
  drawableTree,
  rootWorkspace,
  treeHolding,
  twoDiagramsWorkspace,
  twoDiagramsYaml,
} from './read-tools.fixtures.js';
import { mcpImageLongEdge } from './render-diagram.js';
import { register, renderRegisterResult } from './register.js';
import {
  completedDiagrams,
  diagramResourceDescription,
  diagramResourceName,
  diagramResources,
  diagramUri,
  readDiagramResource,
  readRegisterResource,
  ResourceFailure,
} from './resources.js';
import { noRasterizer } from './server.fixtures.js';

const drawable = drawableTree();

const opening = (text: string | undefined) => text?.split('\n')[0];

describe('the register resource', () => {
  it('carries the text saer_register answers with', () => {
    expect(Either.getOrThrow(readRegisterResource(drawable)).contents).toEqual([
      {
        uri: 'saer://register',
        mimeType: 'text/markdown',
        text: prefaced(renderRegisterResult(answerOf(register(drawable, {})))),
      },
    ]);
  });

  it('fails with no model where the server carries no default model', () => {
    expect(readRegisterResource(rootWorkspace())).toEqual(
      Either.left(ResourceFailure.NoModel()),
    );
  });
});

describe('the diagram resources', () => {
  it('lists every diagram of a model by position', () => {
    expect(diagramResources(twoDiagramsWorkspace()).resources).toEqual([
      {
        uri: 'saer://diagram/storefront',
        name: diagramResourceName(1),
        mimeType: 'image/png',
        description: diagramResourceDescription,
      },
      {
        uri: 'saer://diagram/fulfilment',
        name: diagramResourceName(2),
        mimeType: 'image/png',
        description: diagramResourceDescription,
      },
    ]);
  });

  it('leaves out a diagram whose id a URL parser would remove', () => {
    const dotted = treeHolding(
      twoDiagramsYaml().replace('id: storefront', "id: '.'"),
    );
    expect({
      listed: diagramResources(dotted).resources.map(
        (resource) => resource.uri,
      ),
      completed: completedDiagrams(dotted, ''),
    }).toEqual({
      listed: ['saer://diagram/fulfilment'],
      completed: ['fulfilment'],
    });
  });

  it('lists none where the server carries no default model', () => {
    expect(diagramResources(rootWorkspace()).resources).toEqual([]);
  });

  it('percent-encodes every character of an id that means something in a URI', () => {
    expect(diagramUri('../a b/c?d#e')).toEqual(
      'saer://diagram/..%2Fa%20b%2Fc%3Fd%23e',
    );
  });

  it('completes the diagram argument with the ids that start with what was typed', () => {
    expect(completedDiagrams(twoDiagramsWorkspace(), 'ful')).toEqual([
      'fulfilment',
    ]);
    expect(completedDiagrams(rootWorkspace(), '')).toEqual([]);
  });

  it('looks a decoded name up among the diagrams and reaches no path', async () => {
    const read = await readDiagramResource(
      drawable,
      noRasterizer,
      new URL('saer://diagram/..%2F..%2Fetc%2Fpasswd'),
      { diagram: '..%2F..%2Fetc%2Fpasswd' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.NoSuchDiagram()));
  });

  it('fails on a name that is not percent-encoded text', async () => {
    const read = await readDiagramResource(
      drawable,
      noRasterizer,
      new URL('saer://diagram/%E0'),
      { diagram: '%E0' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.UndecodableName()));
  });

  it('fails apart from a missing diagram where the rasterizer draws nothing', async () => {
    const read = await readDiagramResource(
      drawable,
      noRasterizer,
      new URL('saer://diagram/only'),
      { diagram: 'only' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.RasterizerFailed()));
  });

  it('fails with no model where the server carries no default model', async () => {
    const read = await readDiagramResource(
      rootWorkspace(),
      noRasterizer,
      new URL('saer://diagram/only'),
      { diagram: 'only' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.NoModel()));
  });

  describe.skipIf(rasterizerUnbuilt)('a diagram drawn', () => {
    it('carries the PNG blob and the text of the render', async () => {
      const read = Either.getOrThrow(
        await readDiagramResource(
          drawable,
          builtRasterizer,
          new URL('saer://diagram/only'),
          { diagram: 'only' },
        ),
      );
      const [image] = blobsOf(read);
      const prose = resourceProseOf(read);
      const png = Buffer.from(image?.bytes ?? []);
      expect(image?.mimeType).toEqual('image/png');
      expect(png.subarray(0, 4)).toEqual(pngMagic);
      expect(Math.max(png.readUInt32BE(16), png.readUInt32BE(20))).toBe(
        mcpImageLongEdge,
      );
      expect(prose.unread).toEqual([]);
      expect(prose.prose.map(opening)).toEqual([dataNotInstructions]);
    });
  });
});
