/**
 * Reading a dynamic route param, given that Next hands it over at more than one
 * level of encoding.
 *
 * 🔴 **The same URL reaches a route as `business permit`, `business%20permit`
 * or `business%2520permit`, depending on how that particular response was
 * produced.** A dynamically rendered route gets it decoded; a prerendered one
 * gets the raw segment; and a partially-prerendered route RESUMED at request
 * time — which is every route here, because `cacheComponents` is on — re-derives
 * its params from the matched path and can hand over a segment that has been
 * encoded a second time.
 *
 * That third case is what shipped the bug this module is named for: a
 * prerendered popular query rendered its `<title>` from the build-time param
 * (correct) and its results from the resumed one (double-encoded), so the page
 * announced `Nothing here matches “business%20permit”` under a tab reading
 * `Results for “business permit”`. One document, two spellings of one query.
 *
 * So this decodes REPEATEDLY, until the string stops changing — the same
 * question `proxy.ts` asks one frame earlier, and the only form that is immune
 * to how many times something upstream encoded the segment.
 *
 * **A query can never legitimately contain a `%`**, which is what makes that
 * safe: `/api/search` strips the character before building the path, and a
 * hand-typed escape that survives is refused by `proxy.ts`. Every `%XX` left in
 * a segment is therefore an encoding artefact, never something a resident
 * typed.
 */
export function decodeParam(value: string): string {
  let current = value;

  // Bounded: three passes is far past anything a real URL needs, and an
  // unbounded loop on a hostile input is its own problem.
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      /*
       * Already decoded, and containing something that is not a valid escape —
       * a lone `%`, in practice. That is the value, not an error: returning it
       * unchanged is what stops a search for `100%` becoming a 500.
       *
       * A genuinely malformed URL never reaches here. `proxy.ts` refuses it
       * with a 400 before the router decodes anything.
       */
      return current;
    }
    if (decoded === current) break;
    current = decoded;
  }

  return current;
}
