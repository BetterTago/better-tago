import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchForm } from '@/components/home/SearchForm';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';

/**
 * The search page with no query yet — a form and a prompt, fully static.
 *
 * It reads no search parameter at all. The query lives in a route SEGMENT
 * (`/search/[query]`), reached through the form's route handler, because
 * `cacheComponents` will not let a prerendered route read uncached data outside
 * `<Suspense>` — and a Suspense boundary puts the results behind JavaScript,
 * which is the one thing `TAGO-110` says this route may not do.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'search' });

  return {
    title: t('title'),
    description: t('hint'),
    // Not a destination. A crawler indexing every query produces thousands of
    // near-duplicate URLs of a civic site.
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/search` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function SearchPage({
  params,
}: PageProps<'/[locale]/search'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('search');

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="font-display text-section font-bold text-balance">
        {t('title')}
      </h1>
      <div className="mt-6 max-w-xl">
        <SearchForm locale={locale} variant="compact" />
      </div>
      <p className="mt-8 max-w-prose leading-relaxed text-ink-secondary">
        {t('emptyQuery')}
      </p>
    </Container>
  );
}
