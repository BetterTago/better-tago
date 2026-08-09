/**
 * The published text of an HTML page, and a checksum over it.
 *
 * Separated from `harvest.mjs` for the same reason `charter-parse.mjs` is:
 * that module runs a harvest on import, so nothing inside it can be tested.
 * This is the part worth testing.
 *
 * ⚠️ **Why the raw HTML is not what gets checksummed.**
 *
 * A checksum exists here to answer one question — *did the municipality change
 * what it published?* Hashing the delivered HTML answers a different one, and
 * on this site it answers it wrongly every time: a security plugin injects
 *
 *     <script src="//tago.gov.ph/?wordfence_syncAttackData=1786279124.203">
 *
 * with a fresh Unix timestamp into **every response**. So two fetches a second
 * apart differ, and a full-HTML hash reports "this page changed" on every run,
 * forever. An alarm that always fires is worse than no alarm: it trains
 * everyone to ignore the one time it means something.
 *
 * This was not hypothetical. `office-pages.yaml` recorded a full-HTML `sha256`
 * from Wave 3 until 2026-08-09, and all seventeen of them changed on the next
 * harvest while every `bodyChars` stayed identical — the pages had not moved
 * at all. Found by re-running the harvest and reading the diff.
 *
 * The charter PDFs are unaffected and still hash their bytes: they are static
 * files, and their checksums have held across three harvests.
 */

/** Elements whose contents are never the municipality's published words. */
const NON_CONTENT = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
  '&ndash;': '–',
  '&mdash;': '—',
};

const decode = value =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(
      /&[a-z]+;|&#\d+;/gi,
      entity => ENTITIES[entity.toLowerCase()] ?? entity
    );

/**
 * The visible text inside a page's `<article>`, normalised.
 *
 * Returns `''` when the page has no `<article>` — which is a real answer for
 * this site (several office pages carry none) and must not be confused with a
 * page whose article is empty. Callers that care about the difference should
 * check `hasArticle`.
 */
export function articleText(html) {
  const withoutCode = String(html).replace(NON_CONTENT, '');
  const article = withoutCode.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!article) return '';
  return decode(article[1].replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export const hasArticle = html => /<article\b/i.test(String(html));

/**
 * A checksum over what the page SAYS, stable across fetches.
 *
 * Takes the hashing function rather than importing `node:crypto`, so this
 * module stays pure and the test does not need to assert against a real
 * digest to prove the normalisation works.
 */
export const contentChecksum = (html, hash) => hash(articleText(html));
