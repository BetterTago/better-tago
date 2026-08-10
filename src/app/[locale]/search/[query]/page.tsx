import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchForm } from '@/components/home/SearchForm';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';
import { searchServices } from '@/lib/search';

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
 * ## The empty state is the normal case, and it is designed
 *
 * A search that finds nothing explains what to try instead and links the
 * official municipal site. On a portal that is still mostly gaps, a bare "no
 * results" would be the least useful screen on it.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/search/[query]'>): Promise<Metadata> {
  const { locale, query } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'search' });

  return {
    title: t('resultsTitle', { query: decodeURIComponent(query) }),
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
  // The same three the hero's chips link to, so the commonest journey into
  // this portal is served from a static file. Encoded exactly as the chips
  // encode them, or the prerendered path and the linked path would differ by a
  // space and neither would be reused.
  return ['business%20permit', 'birth%20certificate', 'indigency'].map(
    query => ({ query })
  );
}

export default async function SearchResultsPage({
  params,
}: PageProps<'/[locale]/search/[query]'>) {
  const { locale, query: encoded } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tServices] = await Promise.all([
    getTranslations('search'),
    getTranslations('services'),
  ]);

  /*
   * A malformed percent-escape throws from `decodeURIComponent`, and a crafted
   * URL is the ordinary way that happens. A 404 is the honest answer — the
   * alternative is a 500 on a civic site for a link somebody mistyped.
   */
  let query: string;
  try {
    query = decodeURIComponent(encoded).trim();
  } catch {
    notFound();
  }

  const hits = await searchServices(query);

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="font-display text-section font-bold text-balance">
        {t('title')}
      </h1>

      {/* Repeated here so a reader can refine without going back — the same GET
          form, the same mechanism, still no client component. */}
      <div className="mt-6 max-w-xl">
        <SearchForm locale={locale} variant="compact" defaultValue={query} />
      </div>

      {hits.length === 0 ? (
        <section aria-labelledby="no-results" className="mt-10">
          <h2 id="no-results" className="text-feature font-bold">
            {t('noResultsHeading', { query })}
          </h2>
          <p className="mt-3 max-w-prose leading-relaxed text-ink-secondary">
            {t('noResultsBody')}
          </p>
          <ul className="mt-4 grid gap-2">
            <li>
              <Link
                href="/services"
                className="inline-flex min-h-11 items-center text-ink-link hover:text-ink-link-hover"
              >
                {t('browseAll')}
              </Link>
            </li>
            <li>
              <a
                href={lguConfig.officialSite.url}
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-ink-link hover:text-ink-link-hover"
              >
                {t('tryOfficialSite')}
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </li>
          </ul>
        </section>
      ) : (
        <section aria-labelledby="results-heading" className="mt-10">
          <h2
            id="results-heading"
            className="text-feature font-bold tabular-nums"
          >
            {t('resultsHeading', { count: hits.length, query })}
          </h2>

          <ul className="mt-6 grid gap-3">
            {hits.map(hit => (
              <li key={hit.href}>
                <Link
                  href={hit.href}
                  className="block rounded-xl border border-line bg-surface-raised p-4 hover:border-ink-link"
                >
                  <span className="block font-semibold text-ink">
                    {hit.name}
                  </span>
                  <span className="mt-1 block text-sm text-ink-secondary">
                    {hit.description}
                  </span>
                  <span className="mt-2 block text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
                    {tServices(`categories.${hit.category}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
