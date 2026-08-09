import { CircleHelp } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { type GapPath, gapFor } from '@/lib/lgu-config';
import { cn } from '@/lib/utils';

/**
 * What this portal renders where a municipal fact is not known.
 *
 * Most of what this project knows about the municipality is that it does not
 * know it yet, and the configuration already models that honestly: an
 * unobtained fact is `null` and carries a `pending` entry saying what is
 * missing, what would close it, and the day somebody last looked. Nothing
 * rendered those entries, so every surface meeting a `null` was free to invent
 * its own empty state — a dash, a zero, a skeleton, a plausible number.
 *
 * 🔴 **The register is rendered, never re-authored.** The only prop is a
 * register path. There is no `label`, no `reason`, no `children`, and above all
 * no `value` or `fallback`: a component that can fall back to a number is a
 * component that will one day print a guess, and a component that accepts its
 * own prose is one where a gap gets explained one way on a page and another way
 * in the register.
 *
 * Adding or closing a gap therefore edits configuration and nothing else. A new
 * `null` plus its entry appears here by itself; filling the value removes it,
 * and `lgu-config.ts` fails the parse if either half is missing.
 */
export async function GapNotice({
  path,
  className,
}: {
  path: GapPath;
  className?: string;
}) {
  const entry = gapFor(path);
  const t = await getTranslations('gap');
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <div
      className={cn(
        // Dashed, sunken, and never shaped like the value it stands in for.
        // A reader skimming a row of figures has to be able to tell at a glance
        // that this one is a stated absence rather than a number.
        'rounded-lg border border-dashed border-line-control bg-surface-sunken p-4',
        className
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold tracking-wide text-ink-accent-strong uppercase">
        <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {/* `open` and `held` are different absences and must not read as one:
            one is "we could not get it", the other is "we have it and are
            deliberately not publishing it". */}
        {entry.state === 'held' ? t('held') : t('notObtained')}
      </p>

      {/* Verbatim, from the register. Not summarised, not softened. */}
      <p className="mt-2 max-w-prose leading-relaxed text-ink">{entry.note}</p>

      <p className="mt-2 text-sm text-ink-secondary">
        {t('checked', {
          date: format.dateTime(
            calendarDate(entry.lastCheckedAt),
            CALENDAR_DATE
          ),
        })}
      </p>

      {/* The register is written in English in the configuration, so a Filipino
          reader is reading English here. That fallback is never silent
          anywhere else in this portal and it is not silent here either. */}
      {locale !== 'en' && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-tertiary">
          {t('englishOnly')}
        </p>
      )}
    </div>
  );
}
