import { describe, expect, it } from 'vitest';
import { fold } from './search';

/**
 * What the search is allowed to throw away before it matches.
 *
 * Only two things: letter case, and the combining marks NFD produced. Anything
 * else a resident typed is part of the query, and deleting it silently is how a
 * search comes back with results for a string nobody asked for.
 */
describe('fold', () => {
  it('folds case and accents, which is the whole reason it exists', () => {
    // A resident typing without the ñ key still has to find the barangay.
    expect(fold('Bañaybañay')).toBe('banaybanay');
    expect(fold('Niño')).toBe('nino');
    expect(fold('SEÑOR')).toBe('senor');
    expect(fold('Café')).toBe('cafe');
    // Both spellings of the same letter — precomposed, and 'n' plus a
    // combining tilde — fold to the same thing, which is what makes a
    // pasted name match a typed one.
    expect(fold('ñ')).toBe('n');
    expect(fold('ñ')).toBe('n');
  });

  it('🔴 keeps punctuation the Unicode Diacritic property would have eaten', () => {
    /*
     * `\p{Diacritic}` covers standalone spacing characters, not just the marks
     * NFD leaves behind: `^`, `` ` ``, `¨`, `¯`, `´` and `¸` are all
     * `Diacritic=Yes`.
     *
     * Deleting them turned a search for `a^b` into a search for `ab`, which
     * returned six unrelated services under a heading quoting `a^b` back at the
     * reader. Wrong results are worse than none here: the heading made them look
     * like answers.
     */
    for (const character of ['^', '`', '¨', '¯', '´', '¸']) {
      expect(fold(`a${character}b`), character).toBe(`a${character}b`);
    }
  });

  it('🔴 changes nothing but case in any ASCII a keyboard can produce', () => {
    /*
     * The sweep rather than the six characters that happened to break. Every
     * printable ASCII symbol is either part of the query or it is not, and none
     * of them is an accent.
     */
    const printable = Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) =>
      String.fromCharCode(0x20 + index)
    );

    for (const character of printable) {
      expect(fold(character), JSON.stringify(character)).toBe(
        character.toLowerCase()
      );
      expect(fold(`a${character}b`), JSON.stringify(character)).toBe(
        `a${character}b`.toLowerCase()
      );
    }
  });

  it('leaves non-Latin scripts and emoji intact rather than emptying them', () => {
    // Nothing in the charter is written in these, so they find nothing — but
    // they have to find nothing as themselves, not as an empty query that
    // matches everything.
    for (const value of ['日本', 'ᜆᜄᜓ', '👍', 'Кирилл']) {
      expect(fold(value), value).not.toBe('');
    }
  });
});
