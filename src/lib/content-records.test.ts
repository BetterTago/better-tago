import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { manifestSchema } from './content-schema';
import {
  REPO_ROOT as ROOT,
  filesMatching,
  matchesIn as hits,
  type ScannedFile as Doc,
} from './file-scan';

/**
 * The published record, checked against the rules it is written under.
 *
 * `content.ts` imports `next/cache` and so cannot be unit-tested; these read
 * the tree directly, which is the point — a contributor adding a page touches
 * markdown and YAML and never runs the application, so the checks that keep
 * them honest have to work on the files.
 *
 * Every negative here has a specific failure behind it. None of them is a
 * style rule.
 */

const CONTENT = path.join(ROOT, 'content');

const MANIFESTS = filesMatching(CONTENT, /^index\.yaml$/);
const PAGES = filesMatching(CONTENT, /\.md$/).filter(
  doc => !doc.path.endsWith('README.md')
);

describe('the content scan itself', () => {
  it('is actually reading the tree', () => {
    // A walker that silently returns nothing turns every check below into a
    // green no-op, which is worse than no check because it looks tended.
    expect(MANIFESTS.length).toBeGreaterThanOrEqual(5);
    expect(PAGES.length).toBeGreaterThanOrEqual(20);
  });
});

describe('every manifest is valid and matches the tree', () => {
  it('parses against the frozen contract', () => {
    for (const manifest of MANIFESTS) {
      const parsed = manifestSchema.safeParse(yaml.load(manifest.text));
      expect(parsed.success, `${manifest.path}: ${parsed.error}`).toBe(true);
    }
  });

  it('lists no slug without a markdown file behind it', () => {
    /*
     * The one failure that looks like nothing is wrong: the file sits there,
     * correct, and the page 404s. The loader throws on it at request time —
     * which is too late if no route has been built to request it yet.
     */
    const missing: string[] = [];
    for (const manifest of MANIFESTS) {
      const dir = path.dirname(path.join(ROOT, manifest.path));
      const parsed = manifestSchema.parse(yaml.load(manifest.text));
      for (const page of parsed.pages) {
        if (!existsSync(path.join(dir, `${page.slug}.md`))) {
          missing.push(`${manifest.path} → ${page.slug}.md`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('leaves no markdown file out of its manifest', () => {
    // The reverse, and the one that produces an orphan: a page nobody can
    // reach and nobody knows is unreachable.
    const orphans: string[] = [];
    for (const manifest of MANIFESTS) {
      const dir = path.dirname(manifest.path);
      const slugs = new Set(
        manifestSchema.parse(yaml.load(manifest.text)).pages.map(p => p.slug)
      );
      for (const page of PAGES.filter(p => path.dirname(p.path) === dir)) {
        const slug = path.basename(page.path).replace(/\.(fil\.)?md$/, '');
        if (!slugs.has(slug)) orphans.push(page.path);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('cites a source and a check date on every entry', () => {
    // Guaranteed by the schema, asserted anyway: this is the rule the whole
    // content contract exists for, and "the schema covers it" is how a
    // loosened schema goes unnoticed.
    for (const manifest of MANIFESTS) {
      for (const page of manifestSchema.parse(yaml.load(manifest.text)).pages) {
        expect(page.source.retrievedAt, page.slug).toMatch(
          /^\d{4}-\d{2}-\d{2}$/
        );
        expect(page.lastCheckedAt, page.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

describe('no page links to a file instead of a page', () => {
  /*
   * A cross-reference written as `[text](../other/page.md)` is a filesystem
   * path, and the renderer emits it verbatim. The browser then asks for
   * `…/page.md`, which is not a route and never will be — the route is
   * `/<locale>/<section>/<category>/<slug>`.
   *
   * It is invisible until a route exists to render it, which is exactly how it
   * would have shipped: six of these were written here and caught in review,
   * not by anything.
   *
   * A relative link is not made safe by being correct on disk. Until the route
   * map is frozen, a cross-reference names the other page in prose rather than
   * guessing at its URL.
   */
  const MARKDOWN_FILE_LINK = /\]\([^)]*\.md(?:#[^)]*)?\)/;

  it('links no .md file from a published page', () => {
    expect(hits(PAGES, MARKDOWN_FILE_LINK)).toEqual([]);
  });

  it('fires on a doctored cross-reference', () => {
    expect(
      hits(
        [
          {
            path: 'fixture',
            text: 'See [the other page](../advisories/where-advisories-are-posted.md).',
          },
        ],
        MARKDOWN_FILE_LINK
      )
    ).toHaveLength(1);
  });

  it('does not fire on an external link or an anchor', () => {
    expect(
      hits(
        [
          {
            path: 'fixture',
            text: 'See [the charter](https://tago.gov.ph/x.pdf) and [below](#fees).',
          },
        ],
        MARKDOWN_FILE_LINK
      )
    ).toEqual([]);
  });
});

describe('the transcription stayed out of scope', () => {
  /*
   * This project publishes THAT a service exists, which office provides it,
   * and a link to the official document. It does not republish the document's
   * contents — that is a permission nobody has asked for.
   *
   * The risk is not somebody deciding to transcribe the charter. It is
   * somebody helpfully adding "the fee is ₱50" to one page because they had
   * the PDF open, and nobody noticing for a year.
   */
  const FEE_SHAPED =
    /₱\s?[\d,]+|\bPHP\s?[\d,]+|\bPhp\s?[\d,]+|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/;

  it('publishes no fee anywhere in the content tree', () => {
    expect(hits(PAGES, FEE_SHAPED)).toEqual([]);
  });

  it('fires on a doctored page', () => {
    expect(
      hits(
        [{ path: 'fixture', text: 'The fee is ₱50 for the first copy.' }],
        FEE_SHAPED
      )
    ).toHaveLength(1);
    expect(
      hits(
        [{ path: 'fixture', text: 'Pay PHP 130 at the treasury.' }],
        FEE_SHAPED
      )
    ).toHaveLength(1);
    expect(
      hits([{ path: 'fixture', text: 'Total: 1,250.00' }], FEE_SHAPED)
    ).toHaveLength(1);
  });

  it('does not fire on a date, a count, or a cadence', () => {
    // The reason this is phrase-shaped rather than digit-shaped. A check that
    // fails on "22 documents" gets deleted the first week.
    expect(
      hits(
        [
          {
            path: 'fixture',
            text: 'Checked on 9 August 2026 across 22 documents, re-checked every 90 days.',
          },
        ],
        FEE_SHAPED
      )
    ).toEqual([]);
  });
});

describe('no borrowed phone number', () => {
  /*
   * The emergency layer's failure mode, and the one that looks complete and is
   * false: a number lifted from a neighbouring municipality's directory, or a
   * provincial office's number presented as Tago's. A resident dials it in an
   * emergency and loses the time they did not have.
   *
   * So the rule is not "numbers must be correct" — nothing can check that. It
   * is that a number may not APPEAR without having been recorded through the
   * emergency block, which forces a source and a check date on it.
   */
  const PHONE_SHAPED =
    /\b(?:\+63|0)\d{2}[-\s]?\d{3}[-\s]?\d{4}\b|\b\d{3}-\d{3}-\d{4}\b|\(\d{2,4}\)\s?\d{3}[-\s]?\d{4}/;

  /** The only two numbers this project publishes, and why each is allowed. */
  const PERMITTED = [
    // The national emergency hotline. Three digits, so it never matches the
    // patterns above — listed for the reader, not for the check.
    '911',
    // The municipal hall's landline, published by the municipality on its own
    // contact page and recorded as published-unverified until somebody rings it.
    '086-214-2116',
  ];

  it('carries no phone number in the content tree', () => {
    const found = hits(PAGES, PHONE_SHAPED).filter(
      hit => !PERMITTED.some(number => hit.endsWith(number))
    );
    expect(found).toEqual([]);
  });

  it('carries no phone number in the config beyond the two permitted', () => {
    const config = readFileSync(
      path.join(ROOT, 'config', 'lgu.config.json'),
      'utf8'
    );
    const found = hits([{ path: 'config', text: config }], PHONE_SHAPED).filter(
      hit => !PERMITTED.some(number => hit.endsWith(number))
    );
    expect(found).toEqual([]);
  });

  it('fires on a borrowed number', () => {
    expect(
      hits(
        [{ path: 'fixture', text: 'MDRRMO hotline: 086-555-1234' }],
        PHONE_SHAPED
      )
    ).toHaveLength(1);
  });
});

describe('the postal code stays unpublished', () => {
  /*
   * The official contact page publishes 1101, which sits outside the range
   * used for this province. Publishing it would propagate an error onto a
   * second site; "correcting" it would invent one. So it is HELD — obtained,
   * deliberately not published — and this is what keeps it that way.
   *
   * Bare `1101` is searched for rather than a labelled one, because the way
   * this leaks is somebody writing the hall's address in full.
   */
  it('appears nowhere a reader could see it', () => {
    const surfaces: Doc[] = [
      ...PAGES,
      ...['en', 'fil'].map(locale => ({
        path: `messages/${locale}.json`,
        text: readFileSync(
          path.join(ROOT, 'messages', `${locale}.json`),
          'utf8'
        ),
      })),
    ];

    // The register entry has to be able to SAY the value, or it cannot explain
    // what is being held or why. That one string is the exception, and it
    // lives in the config rather than on any page.
    expect(hits(surfaces, /\b1101\b/)).toEqual([]);
  });

  it('is still null in the config, and still registered as held', () => {
    const config = JSON.parse(
      readFileSync(path.join(ROOT, 'config', 'lgu.config.json'), 'utf8')
    );
    expect(config.lgu.postalCode).toBeNull();
    expect(config.pending['lgu.postalCode'].state).toBe('held');
  });
});

describe('the office directory is complete', () => {
  it('has a record for every office the charter names', () => {
    /*
     * 21 canonical offices, from 49 spellings across 22 charter documents. A
     * directory missing one is a resident who cannot find the counter they
     * need, and the count is derived from the frozen vocabulary rather than
     * written down here so the two cannot drift.
     */
    const vocab = yaml.load(
      readFileSync(path.join(ROOT, 'inventory', 'task-vocabulary.yaml'), 'utf8')
    ) as { offices: { canonical: string }[] };

    const expected = new Set(vocab.offices.map(office => office.canonical));
    const manifest = MANIFESTS.find(
      doc => doc.path === 'content/government/offices/index.yaml'
    );
    expect(manifest, 'the office directory manifest').toBeDefined();

    const recorded = new Set(
      manifestSchema
        .parse(yaml.load(manifest!.text))
        .pages.map(page => page.name)
    );

    expect([...expected].filter(office => !recorded.has(office))).toEqual([]);
    expect(recorded.size).toBe(expected.size);
  });

  it('states office hours on every record, never leaving them blank', () => {
    // Office hours are the highest-value missing field in the project, and
    // this is the settled fallback for them. A blank cell reads as "no hours";
    // a dated "not stated" reads as what it is.
    const offices = PAGES.filter(page =>
      page.path.startsWith('content/government/offices/')
    );
    expect(offices.length).toBe(21);

    const silent = offices
      .filter(page => !/##\s*Office hours/.test(page.text))
      .map(page => page.path);
    expect(silent).toEqual([]);
  });
});

describe('the emergency layer is complete in Filipino', () => {
  it('has a Filipino version of every emergency page', () => {
    /*
     * The one section required to reach 100% before any other, because it is
     * where a reader has the least time and the most at stake.
     *
     * ⚠️ This asserts the page EXISTS, not that it is good. No Filipino here
     * has been reviewed by a fluent speaker — see docs/governance.md, which
     * lists every draft. A test cannot check fluency and must not imply it.
     */
    const english = PAGES.filter(
      page =>
        page.path.startsWith('content/emergency/') &&
        !page.path.endsWith('.fil.md')
    );
    expect(english.length).toBeGreaterThan(0);

    const untranslated = english
      .filter(
        page =>
          !existsSync(path.join(ROOT, page.path.replace(/\.md$/, '.fil.md')))
      )
      .map(page => page.path);
    expect(untranslated).toEqual([]);
  });
});
