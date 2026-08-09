import en from '../../messages/en.json';
import fil from '../../messages/fil.json';
import type { Locale } from '@/i18n/routing';

/**
 * A stand-in for `next-intl/server` in unit tests.
 *
 * `getTranslations` resolves the locale from request-scoped async storage, so a
 * Server Component that calls it cannot be rendered by Vitest at all. The
 * alternative to mocking it is testing these components only through Playwright
 * — which would mean the negatives that matter most here (a component refusing
 * a prop, a future date throwing) are checked in a browser, slowly, once.
 *
 * 🔑 **It reads the real message catalogues**, and a missing key throws rather
 * than rendering the key back. So every component test is also a test that the
 * strings it renders exist in BOTH locales — which is the failure mode a mock
 * returning `key` would hide completely.
 */

type Catalogue = Record<string, Record<string, string>>;

const CATALOGUES: Record<Locale, Catalogue> = { en, fil };

/** Mutable so a test can render the same component in the other language. */
export const localeState: { current: Locale } = { current: 'en' };

export type TranslationValues = Record<string, string | number>;

function translator(namespace: string) {
  const messages = CATALOGUES[localeState.current][namespace];
  if (!messages)
    throw new Error(
      `no "${namespace}" namespace in messages/${localeState.current}.json`
    );

  return (key: string, values?: TranslationValues): string => {
    const template = messages[key];
    if (template === undefined)
      throw new Error(
        `missing message "${namespace}.${key}" in messages/${localeState.current}.json`
      );

    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      values && name in values ? String(values[name]) : whole
    );
  };
}

/** The mocked module. `vi.mock('next-intl/server', () => intlServerMock())`. */
export function intlServerMock() {
  return {
    getLocale: async (): Promise<Locale> => localeState.current,
    /*
     * `next-intl`'s formatter, as far as these components use it. Its own
     * `dateTime` is a thin wrapper over `Intl.DateTimeFormat` with the locale
     * bound, so a stand-in that does exactly that renders what production
     * renders — including the timezone the caller pins.
     */
    getFormatter: async () => ({
      dateTime: (value: Date, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(localeState.current, options).format(value),
    }),
    getTranslations: async (
      namespaceOrOptions: string | { locale?: Locale; namespace: string }
    ) =>
      translator(
        typeof namespaceOrOptions === 'string'
          ? namespaceOrOptions
          : namespaceOrOptions.namespace
      ),
  };
}
