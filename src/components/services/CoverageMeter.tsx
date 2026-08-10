import { getFormatter, getTranslations } from 'next-intl/server';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';

/**
 * How much of the charter this portal actually carries, stated on the page.
 *
 * A partial transcription that does not say it is partial reads as a complete
 * one — which is the single most consequential thing a civic index can get
 * wrong. So the figure is printed, next to the source it was read from and the
 * day somebody last checked.
 *
 * 🔴 **The bar is decorative and the SENTENCE carries the meaning.** "97 of 97
 * services fully transcribed · 100%" is the statement; the bar is
 * `aria-hidden`, because a reader using a screen reader has already been told
 * the number and a second announcement of the same fact as a progress widget is
 * noise. That is also why the fill clears 3:1 against its track rather than
 * being exempted as decoration — a sighted reader still reads the bar first.
 *
 * `checkedAt` is nullable and renders nothing when absent: a portal with no
 * content has not been checked, and printing today's date would be a small
 * permanent falsehood.
 */
export async function CoverageMeter({
  transcribed,
  total,
  checkedAt,
}: {
  transcribed: number;
  total: number;
  checkedAt: string | null;
}) {
  const t = await getTranslations('services');
  const format = await getFormatter();

  // A tree with no services is 0%, never NaN% and never a full bar.
  const percent = total === 0 ? 0 : Math.round((transcribed / total) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-ink-secondary">
        <span>{t('coverage', { transcribed, total })}</span>
        <span className="tabular-nums text-ink-tertiary">
          {t('coveragePercent', { percent })}
        </span>
      </div>

      <span
        aria-hidden="true"
        className="block h-1.5 overflow-hidden rounded-full bg-line"
      >
        {/*
         * Inline width, and only width. The percentage is data — no token can
         * express "the share of the charter that is transcribed today", and a
         * class per whole number would be a hundred dead utilities.
         */}
        <span
          className="block h-full bg-meter"
          style={{ width: `${percent}%` }}
        />
      </span>

      {/*
       * ⚠️ NO "open the original" link here, and the design sheet draws one.
       *
       * There is no single original. The charter is 22 separate documents, one
       * per office, and this portal has no index route over them — only
       * `/charter/documents/[slug]`. A link had to point at either a route that
       * does not exist or the municipality's site root, and neither is the
       * original of anything. The document link lives on a SERVICE page, where
       * there is exactly one document to open.
       */}
      {checkedAt && (
        <p className="text-sm leading-relaxed text-ink-tertiary">
          {t('coverageSource', {
            date: format.dateTime(calendarDate(checkedAt), CALENDAR_DATE),
          })}
        </p>
      )}
    </div>
  );
}
