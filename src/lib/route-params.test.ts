import { describe, expect, it } from 'vitest';
import { decodeParam } from './route-params';

/**
 * The two shapes a dynamic route param actually arrives in, and the two
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
});
