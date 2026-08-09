import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    /*
     * The portal's own timezone, declared once.
     *
     * Without it `next-intl` formats every date and time in the SERVER's zone —
     * UTC on a hosting platform, whatever the laptop says in development — and
     * logs an error asking for this. A civic portal for a municipality in the
     * Philippines renders Philippine time or it renders the wrong hour, and
     * that is a decision that belongs here rather than at each call site.
     *
     * Calendar dates still pin UTC explicitly through `CALENDAR_DATE` in
     * `src/lib/dates.ts` — a retrieval date is a day, not an instant, and it
     * must render as the day it names from any zone at all.
     */
    timeZone: 'Asia/Manila',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
