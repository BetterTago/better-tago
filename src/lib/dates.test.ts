import { describe, expect, it } from 'vitest';
import { CALENDAR_DATE, calendarDate } from './dates';

/** What `next-intl`'s formatter does with these options, without the runtime. */
const render = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, CALENDAR_DATE).format(calendarDate(iso));

describe('calendarDate', () => {
  it('renders the day the record actually names', () => {
    expect(render('2026-08-09', 'en')).toBe('August 9, 2026');
    expect(render('2026-01-01', 'en')).toBe('January 1, 2026');
  });

  it('survives being run in a timezone that would shift the day', () => {
    /*
     * The whole reason `CALENDAR_DATE` pins UTC. Under a local-time render on a
     * machine west of UTC — which is most of the Americas, and any CI runner
     * somebody points at a different region — this prints the eighth.
     */
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Honolulu'; // UTC-10
      expect(render('2026-08-09', 'en')).toBe('August 9, 2026');
    } finally {
      process.env.TZ = original;
    }
  });

  it('speaks Filipino', () => {
    // Not a nicety: `fil` has to resolve in the runtime's ICU data, or every
    // date on the Filipino half of the portal silently falls back to English
    // while everything around it is translated.
    const filipino = render('2026-08-09', 'fil');
    expect(filipino).toContain('2026');
    expect(filipino).not.toBe(render('2026-08-09', 'en'));
  });

  it('refuses anything that is not a calendar date', () => {
    expect(() => calendarDate('2026-8-9')).toThrow(/ISO calendar date/);
    expect(() => calendarDate('9 August 2026')).toThrow();
    expect(() => calendarDate('')).toThrow();
  });

  it('refuses a date that parses but does not exist', () => {
    expect(() => calendarDate('2026-13-01')).toThrow(/not a real date/);
  });

  it('pins the options in one place', () => {
    // A call site that inlines its own options is a call site that will one day
    // omit the timezone, and the day it prints will be wrong by one.
    expect(CALENDAR_DATE.timeZone).toBe('UTC');
  });
});
