import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { POPULAR_QUERIES, SearchForm } from '@/components/home/SearchForm';
import { PageMasthead } from '@/components/services/PageMasthead';
import {
  RAIL_ITEM,
  RAIL_ITEM_CURRENT,
  RAIL_ITEM_LINK,
} from '@/components/services/rail-item';
import { ServiceRow } from '@/components/services/ServiceRow';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';
import { lguConfig } from '@/lib/lgu-config';
import { searchServices } from '@/lib/search';
import { cn } from '@/lib/utils';

/**
 * The search screen — shared by `/search/[query]` and `/search/[query]/[category]`.
 *
 * One component rather than two nearly-identical routes: the category filter
 * changes which rows are shown and which facet is current, and nothing else.
 * Two copies of this would drift the first time either was touched.
 *
 * ## Why the field is in the masthead
 *
 * A reader who has just searched is most likely to search again — a first query
 * on a portal like this is usually a guess. The field belongs where their eye
 * already is, directly under the heading, not in a rail beside the results.
 */
export async function SearchResultsView({
  locale,
  query,
  category,
}: {
  locale: string;
  query: string;
  /** The category slug being filtered to, if any. Already validated. */
  category?: string;
}) {
  const [t, tCommon, tServices] = await Promise.all([
    getTranslations('search'),
    getTranslations('common'),
    getTranslations('services'),
  ]);

  const all = await searchServices(query);
  const hits = category ? all.filter(hit => hit.category === category) : all;

  /*
   * Counted over ALL results, never over the filtered set. A facet that counted
   * only what is already on screen would show every other category as zero the
   * moment one was chosen, which is the opposite of what a facet is for.
   */
  const facets = [...new Set(all.map(hit => hit.category))]
    .map(slug => ({
      slug,
      label: tServices(`categories.${slug}`),
      count: all.filter(hit => hit.category === slug).length,
    }))
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, locale)
    );

  const suggestions = POPULAR_QUERIES.filter(
    other => other.toLowerCase() !== query.toLowerCase()
  );

  const encoded = encodeURIComponent(query);

  /*
   * 🔴 The facets use `RAIL_ITEM` — the SAME control as the categories rail on
   * the index and the "On this page" rail on a service. Three rails in the same
   * 240px column doing the same job had drifted into three treatments; the
   * classes now live in one module so that cannot happen again.
   *
   * `data-dense-list` marks them as a listed, reviewed exemption from the 44px
   * touch floor — `services.a11y.spec.ts` names it. They are a secondary
   * refinement aid read as a reference list rather than operated as primary
   * controls, and every destination they offer is reachable another way: a
   * facet by re-reading the results, a suggestion from the home page's chips.
   */

  return (
    <>
      <PageMasthead
        aside={
          hits.length > 0 ? (
            <p className="flex flex-col gap-1 lg:text-right">
              <span className="font-display text-stat font-bold tabular-nums text-ink">
                {hits.length}
              </span>
              <span className="text-sm text-ink-secondary">
                {t('resultsFor', { count: hits.length, query })}
              </span>
            </p>
          ) : undefined
        }
        control={
          <div className="flex max-w-xl flex-col gap-2">
            <SearchForm
              defaultValue={query}
              locale={locale}
              variant="compact"
            />
            {/*
             * A LINK, not a button that clears the field. The reset has to work
             * with scripting off, and "back to an empty search" is a page this
             * portal already has.
             */}
            <p>
              <Link
                className="inline-flex min-h-11 items-center text-sm text-ink-link hover:text-ink-link-hover"
                href="/search"
              >
                {t('clear')}
              </Link>
            </p>
          </div>
        }
        lead={t('scope')}
        title={t('findService')}
        trail={[{ href: '/', label: tCommon('home') }, { label: t('title') }]}
      />

      <Container className="flex flex-col gap-8 py-10 lg:flex-row lg:items-start lg:gap-14 lg:py-14">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:w-60 lg:shrink-0">
          {facets.length > 0 && (
            <nav aria-label={t('narrowByCategory')}>
              <p className="border-b border-line-subtle pb-2 text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
                {t('narrowByCategory')}
              </p>
              <ul className="mt-2 flex flex-col" data-dense-list>
                <li>
                  {/* The current facet is not a link — a control that reloads
                      the page you are on is a control that does nothing. */}
                  {category === undefined ? (
                    <span
                      aria-current="true"
                      className={cn(RAIL_ITEM, RAIL_ITEM_CURRENT)}
                    >
                      {t('allResults')}
                      <span className="tabular-nums">{all.length}</span>
                    </span>
                  ) : (
                    <Link
                      className={cn(RAIL_ITEM, RAIL_ITEM_LINK)}
                      href={`/search/${encoded}`}
                    >
                      {t('allResults')}
                      <span className="tabular-nums text-ink-tertiary">
                        {all.length}
                      </span>
                    </Link>
                  )}
                </li>

                {facets.map(facet =>
                  facet.slug === category ? (
                    <li key={facet.slug}>
                      <span
                        aria-current="true"
                        className={cn(RAIL_ITEM, RAIL_ITEM_CURRENT)}
                      >
                        {facet.label}
                        <span className="tabular-nums">{facet.count}</span>
                      </span>
                    </li>
                  ) : (
                    <li key={facet.slug}>
                      <Link
                        className={cn(RAIL_ITEM, RAIL_ITEM_LINK)}
                        href={`/search/${encoded}/${facet.slug}`}
                      >
                        {facet.label}
                        <span className="tabular-nums text-ink-tertiary">
                          {facet.count}
                        </span>
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>
          )}

          {suggestions.length > 0 && (
            <nav aria-label={t('tryInstead')}>
              <p className="border-b border-line-subtle pb-2 text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
                {t('tryInstead')}
              </p>
              <ul className="mt-2 flex flex-col" data-dense-list>
                {suggestions.map(suggestion => (
                  <li key={suggestion}>
                    {/* Straight at the segment, skipping the handler — the
                        destination is known at build time. */}
                    <a
                      className={cn(RAIL_ITEM, RAIL_ITEM_LINK, 'text-ink-link')}
                      href={`/${locale}/search/${encodeURIComponent(suggestion)}`}
                    >
                      {suggestion}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {hits.length === 0 ? (
            <section
              aria-labelledby="no-results"
              className="flex flex-col gap-3"
            >
              <h2
                className="font-display text-feature font-bold text-ink"
                id="no-results"
              >
                {t('noResultsHeading', { query })}
              </h2>
              <p className="max-w-prose leading-relaxed text-ink-secondary">
                {t('noResultsBody')}
              </p>
              <div className="mt-1 flex flex-wrap gap-2.5">
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl bg-surface-band px-4.5 text-sm font-semibold text-ink-on-band hover:bg-surface-band-hover"
                  href="/services"
                >
                  {t('browseAll')}
                </Link>
                <a
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-control px-4.5 text-sm font-semibold text-ink hover:border-ink-link hover:text-ink-link"
                  href={lguConfig.officialSite.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('tryOfficialSite')}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                </a>
              </div>
            </section>
          ) : (
            <section aria-labelledby="results-heading">
              <h2 className="sr-only" id="results-heading">
                {t('resultsHeading', { count: hits.length, query })}
              </h2>
              <ul className="flex flex-col gap-3">
                {hits.map(hit => (
                  <li key={hit.href}>
                    <ServiceRow
                      description={hit.description}
                      href={hit.href}
                      meta={tServices(`categories.${hit.category}`)}
                      name={hit.name}
                      query={query}
                      variant="card"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Container>
    </>
  );
}
