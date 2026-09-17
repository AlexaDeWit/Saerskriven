import { renderRegister } from '@saerskriven/render';
import {
  answerOf,
  featureCompleteFile,
  featureCompleteWorkspace,
} from './read-tools.fixtures.js';
import { readNamed } from './reading.js';
import { register, renderRegisterResult } from './register.js';

const workspace = featureCompleteWorkspace();

describe('what saer_register writes', () => {
  it('carries the markdown the render package writes for the model', () => {
    const model = answerOf(readNamed(workspace, undefined)).model;
    expect(answerOf(register(workspace, {})).markdown).toEqual(
      renderRegister(model),
    );
  });

  it('opens its text with the reading before the document itself', () => {
    const rendered = renderRegisterResult(answerOf(register(workspace, {})));
    expect(rendered[0]).toEqual(`file: ${featureCompleteFile}`);
    expect(rendered.at(-1)).toEqual(answerOf(register(workspace, {})).markdown);
  });
});
