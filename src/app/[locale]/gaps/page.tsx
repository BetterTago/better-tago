import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { GAP_PATHS, lguConfig } from '@/lib/lgu-config';

/**
 * The gap register, rendered.
 *
 * Every `pending` entry in the configuration, in one list, with its reason, the
 * channel that would close it and the day somebody last looked.
 *
 * ## Why this page is the point rather than an appendix
 *
 * Most of what this project knows about the Municipality of Tago is that it
 * does not know it yet. Every `GapNotice` on every surface links here, and this
 * is what turns "we do not know" from an apology into a request for help: a
 * resident or a municipal officer can read exactly what is still missing, why,
 * and what it would take. It is the honest counterpart of a sources page.
 *
 * 🔴 **The register is rendered, never re-authored.** Every word below comes
 * from `config/lgu.config.json`. Adding or closing a gap is a configuration
 * change and touches no code: a new `null` plus its entry appears here by
 * itself, and filling the value removes it — `lgu-config.ts` refuses to parse
 * if either half is missing.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/gaps'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'gaps' });

  return {
    title: t('title'),
    description: t('lead'),
    alternates: { canonical: `/${locale}/gaps` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function GapRegisterPage({
  params,
}: PageProps<'/[locale]/gaps'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tGap, format] = await Promise.all([
    getTranslations('gaps'),
    getTranslations('gap'),
    getFormatter(),
  ]);

  const entries = GAP_PATHS.map(path => ({
    path,
    entry: lguConfig.pending[path],
  }));

  const open = entries.filter(item => item.entry.state === 'open');
  const held = entries.filter(item => item.entry.state === 'held');

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="font-display text-section font-bold text-balance">
        {t('title')}
      </h1>
      <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-secondary">
        {t('lead')}
      </p>
      <p className="mt-3 max-w-prose leading-relaxed text-ink-secondary tabular-nums">
        {t('counts', { open: open.length, held: held.length })}
      </p>

      {/* Two groups, because `open` and `held` are different absences and must
          not read as one: "we could not get it" against "we have it and are
          deliberately not publishing it". */}
      <GapGroup
        heading={t('openHeading')}
        blurb={t('openBlurb')}
        items={open}
        labelFor={() => tGap('notObtained')}
        channelLabel={key => t(`channel.${key}`)}
        checkedLabel={date => tGap('checked', { date })}
        format={format}
      />

      {held.length > 0 && (
        <GapGroup
          heading={t('heldHeading')}
          blurb={t('heldBlurb')}
          items={held}
          labelFor={() => tGap('held')}
          channelLabel={key => t(`channel.${key}`)}
          checkedLabel={date => tGap('checked', { date })}
          format={format}
        />
      )}

      {/* The register's notes are written in English in the configuration, so a
          Filipino reader is reading English here. That fallback is never silent
          anywhere else in this portal and it is not silent here either. */}
      {locale !== 'en' && (
        <p className="mt-10 max-w-prose rounded-xl border border-dashed border-line-control bg-surface-sunken p-4 leading-relaxed text-ink-secondary">
          {tGap('englishOnly')}
        </p>
      )}
    </Container>
  );
}

function GapGroup({
  heading,
  blurb,
  items,
  labelFor,
  channelLabel,
  checkedLabel,
  format,
}: {
  heading: string;
  blurb: string;
  items: { path: string; entry: (typeof lguConfig)['pending'][string] }[];
  labelFor: (path: string) => string;
  channelLabel: (channel: string) => string;
  checkedLabel: (date: string) => string;
  format: Awaited<ReturnType<typeof getFormatter>>;
}) {
  return (
    <section aria-labelledby={`gaps-${heading}`} className="mt-12">
      <h2 id={`gaps-${heading}`} className="text-feature font-bold">
        {heading}
      </h2>
      <p className="mt-2 max-w-prose leading-relaxed text-ink-secondary">
        {blurb}
      </p>

      <ul className="mt-6 grid gap-4">
        {items.map(({ path, entry }) => (
          <li
            key={path}
            className="rounded-xl border border-dashed border-line-control bg-surface-sunken p-5"
          >
            <p className="text-sm font-semibold tracking-wide text-ink-accent-strong uppercase">
              {labelFor(path)}
            </p>
            {/* The dotted config path. Deliberately visible: it is what a
                contributor needs in order to close the gap, and it is what
                proves this page is the register rather than a retelling. */}
            <h3 className="mt-1 font-mono text-sm break-all text-ink">
              {path}
            </h3>
            <p className="mt-2 max-w-prose leading-relaxed text-ink">
              {entry.note}
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-secondary">
              <span>{channelLabel(entry.channel)}</span>
              <span>
                {checkedLabel(
                  format.dateTime(
                    calendarDate(entry.lastCheckedAt),
                    CALENDAR_DATE
                  )
                )}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
