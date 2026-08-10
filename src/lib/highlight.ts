/**
 * Splitting a result title into matched and unmatched runs, for `<mark>`.
 *
 * 🔴 **This returns DATA, not markup.** The obvious implementation wraps matches
 * in `<mark>` and hands the string to `dangerouslySetInnerHTML`, which would take
 * a query string straight out of a URL and inject it into the page. The query is
 * untrusted by definition, so this function never builds HTML at all — the
 * component maps the segments onto real elements and React escapes them.
 *
 * Folding matches `search.ts` exactly: NFD, strip diacritics, lowercase, so
 * "Niño" is found by "nino". The folded string is used ONLY to locate the runs;
 * every emitted segment is a slice of the ORIGINAL text, so the reader sees the
 * municipality's own spelling and casing rather than a normalised copy.
 *
 * ⚠️ The fold has to be length-preserving for the indices to be usable, and NFD
 * is not: "ñ" decomposes into two code points. Diacritics are therefore removed
 * per character rather than over the whole string, which keeps one input
 * character mapped to one output character.
 */

export type Segment = { text: string; matched: boolean };

/** One character, folded — and always exactly one character out. */
function foldChar(character: string): string {
  const stripped = character
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  // A character with no base letter (a lone combining mark) folds to nothing,
  // which would shift every index after it. Keep the original instead.
  return stripped.length === 0 ? character.toLowerCase() : stripped[0];
}

const fold = (value: string): string =>
  [...value].map(foldChar).join('').slice(0, value.length);

/**
 * The runs of `text` matching any term, merged and in order.
 *
 * Terms are matched independently and overlapping runs are merged, so
 * "birth certificate" marks both words in "Register a birth certificate"
 * without emitting two nested marks where they touch.
 */
export function highlight(text: string, query: string): Segment[] {
  const terms = [...new Set(fold(query).split(/\s+/).filter(Boolean))];
  if (terms.length === 0) return [{ text, matched: false }];

  const folded = fold(text);
  const ranges: [number, number][] = [];

  for (const term of terms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = folded.indexOf(term, from + 1);
    }
  }

  if (ranges.length === 0) return [{ text, matched: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), matched: false });
    }
    segments.push({ text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }

  return segments;
}
