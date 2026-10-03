import type { Locale } from '@saerskriven/i18n';
import { act } from '@testing-library/react';
import { chooseLanguage } from './locale.js';

/**
 * Runs each test of the suite it is called in with `locale` chosen, and
 * chooses en-CA again after each, forgetting the stored choice.
 */
export const withLanguage = (locale: Locale): void => {
  beforeEach(() => {
    act(() => {
      chooseLanguage(locale);
    });
  });

  afterEach(() => {
    act(() => {
      chooseLanguage('en-CA');
    });
    globalThis.localStorage.clear();
  });
};
