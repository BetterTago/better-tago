import { ArrowUpRight } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Section } from '@/components/ui/Section';
import { getHistoryTimeline } from '@/lib/content';
import { CALENDAR_DATE, YEAR_ONLY, calendarDate } from '@/lib/dates';
import { lguConfig } from '@/lib/lgu-config';

/**
 * The history timeline.
 *
 * Six dated entries, read from `content/home/history/timeline.yaml` — every
 * one of them fetched from the municipality's own history page and checked
 * against it directly, not paraphrased from a request and not assumed correct
 * because it matched what was already in the configuration.
 *
 * ## Content, not code
 *
 * This used to be five entries built from `lguConfig.lgu.history` plus five
 * matching message-template keys, one pair per entry. That shape meant adding
 * a sixth entry was a CODE change — a new object literal here, a new key in
 * two message files. Narrative body copy belongs in `content/` (root rule
 * 6), so the timeline moved there: adding a seventh entry today is a YAML
 * edit, and this component does not change.
 *
 * ## Structure, and why each part of it matters
 *
 * · It is an `<ol>`. A stack of `<div>`s tells a screen reader nothing about
 *   order or length, and order is the entire content of a timeline.
 * · The period sits INSIDE the heading, so each entry's accessible name is
 *   self-contained — "1883 · Re-established" rather than "Re-established" with
 *   the year floating somewhere nearby.
 * · The rail is a bordered grid item with **no vertical padding on the `<li>`**.
 *   Padding there becomes a dead zone the line cannot reach, which breaks the
 *   rail into disconnected segments.
 *
 * ## The etymology column is deliberately absent
 *
 * The reference portal pairs its timeline with three name-origin cards. No
 * account of the name "Tago" has been sourced, so there is no counterpart here
 * and none may be invented. The timeline takes the full measure instead.
 *
 * 🔴 **Roles, never names — except here, and only here.** Two entries name a
 * historical office-holder. That is permitted by root rule 13's own
 * carve-out: a historical figure already in a cited public record, rendered
 * through `content/`. The carve-out is narrow on purpose — it does not extend
 * to this component, to any other component, to a test fixture, or to a
 * spec. Neither name appears anywhere in this file.
 */
export async function HistorySection() {
  const [t, tSource, format, locale, timeline] = await Promise.all([
    getTranslations('history'),
    getTranslations('source'),
    getFormatter(),
    getLocale(),
    getHistoryTimeline(),
  ]);

  const shortName = lguConfig.lgu.shortName;
  const isFil = locale === 'fil';

  const entries = timeline.entries.map((entry, index) => ({
    key: `${entry.period}-${index}`,
    // A bare 4-digit year formats as a year; a full ISO date carries a day.
    // Never a pre-formatted string — that would be English by construction
    // and could not be rendered in the other locale.
    period: /^\d{4}$/.test(entry.period)
      ? format.dateTime(calendarDate(`${entry.period}-01-01`), YEAR_ONLY)
      : format.dateTime(calendarDate(entry.period), CALENDAR_DATE),
    title: isFil ? entry.title.fil : entry.title.en,
    body: isFil ? entry.body.fil : entry.body.en,
    milestone: entry.milestone,
  }));

  const sourceLabel = isFil
    ? timeline.source.label.fil
    : timeline.source.label.en;

  return (
    <Section
      id="history"
      eyebrow={t('eyebrow')}
      heading={t('heading', { municipality: shortName })}
      className="page-measure"
      intro={
        <p className="mb-6 leading-relaxed text-ink-secondary">{t('intro')}</p>
      }
    >
      <ol className="grid">
        {entries.map((entry, index) => (
          // The rail: `border-s` draws one continuous line down every item but
          // the last; no vertical padding on the <li> itself, or the line
          // breaks into disconnected segments.
          <li
            key={entry.key}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4"
          >
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={
                  entry.milestone
                    ? 'mt-1.5 size-3 shrink-0 rounded-full bg-accent-400'
                    : 'mt-1.5 size-3 shrink-0 rounded-full border-2 border-line-control bg-surface-page'
                }
              />
              {index < entries.length - 1 && (
                <span aria-hidden="true" className="w-px flex-1 bg-line" />
              )}
            </div>

            {/* The lift only — no card. The entry keeps its original plain
                presentation against the rail; `pb-8` rather than a margin,
                because vertical padding on the <li> itself becomes a dead zone
                the rail cannot reach. */}
            <div className="pb-8 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
              <h3 className="font-display text-base font-bold text-ink">
                <span className="text-ink-accent-strong tabular-nums">
                  {entry.period}
                </span>
                <span aria-hidden="true"> · </span>
                {entry.title}
                {/* Colour is never the only channel: the gold dot means
                    "milestone", and this says so in text. */}
                {entry.milestone && (
                  <span className="sr-only"> ({t('milestone')})</span>
                )}
              </h3>
              <p className="mt-1 max-w-prose leading-relaxed text-ink-secondary">
                {entry.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* One citation for the whole timeline, at the bottom — the entries
          share it, so it is stated once rather than repeated six times. */}
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-tertiary">
        <span className="font-semibold tracking-label text-ink-secondary uppercase">
          {t('sourceLabel')}:
        </span>{' '}
        {sourceLabel} ·{' '}
        {tSource('retrieved', {
          date: format.dateTime(
            calendarDate(timeline.source.retrievedAt),
            CALENDAR_DATE
          ),
        })}
        {'  '}
        <a
          href={timeline.source.url ?? undefined}
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
        >
          {t('openSource')}
          <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
        </a>
      </p>
    </Section>
  );
}
