import { describe, expect, it } from 'vitest';
import { highlight } from './highlight';

const join = (text: string, query: string) =>
  highlight(text, query)
    .map(segment => (segment.matched ? `[${segment.text}]` : segment.text))
    .join('');

describe('highlight', () => {
  it('marks the matched run and leaves the rest alone', () => {
    expect(join('Get a medical certificate', 'certificate')).toBe(
      'Get a medical [certificate]'
    );
  });

  it('preserves the original casing inside the mark', () => {
    expect(join('Register a Birth', 'birth')).toBe('Register a [Birth]');
  });

  it('marks every term of a multi-word query, independently', () => {
    expect(join('Apply for a new business permit', 'business permit')).toBe(
      'Apply for a new [business] [permit]'
    );
  });

  it('merges runs that touch rather than nesting them', () => {
    const segments = highlight('birthcertificate', 'birth certificate');
    expect(segments).toEqual([{ text: 'birthcertificate', matched: true }]);
  });

  it('marks every occurrence, not only the first', () => {
    expect(join('permit and permit', 'permit')).toBe('[permit] and [permit]');
  });

  it('folds diacritics without shifting the slice', () => {
    // The whole reason the fold is per-character: NFD would turn "ñ" into two
    // code points and every index after it would be off by one.
    expect(join('Certificate for Niño Santos', 'nino')).toBe(
      'Certificate for [Niño] Santos'
    );
  });

  it('returns the text untouched when nothing matches', () => {
    expect(highlight('Register a birth', 'zoning')).toEqual([
      { text: 'Register a birth', matched: false },
    ]);
  });

  it('returns the text untouched for an empty or blank query', () => {
    for (const query of ['', '   ']) {
      expect(highlight('Register a birth', query)).toEqual([
        { text: 'Register a birth', matched: false },
      ]);
    }
  });

  it('never emits markup, whatever the query contains', () => {
    // 🔴 The negative case this module exists for. The query is a route segment
    // a stranger controls; if any of it reached the page as HTML rather than as
    // text, this is the test that would have said so.
    const query = '<script>alert(1)</script>';
    const segments = highlight(`Get a ${query} certificate`, query);
    expect(segments.map(segment => segment.text).join('')).toBe(
      `Get a ${query} certificate`
    );
    expect(segments.some(segment => segment.matched)).toBe(true);
  });

  it('reassembles into exactly the input, always', () => {
    const text = 'Correct a clerical error on a civil registry record';
    for (const query of ['a', 'record correct', 'clerical', 'xyz', 'e']) {
      expect(
        highlight(text, query)
          .map(segment => segment.text)
          .join('')
      ).toBe(text);
    }
  });
});
