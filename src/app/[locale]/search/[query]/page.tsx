import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { POPULAR_QUERIES } from '@/components/home/SearchForm';
import { SearchResultsView } from '@/components/services/SearchResultsView';
import { routing } from '@/i18n/routing';
import { decodeParam } from '@/lib/route-params';

/**
 * Search results — server-rendered, and working with JavaScript disabled.
 *
 * 🔴 **The query is a route SEGMENT, not a search parameter, and that is the
 * whole reason this file exists.** `cacheComponents` will not let a prerendered
 * route read a search parameter outside `<Suspense>`, and a Suspense boundary
 * puts the results behind JavaScript: React streams a resolved boundary as a
 * `hidden` div plus an inline script that moves it into place, so with scripting
 * off the results are in the HTML and invisible. That version was built,
 * measured and rejected.
 *
 * A route param is known at render start, so everything below is ordinary
 * server-rendered HTML with no boundary and nothing to hydrate.
 *
 * The screen itself is `SearchResultsView`, shared with the category-filtered
 * route beside this one.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search/[query]'>): Promise<Metadata> {
  const { locale, query } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'search' });

  return {
    title: t('resultsTitle', { query: decodeParam(query) }),
    description: t('hint'),
    robots: { index: false, follow: true },
  };
}

/**
 * The popular queries, prerendered.
 *
 * `cacheComponents` requires at least one result here so the build can prove
 * there is no other dynamic access in the route. That constraint turns into a
 * genuine benefit: these are the tasks a resident most often arrives with, and
 * they come off a static file. Everything else renders on demand.
 */
export function generateStaticParams() {
  /*
   * The same three the hero's chips link to, so the commonest journey into this
   * portal is served from a static file. ENCODED exactly as the chips encode
   * them, or the prerendered path and the linked path differ by a space and
   * neither is reused.
   *
   * ⚠️ A prerendered route then receives this string RAW, while a dynamically
   * rendered one receives it decoded — see `decodeParam`, which is what makes
   * the two agree.
   */
  return POPULAR_QUERIES.map(query => ({ query: encodeURIComponent(query) }));
}

export default async function SearchResultsPage({
  params,
}: PageProps<'/[locale]/search/[query]'>) {
  const { locale, query } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  /*
   * `decodeParam`, never a bare `decodeURIComponent`. A prerendered page gets
   * the raw segment and a dynamic one gets it decoded, and the bare call is
   * wrong for one of them whichever way it goes — see the module for the two
   * failures that produced.
   */
  return (
    <SearchResultsView locale={locale} query={decodeParam(query).trim()} />
  );
}
