import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { POPULAR_QUERIES } from '@/components/home/SearchForm';
import { SearchResultsView } from '@/components/services/SearchResultsView';
import { routing } from '@/i18n/routing';
import { getCharterSections } from '@/lib/content';
import { decodeParam } from '@/lib/route-params';
import { searchServices } from '@/lib/search';

/**
 * Search results, narrowed to one category.
 *
 * ## Why this is a route and not a `?category=` parameter
 *
 * The same reason the query itself is a segment: under `cacheComponents` a
 * prerendered route cannot read a search parameter outside `<Suspense>`, and a
 * Suspense boundary streams as a hidden div — the rows would be in the HTML and
 * invisible with scripting off. A narrowed result set is also something a
 * reader sends to somebody else, and a segment is an ordinary shareable URL.
 *
 * ## An unknown category falls back, it does not 404
 *
 * Same rule as the office facet: a category here is a FILTER VALUE, so an
 * unknown one renders the unfiltered result set rather than an error. A
 * mistyped `/services/<category>` still 404s, because that names a page.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search/[query]/[category]'>): Promise<Metadata> {
  const { locale, query, category } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  /*
   * ⚠️ Validated BEFORE the label is looked up. `categories.<slug>` has no
   * message for a slug that is not a category, and next-intl throws
   * `MISSING_MESSAGE` — which the redirect below then hides, so it surfaced
   * only as noise in the production log. The page redirects; its metadata is
   * never rendered, so there is nothing to translate.
   */
  const known = (await getCharterSections()).some(
    section => section.category === category
  );
  if (!known) return {};

  const t = await getTranslations({ locale, namespace: 'search' });
  const tServices = await getTranslations({ locale, namespace: 'services' });

  return {
    // "“certificate” in Civil registry" — the query first, because that is what
    // the reader typed and what they will scan a history for.
    title: t('resultsInCategory', {
      query: decodeParam(query),
      category: tServices(`categories.${category}`),
    }),
    description: t('hint'),
    robots: { index: false, follow: true },
  };
}

/**
 * The popular queries crossed with the categories that actually match them.
 *
 * `cacheComponents` needs at least one entry to prove the route has no other
 * dynamic access. Generating only the pairs that HAVE results also means no
 * prerendered facet page is empty — a URL in the build output that renders
 * "nothing matched" would be a facet that should never have been offered.
 */
export async function generateStaticParams() {
  const nested = await Promise.all(
    POPULAR_QUERIES.map(async query => {
      const categories = [
        ...new Set((await searchServices(query)).map(hit => hit.category)),
      ];
      // 🔴 RAW, never `encodeURIComponent` — same rule as the route above.
      // Next encodes a returned param itself when it builds the path; encoding
      // it here leaves the URL identical and the recorded param double-encoded.
      return categories.map(category => ({ query, category }));
    })
  );
  const pairs: { query: string; category: string }[] = nested.flat();

  return routing.locales.flatMap(locale =>
    pairs.map(pair => ({ locale, query: pair.query, category: pair.category }))
  );
}

export default async function FilteredSearchResultsPage({
  params,
}: PageProps<'/[locale]/search/[query]/[category]'>) {
  const { locale, query, category } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const known = (await getCharterSections()).some(
    section => section.category === category
  );
  const decoded = decodeParam(query).trim();

  /*
   * Decoded, then encoded once — never passed through as-is. The param arrives
   * at whichever encoding depth this render happened to be produced at, and
   * forwarding that raw is how `business%20permit` becomes `business%2520permit`
   * one redirect later.
   */
  if (!known) redirect(`/${locale}/search/${encodeURIComponent(decoded)}`);

  return (
    <SearchResultsView category={category} locale={locale} query={decoded} />
  );
}
