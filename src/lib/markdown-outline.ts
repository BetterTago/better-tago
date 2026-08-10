/**
 * The `##` headings of a rendered body, for the "On this page" rail.
 *
 * ## Why the rail is derived and not declared
 *
 * A service body is GENERATED from the charter, and the sections it carries
 * depend on what the document actually said — a page whose extraction found no
 * ambiguity has no ambiguity heading. A hardcoded list of four headings would
 * therefore be right on most pages and quietly wrong on the rest, pointing a
 * reader at an anchor that is not there.
 *
 * Deriving it means the rail is empty rather than broken when a body has no
 * headings, which is the correct failure: the rail is a shortcut to content that
 * is already on the page, never the only route to any of it.
 *
 * ## Why a line scan and not a markdown parse
 *
 * The renderer is `react-markdown`, which runs in the same request. Parsing the
 * body twice — once to find headings and once to render — would need the two
 * passes to agree about slugs forever. A line scan that produces the ids, paired
 * with the renderer calling `slugify` on the same text, keeps one function
 * responsible for the answer.
 *
 * 🔴 Fenced code is skipped. A charter body has no code fences today, but a `##`
 * inside one is not a heading, and a rail item scrolling to nothing is exactly
 * the kind of defect that survives review because it looks fine on every page
 * somebody checked.
 */

export type Heading = { id: string; text: string };

/**
 * A heading's anchor id.
 *
 * Deliberately narrow: lowercase, alphanumerics and hyphens. Charter headings
 * carry apostrophes and en dashes, and a URL fragment containing a curly
 * apostrophe is technically legal and practically unshareable — it survives the
 * address bar and does not survive being pasted into a message.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A slugger with memory, so the rail and the renderer cannot disagree.
 *
 * 🔴 Both sides of an anchor have to produce the same id, including for two
 * headings with the same words. Two implementations of that rule would agree
 * until the first duplicated heading and then send the rail to the wrong
 * section — so there is one implementation, called from both.
 *
 * Returns `null` for text that slugifies to nothing, which the caller renders
 * without an id rather than with an empty one.
 */
export function createSlugger(): (text: string) => string | null {
  const seen = new Map<string, number>();

  return text => {
    const base = slugify(text);
    if (!base) return null;

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

export function markdownOutline(body: string): Heading[] {
  const headings: Heading[] = [];
  const slug = createSlugger();
  let fenced = false;

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    // Strip the inline emphasis and link syntax a heading may carry, so the rail
    // reads as words rather than as markdown.
    const text = match[1]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim();
    if (!text) continue;

    /*
     * Two headings with the same words get distinct ids. Without that, both
     * rail items scroll to the first one — and the reader has no way to reach
     * the second section at all.
     */
    const id = slug(text);
    if (id === null) continue;

    headings.push({ id, text });
  }

  return headings;
}
