import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

/**
 * The search form's endpoint. It exists to turn a query STRING into a query
 * PATH, and that is its whole job.
 *
 * ## Why this hop exists rather than reading `?q=` on the results page
 *
 * `cacheComponents` refuses to prerender a route that reads uncached data —
 * a search parameter — outside `<Suspense>`, and `export const dynamic` is
 * flatly incompatible with it. That leaves exactly one shape for request-time
 * data: a route SEGMENT.
 *
 * The Suspense alternative was built first and rejected on evidence. It
 * compiled, prerendered, and passed every test that ran JavaScript — and it was
 * broken for the readers this route exists for. React streams a resolved
 * boundary as a `hidden` div plus an inline script that moves it into place, so
 * with scripting off the results sat in the HTML, invisible, under a permanent
 * "Searching…". Confirmed by fetching the page and reading the bytes.
 *
 * A browser submits this form and follows this redirect with no JavaScript at
 * all, which is what `TAGO-110` actually asks for.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();

  /*
   * The locale rides along in a hidden field. It is validated against the
   * routing table rather than trusted: this value reaches a redirect target,
   * and an unvalidated one is an open redirect.
   */
  const submitted = url.searchParams.get('locale') ?? '';
  const locale = routing.locales.includes(
    submitted as (typeof routing.locales)[number]
  )
    ? submitted
    : routing.defaultLocale;

  // An empty search goes back to the form rather than to an empty results page
  // for a query nobody typed.
  if (query === '') {
    return NextResponse.redirect(new URL(`/${locale}/search`, url));
  }

  /*
   * `encodeURIComponent` twice over, in effect: once here, and `NextResponse`
   * leaves the encoded segment alone. A query containing `/` or `?` would
   * otherwise redirect somewhere else entirely, which is a routing bug and, with
   * a crafted string, worse than one.
   */
  return NextResponse.redirect(
    new URL(`/${locale}/search/${encodeURIComponent(query)}`, url)
  );
}
