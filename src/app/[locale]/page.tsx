import { ArrowUpRight, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';

/**
 * The holding page.
 *
 * This is deliberately not a portal home page. The domain is secured and the
 * platform is standing, but the municipality has not yet been asked for
 * permission to republish its Citizen's Charter — and this project does not
 * build first and ask later. A name people find with nothing behind it is worse
 * than a name they never find, so the one page that exists says plainly what
 * this is, what it is not, that nothing has been published yet, and where the
 * real record lives.
 *
 * It gets replaced by the actual home page once the introduction has happened
 * and there is content to index.
 */
export default async function HoldingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('holding');
  const { officialSite, emergency, lgu } = lguConfig;

  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm font-semibold tracking-wide text-accent-700 uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-bold text-balance sm:text-4xl">
        {t('heading')}
      </h1>
      <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-secondary">
        {t('lead')}
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="status-heading">
          <h2 id="status-heading" className="text-lg font-semibold">
            {t('statusHeading')}
          </h2>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-secondary">
            {t('statusBody')}
          </p>
        </section>

        <section aria-labelledby="official-heading">
          <h2 id="official-heading" className="text-lg font-semibold">
            {t('officialHeading')}
          </h2>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-secondary">
            {t('officialBody')}
          </p>
          <a
            href={officialSite.url}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-5 font-semibold text-ink-link hover:border-ink-link"
          >
            {t('officialCta')}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </section>
      </div>

      <section
        aria-labelledby="emergency-heading"
        className="mt-12 rounded-lg border border-line bg-surface-notice p-6"
      >
        <h2
          id="emergency-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Phone aria-hidden="true" className="size-5" />
          {t('emergencyHeading')}
        </h2>
        <p className="mt-3 flex flex-wrap items-center gap-x-3">
          <span className="text-ink-secondary">{t('emergencyNational')}</span>
          {/* min-h-11 = 44px. This is the most important tappable thing on the
              page and it is reached by someone in a hurry, so it gets a real
              target rather than whatever the type size happens to produce. */}
          <a
            href={`tel:${emergency.nationalLine}`}
            className="inline-flex min-h-11 items-center text-xl font-bold text-ink-link hover:text-ink-link-hover"
          >
            {emergency.nationalLine}
          </a>
        </p>
        {/* The gap is the content. A municipality on the Pacific seaboard with
            no findable local hotline is the single most important thing this
            page has to say, and rounding it off with a plausible number would
            be the most dangerous thing it could do. */}
        <p className="mt-3 max-w-prose leading-relaxed text-ink-secondary">
          {t('emergencyGap')}
        </p>
      </section>

      <p className="sr-only">
        {lgu.officialName}, {lgu.province}, {lgu.region}
      </p>
    </Container>
  );
}
