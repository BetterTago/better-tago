import { getCharterSections } from '@/lib/content';

/**
 * Server-side search over the content manifests.
 *
 * 🔴 **This runs on the server and returns real HTML.** `TAGO-110` requires
 * results without client-side JavaScript, and that is not a progressive
 * enhancement here — it is the primary mechanism. Nothing about this module
 * reaches the browser: no index is shipped, no fetch is made, and the result
 * page is an ordinary server-rendered document with a shareable URL.
 *
 * The alternative — shipping a JSON index and filtering it in a client
 * component — would send the whole service catalogue to every visitor on a
 * connection this portal is explicitly built to respect, in order to reproduce
 * something the server can do for free.
 */

export type SearchHit = {
  /** Locale-relative, without the locale prefix — `Link` adds that. */
  href: string;
  name: string;
  description: string;
  category: string;
};

/** Fold case and strip diacritics, so "Niño" matches "nino". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Every term in the query has to appear somewhere in the record.
 *
 * AND rather than OR, deliberately: "business permit" should not return every
 * page containing the word "business". A resident searching two words is
 * narrowing, not widening.
 */
function matches(haystack: string, terms: string[]): boolean {
  const folded = fold(haystack);
  return terms.every(term => folded.includes(term));
}

/**
 * Search every service the charter describes, by title, description and
 * category.
 *
 * Ranked only by whether the TITLE matched — a title hit is what the reader
 * meant far more often than a description hit, and anything more elaborate
 * would be a relevance model this portal has no data to tune.
 */
export async function searchServices(query: string): Promise<SearchHit[]> {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const sections = await getCharterSections();

  const hits = sections.flatMap(section =>
    section.pages
      .filter(page =>
        matches(`${page.name} ${page.description} ${section.category}`, terms)
      )
      .map(page => ({
        href: `/services/${section.category}/${page.slug}`,
        name: page.name,
        description: page.description,
        category: section.category,
        titleHit: matches(page.name, terms),
      }))
  );

  return hits
    .sort((a, b) => Number(b.titleHit) - Number(a.titleHit))
    .map(hit => ({
      href: hit.href,
      name: hit.name,
      description: hit.description,
      category: hit.category,
    }));
}
