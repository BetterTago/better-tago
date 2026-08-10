import { describe, expect, it } from 'vitest';
import { decodeParam } from './route-params';

/**
 * The shapes a dynamic route param actually arrives in, and the three
 * production failures that came of assuming only one of them.
 */
describe('decodeParam', () => {
  it('decodes the raw segment a PRERENDERED route receives', () => {
    // Without this, the three most-used queries in the portal searched for the
    // literal string `business%20permit` and returned "nothing here matches".
    expect(decodeParam('business%20permit')).toBe('business permit');
    expect(decodeParam('birth%20certificate')).toBe('birth certificate');
  });

  it('leaves alone the decoded value a DYNAMIC route receives', () => {
    expect(decodeParam('business permit')).toBe('business permit');
    expect(decodeParam('certificate')).toBe('certificate');
  });

  it('🔴 decodes the DOUBLE-encoded segment a resumed PPR route receives', () => {
    /*
     * The `%20` bug as it reached production. `generateStaticParams` pre-encoded
     * its values, so the param recorded against the prerendered path was already
     * escaped; the partially-prerendered route resumed at request time then
     * escaped it a second time. The page rendered its `<title>` from the
     * build-time param and its results from the resumed one, and announced
     * `Nothing here matches “business%20permit”` under a tab reading
     * `Results for “business permit”`.
     *
     * The pre-encoding is gone. Decoding until the string stops changing is
     * what makes this route immune to it coming back — from a Next upgrade, a
     * platform's own routing layer, or a link somebody escaped twice by hand.
     */
    expect(decodeParam('business%2520permit')).toBe('business permit');
    expect(decodeParam('birth%2520certificate')).toBe('birth certificate');
    expect(decodeParam('se%25C3%25B1or')).toBe('señor');
    // And three deep, which is as far as it looks.
    expect(decodeParam('business%252520permit')).toBe('business permit');
  });

  it('is idempotent — decoding an already-decoded value changes nothing', () => {
    /*
     * The property the route actually depends on: the page must not care which
     * encoding depth it was handed, so every form of one query has to land on
     * the same string.
     */
    for (const value of [
      'business permit',
      'business%20permit',
      'business%2520permit',
    ]) {
      expect(decodeParam(value)).toBe('business permit');
      expect(decodeParam(decodeParam(value))).toBe('business permit');
    }
  });

  it('🔴 returns a lone percent sign rather than throwing', () => {
    /*
     * The 500 this exists to prevent. `100%` is a query a resident can type;
     * an unconditional `decodeURIComponent` throws a `URIError` on it, and on
     * a route that surfaced as an Internal Server Error from the search box.
     */
    for (const value of ['100%', '50%off', 'a%b', '%']) {
      expect(() => decodeParam(value)).not.toThrow();
      expect(decodeParam(value)).toBe(value);
    }
  });

  it('never throws, whatever it is handed', () => {
    for (const value of ['%E0%A4%A', '%%%', '', 'ñ', '%C3%B1']) {
      expect(() => decodeParam(value)).not.toThrow();
    }
    // And a well-formed escape still decodes.
    expect(decodeParam('%C3%B1')).toBe('ñ');
  });

  it('🔴 round-trips every symbol a keyboard can produce', () => {
    /*
     * The sweep, rather than the handful of characters somebody happened to
     * think of. This is the exact trip a query makes: `/api/search` drops `%`
     * and trims, `NextResponse.redirect` receives an `encodeURIComponent`'d
     * segment, and the page reads it back through here. Whatever a resident
     * typed has to survive it unchanged.
     *
     * `%` is the one character that cannot, and it is dropped at the handler
     * rather than escaped — see `src/app/api/search/route.ts`. Every ASCII
     * printable except `%` is here, plus the non-ASCII this portal actually
     * sees.
     */
    const printable = Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) =>
      String.fromCharCode(0x20 + index)
    ).filter(character => character !== '%' && character !== ' ');

    const queries = [
      ...printable.map(character => `a${character}b`),
      ...printable,
      'business permit',
      'señor',
      'Bañaybañay',
      'niño',
      '日本',
      'ñ',
      'é', // 'e' + a combining acute, so NFD input survives too
      '👍',
      'a b  c',
    ];

    for (const query of queries) {
      const segment = encodeURIComponent(query);
      expect(decodeParam(segment), query).toBe(query);
      // And the segment a platform escaped a second time lands in the same
      // place, which is the whole point of decoding until it settles.
      expect(decodeParam(encodeURIComponent(segment)), query).toBe(query);
    }
  });
});
