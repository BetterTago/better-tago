import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale negotiation.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the contract is unchanged,
 * so next-intl's `createMiddleware` is still the right factory. Do NOT add a
 * `middleware.ts` alongside this.
 *
 * It lives in `src/`, not the repo root: with a `src/` directory present, Next
 * only picks the file up from there. At the root it compiles to an empty
 * middleware manifest and `/` returns 404 instead of negotiating a locale.
 */
const negotiate = createMiddleware(routing);

/**
 * 🔴 A malformed percent-escape is refused HERE, before the router sees it.
 *
 * `/en/search/%E0%A4%A` is a truncated escape — a real thing that happens when a
 * URL is cut in half by a chat client or a print column. Next decodes a dynamic
 * route param itself, before any code in the route runs, and that decode throws
 * a `URIError` it does not catch: the response is a bare **500 Internal Server
 * Error**, with no body, nothing in the log, and `error.tsx` never reached.
 *
 * A `try/catch` inside the page cannot fix it — the throw happens upstream of
 * the page, which is why one was there and the 500 continued. The only place
 * ahead of the router is this proxy.
 *
 * ## Why it decodes REPEATEDLY rather than once
 *
 * Next does not decode a param once. `/en/search/100%25` decodes to `100%`,
 * which Next decodes again and throws on — so a single check here passes a URL
 * that still 500s two frames later. Measured, not assumed: `100%25`,
 * `100%2525`, `a%25b` and `50%25off` all reach `failed to decode param`.
 *
 * So this decodes until the string stops changing, and refuses anything that
 * throws on the way. That is the same question Next is asking, asked somewhere
 * it can be answered with a response instead of a stack trace.
 *
 * **400, not 404.** The request itself is malformed rather than pointing at
 * something that does not exist, and a civic site answering "not found" for a
 * URL that was never valid teaches a crawler to keep trying variants of it.
 *
 * ⚠️ Only paths this proxy matches are covered — `config.matcher` excludes
 * `api`, `_next` and anything with a file extension, so a malformed escape on
 * an asset path is still Next's own 500. Widening the matcher would run locale
 * negotiation over every static file to catch a URL nobody links to.
 */
export default function proxy(request: NextRequest) {
  try {
    let path = request.nextUrl.pathname;
    // Bounded: three passes is far past anything a real URL needs, and an
    // unbounded loop on a hostile input is its own problem.
    for (let pass = 0; pass < 3; pass += 1) {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    }
  } catch {
    return new NextResponse('Malformed URL', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return negotiate(request);
}

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
