import { ArrowRight, Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/**
 * The three tasks a resident most often arrives with — and every one of them
 * returns real results.
 *
 * 🔴 **Checked against the manifests, not chosen for how they look.** A chip
 * that leads to an empty results page is worse than no chip: it teaches a
 * reader that the search does not work. As of 2026-08-10 these return 6, 2 and
 * 1 service respectively, and `search.spec.ts` holds them to returning
 * something.
 *
 * They are also the three queries `/[locale]/search/[query]` prerenders, so the
 * commonest journey into this portal is served from a static file.
 */
const POPULAR_QUERIES = ['business permit', 'birth certificate', 'indigency'];

/**
 * The "Find a service" card — one component for the hero and both search pages.
 *
 * ## Why a form and not a combobox
 *
 * The reference design's version was an input beside a `<div>` of links that
 * appeared on keystroke — no `aria-expanded`, no listbox role, no arrow keys,
 * no Escape, no announcement. **Half a combobox is worse than none**: it looks
 * operable to a sighted mouse user and is inert to everyone else.
 *
 * A GET form works with JavaScript disabled, gives the result a shareable URL,
 * ships no search index to the browser, and needs no client component at all.
 * There is no `onSubmit` and no state here.
 *
 * ## Why it posts to `/api/search`
 *
 * The query has to reach a route SEGMENT, because `cacheComponents` will not
 * let a prerendered route read a search parameter outside `<Suspense>` — and a
 * Suspense boundary puts the results behind JavaScript. A form cannot put a
 * value into a path, so the handler turns `?q=` into `/search/<query>` and
 * redirects. A browser follows that with no scripting at all.
 *
 * The chips skip the hop entirely: their destination is known at build time, so
 * they link straight at the segment.
 */
export async function SearchForm({
  locale,
  variant = 'card',
  defaultValue,
}: {
  locale: string;
  variant?: 'card' | 'compact';
  defaultValue?: string;
}) {
  const t = await getTranslations('search');
  const inputId = `search-${variant}`;
  const card = variant === 'card';

  const field = (
    <div className="flex items-center gap-2 rounded-xl border border-line-control bg-surface-sunken py-1.5 ps-4 pe-1.5 focus-within:border-ink-link">
      <input
        id={inputId}
        name="q"
        type="search"
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={t('placeholder')}
        // `min-w-0` is load-bearing: a flex-child <input> keeps an intrinsic
        // min-width from its default `size` and will not shrink, which is the
        // likeliest single source of horizontal scroll at 320px.
        className="min-h-11 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
      />
      <button
        type="submit"
        className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-link text-surface-page hover:bg-ink-link-hover"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        <span className="sr-only">{t('submit')}</span>
      </button>
    </div>
  );

  const form = (
    <form action="/api/search" method="get" role="search">
      {/* Validated against the routing table by the handler before it reaches a
          redirect target — an unvalidated one would be an open redirect. */}
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={inputId} className="sr-only">
        {t('label')}
      </label>
      {field}
    </form>
  );

  if (!card) return form;

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-panel sm:p-7">
      <div className="mb-2 flex items-center gap-2.5">
        <Search aria-hidden="true" className="size-5 shrink-0 text-ink-link" />
        <h2 className="font-display text-xl font-bold tracking-tight">
          {t('findService')}
        </h2>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-ink-tertiary">
        {t('findServiceHelp')}
      </p>

      {form}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-tertiary">{t('popular')}</span>
        {POPULAR_QUERIES.map(query => (
          // Links, not buttons that fill the input — the reader's intent is
          // "take me there", and a chip that only types for them costs two
          // extra steps.
          //
          // Straight at the route segment, skipping the handler: the
          // destination is known here, so there is no reason to make a reader
          // pay for a redirect.
          //
          // NOTE these are ~28px tall, below the 44px touch floor — a listed,
          // reviewed exemption in e2e/home.a11y.spec.ts, not an omission.
          <a
            key={query}
            href={`/${locale}/search/${encodeURIComponent(query)}`}
            className="inline-flex min-h-7 items-center rounded-full border border-line bg-surface-tint px-3.5 text-sm font-medium text-ink-link hover:border-ink-link hover:bg-ink-link hover:text-surface-page"
          >
            {query}
          </a>
        ))}
      </div>
    </div>
  );
}
