/**
 * Reading a dynamic route param, given that Next hands it over two different
 * ways.
 *
 * 🔴 **A PRERENDERED route receives the raw path segment; a dynamically
 * rendered one receives it decoded.** `/en/search/business%20permit` is
 * `business%20permit` when it comes off the prerendered set that
 * `generateStaticParams` produced, and `business permit` when the same URL is
 * rendered on demand. Both were observed in a production build, on the same
 * route, in the same run.
 *
 * That inconsistency is why a plain `decodeURIComponent` was wrong in both
 * directions:
 *
 * · omitted, the prerendered pages searched for the literal string
 *   `business%20permit` and found nothing — the three most-used queries in the
 *   portal returning "nothing here matches";
 * · applied unconditionally, the dynamic ones DOUBLE-decoded, so a query a
 *   resident can genuinely type — `100%` — threw a `URIError` that surfaced as
 *   an Internal Server Error.
 *
 * Decoding only when it succeeds satisfies both: an already-decoded value that
 * cannot be decoded again is returned untouched, and a raw segment is decoded
 * once.
 */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    /*
     * Already decoded, and containing something that is not a valid escape —
     * a lone `%`, in practice. That is the value, not an error: returning it
     * unchanged is what stops a search for `100%` becoming a 500.
     *
     * A genuinely malformed URL never reaches here. `proxy.ts` refuses it with
     * a 400 before the router decodes anything.
     */
    return value;
  }
}
