import { CalendarClock } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { cadenceOf, freshnessOf } from '@/lib/freshness';
import { cn } from '@/lib/utils';

/**
 * A page past its review cadence says so, on the page, to the reader.
 *
 * Staleness is shown rather than hidden: this project restates a record it does
 * not control, and the honest failure mode is a page that admits it has not
 * been re-checked — not one that looks tended because nothing marks the date.
 *
 * Three things this component deliberately does NOT do:
 *
 *  - **It does not know the cadence.** That comes from
 *    `config/freshness.config.json` through `freshnessOf`, per data class. A
 *    cadence written into a component is a cadence that drifts per page.
 *  - **It does not warn early.** `due` — the last tenth of the cadence — exists
 *    so a review can be SCHEDULED before a reader ever sees a warning. Only
 *    `stale` renders.
 *  - **It does not know what day it is.** `today` is passed in. A statically
 *    prerendered page cannot read a clock without becoming dynamic, and every
 *    other date in this codebase is an argument rather than an ambient read —
 *    `freshnessOf` takes one, and so does the freshness report.
 */
export async function StalenessNotice({
  dataClass,
  lastCheckedAt,
  today,
  className,
}: {
  dataClass: string;
  lastCheckedAt: string;
  /** The day to measure against, as `YYYY-MM-DD`. */
  today: string;
  className?: string;
}) {
  const state = freshnessOf(dataClass, lastCheckedAt, today);

  /*
   * ★ TAGO-104 criterion 5. A check date in the future is not a degree of
   * staleness — no real check can produce one — so it is a defect, and a defect
   * in a check date has to stop the build rather than render as the freshest
   * page on the site. Throwing here fails the prerender of the page carrying
   * it, which names the page in the build log.
   */
  if (state === 'undated')
    throw new Error(
      `lastCheckedAt "${lastCheckedAt}" is in the future (today is "${today}"). A check that has not happened cannot be recorded as having happened — fix the manifest entry rather than the clock.`
    );

  if (state !== 'stale') return null;

  const t = await getTranslations('staleness');
  const format = await getFormatter();

  return (
    <div
      className={cn(
        'rounded-lg border border-line-control bg-surface-tint p-4',
        className
      )}
    >
      {/* The state is carried by the sentence, not by the tint or the icon —
          a reader who sees neither still reads that the page is overdue. */}
      <p className="flex items-start gap-2 font-semibold text-ink">
        <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {t('heading')}
      </p>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-secondary">
        {t('body', {
          date: format.dateTime(calendarDate(lastCheckedAt), CALENDAR_DATE),
          days: cadenceOf(dataClass),
        })}
      </p>
    </div>
  );
}
