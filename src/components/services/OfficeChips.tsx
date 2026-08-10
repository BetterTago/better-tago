import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Narrowing a category by the office that provides each service.
 *
 * ## Why these are links to a route, and not a `?office=` parameter
 *
 * TAGO-204 wants filter state in the URL **and** the index working with
 * JavaScript disabled. Under `cacheComponents` a prerendered route may not read
 * a search parameter outside `<Suspense>`, and a Suspense boundary streams as a
 * hidden `div` plus a script that moves it into place — with scripting off the
 * rows are in the HTML and invisible. That version was already built, measured
 * and rejected on the search route.
 *
 * A route segment has none of those problems: `/services/office/<slug>` is known
 * at render start, prerenders, shares as a plain URL, and needs no client
 * JavaScript at all. The filtered view is a page, which is what a shareable
 * filter actually is.
 *
 * ## Why office chips and not the design's task chips
 *
 * The sheet draws *Register a record · Get a copy · Correct a record*. No such
 * grouping exists in the data and inventing one would be a claim about the
 * charter this project cannot source. Office is the axis the records actually
 * carry, and it is the one TAGO-204 names.
 *
 * Rendered only where a category has more than one office — five of the eleven
 * have exactly one, and a lone chip beside "All 14" filters nothing.
 */
export async function OfficeChips({
  total,
  offices,
}: {
  total: number;
  offices: { name: string; slug: string; count: number }[];
}) {
  const t = await getTranslations('services');
  if (offices.length < 2) return null;

  return (
    <nav aria-label={t('filterByOffice')}>
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <span
            aria-current="true"
            className="inline-flex min-h-11 items-center rounded-full bg-surface-band px-4 text-sm font-semibold text-ink-on-band"
          >
            {t('allInCategory', { count: total })}
          </span>
        </li>
        {offices.map(office => (
          <li key={office.slug}>
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-raised px-4 text-sm text-ink-secondary hover:border-ink-link hover:text-ink-link"
              href={`/services/office/${office.slug}`}
            >
              {office.name}
              <span className="tabular-nums text-ink-tertiary">
                {office.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
