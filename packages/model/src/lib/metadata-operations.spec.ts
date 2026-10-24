import { Result, Option } from 'effect';
import { validModel } from '../fixtures.js';
import { setModelMetadata } from './metadata-operations.js';

describe('setModelMetadata', () => {
  it('replaces the named fields and keeps the others', () => {
    const next = Result.getOrThrow(
      setModelMetadata(validModel, {
        owner: 'Jonas Lindqvist',
        contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
      }),
    );
    expect(next.metadata).toEqual({
      ...validModel.metadata,
      owner: 'Jonas Lindqvist',
      contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
    });
    expect(next.diagrams).toBe(validModel.diagrams);
  });

  it('clears a field to empty text', () => {
    const next = Result.getOrThrow(
      setModelMetadata(validModel, { title: '', contributors: [] }),
    );
    expect(next.metadata).toMatchObject({ title: '', contributors: [] });
  });

  it('keeps the model where nothing differs', () => {
    expect(Result.getOrThrow(setModelMetadata(validModel, {}))).toBe(
      validModel,
    );
    expect(
      Result.getOrThrow(
        setModelMetadata(validModel, { ...validModel.metadata }),
      ),
    ).toBe(validModel);
  });

  it('names the field or contributor carrying a refused character', () => {
    expect(
      Option.getOrUndefined(
        Result.getFailure(
          setModelMetadata(validModel, { description: 'ab\u0007' }),
        ),
      ),
    ).toMatchObject({
      _tag: 'RefusedMetadataCharacter',
      field: 'description',
      at: 2,
    });
    expect(
      Option.getOrUndefined(
        Result.getFailure(
          setModelMetadata(validModel, { contributors: ['Ada', '\u200bBob'] }),
        ),
      ),
    ).toMatchObject({
      _tag: 'RefusedContributorCharacter',
      contributor: 1,
      at: 0,
    });
  });
});
