/**
 * Calendar dates, and the one way this portal is allowed to render them.
 *
 * Every date shown here is a CALENDAR DAY, not an instant: the day a document
 * was retrieved, the day a fact was last checked, the day somebody looked for a
 * hotline and did not find one.
 *
 * 🔴 `timeZone: 'UTC'` is load-bearing rather than defensive. `2026-08-09`
 * parses as midnight UTC, so rendering it in any timezone west of UTC prints
 * the eighth — and a check date off by one day is a small, permanent,
 * unnoticeable falsehood in a record whose whole value is that its dates are
 * true. The formatting itself goes through `next-intl`'s formatter, per
 * docs/coding-standards.md § Internationalisation; what lives here is the
 * validation and the options, so both are one decision instead of a repeated
 * object literal that only some call sites remember to pin.
 */

/**
 * The options every calendar date is rendered with. Never inline these.
 *
 * `as const` rather than typed `Intl.DateTimeFormatOptions`: `next-intl`'s
 * formatter takes its own narrower options type — it does not accept the
 * offset-style `timeZoneName` values the DOM type allows — and a widened
 * annotation here fails to assign at every call site.
 */
export const CALENDAR_DATE = {
  timeZone: 'UTC',
  dateStyle: 'long',
} as const;

/**
 * An ISO calendar date as the instant that names it, or a throw.
 *
 * The schema already requires `YYYY-MM-DD` on every date it governs. This
 * catches the ones it does not — a config edit, a script, a value read from
 * data — before `Invalid Date` renders on a civic page.
 */
export function calendarDate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
    throw new Error(
      `not an ISO calendar date: "${iso}". Dates in this portal come from the content schema, which requires YYYY-MM-DD.`
    );

  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()))
    throw new Error(`not a real date: "${iso}".`);

  return date;
}
