import { NextResponse } from 'next/server';
import { recordVisit } from '@/lib/visits';

/**
 * Adds one to the visit count. `TAGO-116`.
 *
 * ## Why this is a Route Handler at all
 *
 * `docs/coding-standards.md` is strict about this — handlers exist "only for
 * what a Server Component genuinely can't do", and the one other handler in
 * this application earns its place by turning a query string into a path. This
 * one earns it differently: **every route in this portal is prerendered**, so
 * there is no server render at the moment a reader arrives. A write that has to
 * happen per visit has nowhere else to live.
 *
 * ## 🔒 What this handler does NOT read
 *
 * **The request's IP address, its user agent as an identifier, its cookies, or
 * anything derived from any of them.** There is no fingerprint here and no
 * `headers()` call to build one from. Deduplication is done by the browser
 * against a timestamp only it holds — see `VisitCount.tsx`.
 *
 * The one header it does read is `sec-fetch-site`, and it reads it as a
 * same-origin CHECK rather than as data about anyone: the value is discarded
 * immediately and is not capable of identifying a reader.
 *
 * That is what keeps `docs/governance.md` § *What we never ask for* — "No
 * personal information is collected, published, or required" — true as written,
 * structurally rather than by anyone remembering. **Do not add an IP read
 * here.** If more accurate deduplication is ever wanted, it is a governance
 * decision with a privacy policy attached, not a patch to this file.
 *
 * ## What it refuses, and what it cannot
 *
 * Declared crawlers are refused, because `robots.ts` invites every one of them
 * across ~380 sitemap URLs and counting that would drown the figure entirely.
 * A cross-origin request is refused, which stops the most casual inflation.
 *
 * Neither helps against an undeclared scraper or a headless browser sending an
 * ordinary user-agent string, and nothing here pretends otherwise — the footer
 * states plainly that the number is inflated by traffic nobody can identify.
 *
 * ## It always answers 204
 *
 * Success, refusal, and a store that did not respond are the same answer,
 * because the caller has nothing to do with any of them: the client leaf fires
 * this and forgets it. Distinguishing them in the response would only tell an
 * inflater which of its attempts landed.
 */

/**
 * Crawlers that identify themselves, matched case-insensitively.
 *
 * Deliberately a short list of the substrings that actually appear on this
 * portal rather than an exhaustive registry — a list nobody can maintain rots
 * into false confidence, and the surface's honesty about the remainder is what
 * carries the weight.
 */
const DECLARED_CRAWLERS =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|skypeuripreview|monitor|uptime|curl|wget|python-requests|headlesschrome/i;

const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  /*
   * Same-origin only. `sec-fetch-site` is set by the browser and cannot be
   * spoofed by page script, so this is a real boundary against a cross-site
   * inflater — and worthless against `curl`, which simply omits it. Absent is
   * therefore treated as NOT same-origin.
   */
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return NO_CONTENT;
  }

  /*
   * Read, tested, discarded. A user-agent string is not retained, not hashed,
   * not passed to the store, and not combined with anything — it never leaves
   * this function.
   */
  const agent = request.headers.get('user-agent') ?? '';
  if (agent === '' || DECLARED_CRAWLERS.test(agent)) {
    return NO_CONTENT;
  }

  await recordVisit();
  return NO_CONTENT;
}
