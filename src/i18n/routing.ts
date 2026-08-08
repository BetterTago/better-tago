import { defineRouting } from 'next-intl/routing';

/**
 * EN and FIL only.
 *
 * Surigaonon is the language most residents of Tago actually speak at home, and
 * serving it would materially improve this portal. It is a recorded later-phase
 * ambition, not a commitment — adding a locale here before there is a fluent
 * speaker to write and check the copy would ship machine output as publication,
 * which the bilingual policy forbids.
 */
export const routing = defineRouting({
  locales: ['en', 'fil'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
