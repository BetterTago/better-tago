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
 * A year on its own, for a historical milestone the record dates only to a year.
 *
 * Same UTC pinning and the same reason: `1865-01-01` west of UTC renders as
 * 1864. A timeline entry off by a year is exactly the kind of small permanent
 * falsehood this module exists to prevent, and it is harder to notice than a
 * wrong day because nobody checks a year against a calendar.
 */
export const YEAR_ONLY = {
  timeZone: 'UTC',
  year: 'numeric',
} as const;

/**
 * A clock time, for the ONE value in this portal that is an instant.
 *
 * 🔴 It pins **`Asia/Manila`, not UTC**, and that is the opposite of every
 * other export here on purpose. The two constants above render a calendar DAY
 * and must print the day they name from anywhere; a weather reading is a moment,
 * and the only moment a resident of Tago cares about is the one on their own
 * clock. Rendering `06:00 PHT` as `22:00` because the server is in UTC would
 * make a current reading look like last night's.
 *
 * It is stated here rather than relying on the global `timeZone` in
 * `src/i18n/request.ts` — which is also `Asia/Manila` — because a reading whose
 * hour is wrong is indistinguishable from a stale one, and that is too quiet a
 * failure to leave to a default two files away.
 */
export const TIME_OF_DAY = {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
} as const;

/*
 * ⚠️ There is deliberately no zoned variant here, and it was tried.
 *
 * `timeZoneName: 'shortGeneric'` renders "Philippines Time" / "Oras sa
 * Pilipinas" and would be ideal, but next-intl's formatter accepts only
 * `'long' | 'short'` — the same narrowing the note above records — and `'short'`
 * gives "GMT+8", which is worse than nothing on a municipal page.
 *
 * So the zone is named in the MESSAGE catalogue instead (`weather.conditionAt`),
 * where a translator controls the wording and the time itself still goes through
 * the formatter. Do not reach for `Intl.DateTimeFormat` directly to get around
 * this; formatting belongs to next-intl.
 */

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
