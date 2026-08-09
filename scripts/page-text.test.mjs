import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { articleText, contentChecksum, hasArticle } from './page-text.mjs';

/**
 * Every fixture here is INVENTED. No real Tago page, service, office, fee or
 * person appears in this file — the same rule the charter parser's tests
 * follow. What is reproduced is the SHAPE of the real defect, not its content.
 */

const sha = value => createHash('sha256').update(value).digest('hex');

/** The real defect, reduced: a plugin stamps a fresh timestamp per response. */
const pageWithVolatileScript = stamp => `
  <html><head>
    <script src="//example.test/?wordfence_syncAttackData=${stamp}" async></script>
  </head><body>
    <article><h1>A heading</h1><p>Text the office published.</p></article>
  </body></html>`;

describe('the published text is what gets read', () => {
  it('reads the article and nothing around it', () => {
    const html = `<body><nav>Menu Home</nav>
      <article><p>The published sentence.</p></article>
      <footer>Copyright</footer></body>`;
    expect(articleText(html)).toBe('The published sentence.');
  });

  it('drops scripts and styles rather than reading them as text', () => {
    const html = `<article>
      <style>.a{color:red}</style><script>var x = 'not content';</script>
      <p>Only this.</p></article>`;
    expect(articleText(html)).toBe('Only this.');
  });

  it('decodes entities, so the same words hash the same way', () => {
    expect(articleText('<article><p>Fees &amp; charges</p></article>')).toBe(
      'Fees & charges'
    );
  });

  it('collapses whitespace, so a reflowed template is not a change', () => {
    const tight = '<article><p>One two</p></article>';
    const loose = '<article>\n\n  <p>One\n     two</p>\n\n</article>';
    expect(articleText(loose)).toBe(articleText(tight));
  });

  it('returns empty for a page with no article, and says which case that is', () => {
    // Several office pages genuinely carry no <article>. That is a finding
    // about the site, not a parse failure, and the two must stay separable.
    expect(articleText('<body><p>Loose text</p></body>')).toBe('');
    expect(hasArticle('<body><p>Loose text</p></body>')).toBe(false);
    expect(hasArticle('<article></article>')).toBe(true);
  });
});

describe('the checksum answers "did the municipality change what it published?"', () => {
  it('is identical across two fetches that differ only by the injected stamp', () => {
    // THE regression. A full-HTML hash of these two differs, which is how
    // seventeen office-page checksums changed while no page had moved.
    const first = pageWithVolatileScript('1786279124.203');
    const second = pageWithVolatileScript('1786279127.7408');

    expect(sha(first)).not.toBe(sha(second)); // the old behaviour
    expect(contentChecksum(first, sha)).toBe(contentChecksum(second, sha));
  });

  it('still changes when a published word changes', () => {
    // The other direction, and the one that makes it worth recording at all:
    // a checksum that never changes detects nothing.
    const before = '<article><p>Open Monday to Friday.</p></article>';
    const after = '<article><p>Open Tuesday to Friday.</p></article>';
    expect(contentChecksum(before, sha)).not.toBe(contentChecksum(after, sha));
  });

  it('changes when text is added, not only when it is edited', () => {
    const before = '<article><p>One service.</p></article>';
    const after = '<article><p>One service.</p><p>And another.</p></article>';
    expect(contentChecksum(before, sha)).not.toBe(contentChecksum(after, sha));
  });

  it('does not collapse two different empty pages into one another', () => {
    // Both hash the empty string — which is correct and worth pinning, because
    // it means "no article" and "empty article" are the same CONTENT claim.
    expect(contentChecksum('<body>x</body>', sha)).toBe(
      contentChecksum('<article>  </article>', sha)
    );
  });
});
