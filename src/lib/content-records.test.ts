import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  charterManifestSchema,
  transparencyManifestSchema,
  manifestSchema,
  timelineSchema,
  travelSchema,
  type CharterRecord,
} from './content-schema';
import { DATA_CLASSES, freshnessOf } from './freshness';
import {
  REPO_ROOT as ROOT,
  filesMatching,
  matchesIn as hits,
  sourceFilesIn,
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

  it('claims no check that has not happened yet', () => {
    /*
     * ★ TAGO-104 criterion 5, on the data side. `StalenessNotice` throws when
     * it is handed a future check date, which fails the prerender of whichever
     * page carries one — but that only fires for a page somebody has built a
     * route for. This fires for every entry in the tree, today, and it is the
     * half that catches a typo the moment it is committed.
     *
     * A date in the future is not a degree of staleness. It is a page claiming
     * it was checked on a day that has not arrived, which makes it look like
     * the best-maintained page on the site.
     */
    const today = new Date().toISOString().slice(0, 10);
    const future: string[] = [];

    for (const manifest of MANIFESTS) {
      for (const page of manifestSchema.parse(yaml.load(manifest.text)).pages) {
        if (page.lastCheckedAt > today)
          future.push(`${page.slug}: ${page.lastCheckedAt}`);
        if (page.source.retrievedAt > today)
          future.push(`${page.slug}: retrieved ${page.source.retrievedAt}`);
      }
    }

    expect(future).toEqual([]);
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

describe('the transcription is what it says it is', () => {
  /*
   * INVERTED on 2026-08-10, and the inversion is the point.
   *
   * This block used to assert that NO fee appeared anywhere in `content/`,
   * because republishing the charter's contents was a permission ⛔ PROG-003
   * recorded as out of scope. PROG-003 re-opened; the contents are now the
   * deliverable. Deleting the check would have left the highest-severity risk
   * in the project unguarded, so it was turned around instead: every fee on a
   * page must trace back to the document it cites.
   *
   * The risk it guards has not changed shape. It was never somebody deciding
   * to transcribe the charter. It is somebody helpfully tidying "P 1,000.00"
   * into "₱1,000.00" because it looked untidy, and nobody noticing for a year —
   * by which time the string on the page is not the string on the form.
   *
   * The byte-for-byte half lives in transcription-integrity.test.ts, which has
   * the PDFs. This half is what can be checked from the tree alone.
   */
  const FEE_SHAPED =
    /₱\s?[\d,]+|\bPHP\s?[\d,]+|\bPhp\s?[\d,]+|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/;

  const CHARTER_MANIFESTS = MANIFESTS.filter(
    manifest =>
      manifest.path.startsWith('content/services/') ||
      manifest.path.startsWith('content/government/legislative/')
  );

  const RECORDS = CHARTER_MANIFESTS.flatMap(
    manifest => (yaml.load(manifest.text) as { pages: CharterRecord[] }).pages
  );

  it('is actually reading the records', () => {
    expect(RECORDS.length).toBeGreaterThan(90);
  });

  it('states a fee only on a page whose record carries the transcription', () => {
    /*
     * A fee in the markdown with no `content` behind it in the manifest is a
     * figure somebody typed. The generator cannot produce one: it writes both
     * sides from the same extracted record, so they agree by construction, and
     * this is what notices a hand-edit that broke that.
     */
    const transcribed = new Set(
      RECORDS.filter(record => record.content !== null).map(
        record => record.slug
      )
    );

    const offenders = PAGES.filter(page => {
      const isCharterPage =
        page.path.startsWith('content/services/') ||
        page.path.startsWith('content/government/legislative/');
      if (!isCharterPage) return false;
      if (!FEE_SHAPED.test(page.text)) return false;
      const slug = path.basename(page.path).replace(/(\.fil)?\.md$/, '');
      return !transcribed.has(slug);
    }).map(page => page.path);

    expect(offenders).toEqual([]);
  });

  it('publishes no fee outside the charter pages at all', () => {
    // The emergency layer, the profile, the history, the tourism set and the
    // transparency register state no figures of their own. Only a page citing
    // a charter document may carry one.
    const elsewhere = PAGES.filter(
      page =>
        !page.path.startsWith('content/services/') &&
        !page.path.startsWith('content/government/legislative/') &&
        !page.path.startsWith('content/charter/')
    );
    expect(hits(elsewhere, FEE_SHAPED)).toEqual([]);
  });

  it('fires on a doctored page', () => {
    // A check that has never gone red is not known to work.
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
    // A check that fails on "22 documents" gets deleted the first week.
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

describe('every internal link is locale-correct and resolves', () => {
  /*
   * `next-intl` routes every page under a `[locale]` segment and prefixes BOTH
   * locales, so `/charter/documents/x` written on a Filipino page lands in the
   * English tree — or, once the locale layout is the only route, on nothing at
   * all. The first cross-links this project wrote were all unprefixed.
   *
   * The failure is the quiet kind: the link works in development on the default
   * locale and 404s for the other one.
   */
  const INTERNAL = /\]\((\/[a-z0-9][^)]*)\)/g;

  const links = PAGES.flatMap(page =>
    [...page.text.matchAll(INTERNAL)].map(match => ({
      from: page.path,
      href: match[1],
      locale: page.path.endsWith('.fil.md') ? 'fil' : 'en',
    }))
  );

  it('is actually finding links', () => {
    expect(links.length).toBeGreaterThan(50);
  });

  it('prefixes every one with a locale', () => {
    const bare = links
      .filter(link => !/^\/(en|fil)\//.test(link.href))
      .map(link => `${link.from} → ${link.href}`);
    expect(bare).toEqual([]);
  });

  it('never links a page in one locale to a page in the other', () => {
    const crossed = links
      .filter(link => !link.href.startsWith(`/${link.locale}/`))
      .map(link => `${link.from} → ${link.href}`);
    expect(crossed).toEqual([]);
  });

  it('points every link at a markdown file that exists', () => {
    const missing = links
      .filter(link => {
        const withoutLocale = link.href.replace(/^\/(en|fil)\//, '');
        const suffix = link.locale === 'fil' ? '.fil.md' : '.md';
        return !existsSync(path.join(CONTENT, `${withoutLocale}${suffix}`));
      })
      .map(link => `${link.from} → ${link.href}`);
    expect(missing).toEqual([]);
  });

  it('fires on an unprefixed link', () => {
    // A check that has never gone red is not known to work.
    const doctored = [
      ...'](/services/health/get-a-medical-certificate)'.matchAll(INTERNAL),
    ];
    expect(doctored).toHaveLength(1);
    expect(/^\/(en|fil)\//.test(doctored[0][1])).toBe(false);
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

describe('the office facet says the same number twice', () => {
  it('🔴 keeps every office inside ONE category', () => {
    /*
     * A latent trap in the office filter, guarded before it can bite.
     *
     * A category page's chip counts the services THAT OFFICE PROVIDES IN THAT
     * CATEGORY. `/services/office/<slug>` lists every service that office
     * provides, full stop. Those two numbers are equal only while no office
     * spans more than one category — which is true of all 18 today, and is a
     * property of the vocabulary rather than a guarantee.
     *
     * The moment one office appears in two categories, a reader clicks a chip
     * reading "8" and lands on a page of eleven. This fails first, and whoever
     * moved the service decides what the chip should say — scope the facet to
     * the category, or label the chip with the office's whole total.
     */
    const perOffice = new Map<string, Set<string>>();

    for (const manifest of MANIFESTS.filter(doc =>
      doc.path.startsWith('content/services/')
    )) {
      const category = manifest.path.split('/')[2];
      const parsed = yaml.load(manifest.text) as {
        pages: { office?: string }[];
      };
      for (const page of parsed.pages) {
        if (!page.office) continue;
        const seen = perOffice.get(page.office) ?? new Set<string>();
        seen.add(category);
        perOffice.set(page.office, seen);
      }
    }

    expect(perOffice.size).toBeGreaterThan(10);
    const spanning = [...perOffice]
      .filter(([, categories]) => categories.size > 1)
      .map(
        ([office, categories]) => `${office} → ${[...categories].join(', ')}`
      );

    expect(spanning).toEqual([]);
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
    // English pages only: the Filipino counterparts carry the translated
    // heading, and counting both would silently double every office total.
    // Office hours are the highest-value missing field in the project, and
    // this is the settled fallback for them. A blank cell reads as "no hours";
    // a dated "not stated" reads as what it is.
    const offices = PAGES.filter(
      page =>
        page.path.startsWith('content/government/offices/') &&
        !page.path.endsWith('.fil.md')
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

/**
 * ★ TAGO-201 · CONT-212 — the charter index, reconciled against the frozen
 * vocabulary.
 *
 * This is the checkpoint of the whole wave, and it is deliberately derived
 * rather than written down: every count below comes from
 * inventory/task-vocabulary.yaml, so the index and the enumeration cannot
 * drift apart. A hard-coded 99 would go stale the first time a charter is
 * re-harvested and would still be green.
 *
 * What a machine can check here is the JOIN — that a page names a service the
 * municipality actually publishes, under the title we froze, citing the
 * document it came from. What it CANNOT check is whether a human read the
 * page against that document. That is CONT-212's second-person pass, and the
 * Verifier role is vacant — see `docs/governance.md`.
 */
type VocabularyService = {
  id: string;
  section: 'external' | 'internal';
  charterTitle: string;
  taskTitle: string | null;
  slug: string | null;
  office: { canonical: string };
  answers: string | null;
};

const VOCABULARY = yaml.load(
  readFileSync(path.join(ROOT, 'inventory', 'task-vocabulary.yaml'), 'utf8')
) as {
  services: VocabularyService[];
  categories: { folder: string; offices: string[] }[];
  groups: { id: string; members: string[] }[];
  filipinoPriority: { reason: string; selectedAt: string; slugs: string[] };
};

const CHARTER_DOCUMENTS = yaml.load(
  readFileSync(path.join(ROOT, 'inventory', 'charter-documents.yaml'), 'utf8')
) as { documents: { file: string; title: string; sha256: string }[] };

const EXTERNAL = VOCABULARY.services.filter(
  service => service.section === 'external'
);

/** Canonical office → the folder its services publish under. */
const CATEGORY_OF_OFFICE = new Map(
  VOCABULARY.categories.flatMap(category =>
    category.offices.map(office => [office, category.folder] as const)
  )
);

/** Every charter record in the tree, with the manifest it came from. */
const CHARTER_RECORDS = MANIFESTS.filter(
  manifest =>
    manifest.path.startsWith('content/services/') ||
    manifest.path.startsWith('content/government/legislative/')
).flatMap(manifest => {
  const parsed = charterManifestSchema.safeParse(yaml.load(manifest.text));
  if (!parsed.success)
    throw new Error(
      `${manifest.path} is not a charter manifest: ${parsed.error}`
    );
  return parsed.data.pages.map(page => ({
    page,
    folder: path.dirname(manifest.path).replace(/^content\//, ''),
  }));
});

/**
 * The reconciliation, as pure functions over (enumeration, index).
 *
 * Split out so each one can be fired at a doctored pair as well as at the real
 * tree. A check that has only ever been handed correct input has not been
 * shown to detect anything, and this whole block exists to detect something.
 */
type Filed = { page: CharterRecord; folder: string };

function servicesMissingFrom(services: VocabularyService[], filed: Filed[]) {
  const published = new Set(filed.map(({ page }) => page.charterServiceId));
  return services
    .filter(service => !published.has(service.id))
    .map(service => service.id);
}

function recordsWithNoService(services: VocabularyService[], filed: Filed[]) {
  const enumerated = new Set(services.map(service => service.id));
  return filed
    .map(({ page }) => page.charterServiceId)
    .filter(id => !enumerated.has(id));
}

function servicesClaimedTwice(filed: Filed[]) {
  const seen = new Map<string, number>();
  for (const { page } of filed)
    seen.set(page.charterServiceId, (seen.get(page.charterServiceId) ?? 0) + 1);
  return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
}

function misfiled(filed: Filed[], categoryOf: Map<string, string>) {
  return filed
    .filter(({ page, folder }) => categoryOf.get(page.office ?? '') !== folder)
    .map(({ page, folder }) => `${page.slug}: in ${folder}`);
}

function driftedFromVocabulary(services: VocabularyService[], filed: Filed[]) {
  const byId = new Map(services.map(service => [service.id, service]));
  const drifted: string[] = [];
  for (const { page } of filed) {
    const service = byId.get(page.charterServiceId);
    if (!service) continue;
    if (page.name !== service.taskTitle)
      drifted.push(`${page.slug}: name ≠ taskTitle`);
    if (page.slug !== service.slug)
      drifted.push(`${page.slug}: slug ≠ frozen slug`);
    if (page.office !== service.office.canonical)
      drifted.push(`${page.slug}: office ≠ canonical office`);
    if ((page.group ?? null) !== (service.answers ?? null))
      drifted.push(`${page.slug}: group ≠ vocabulary group`);
  }
  return drifted;
}

describe('the charter index reconciles against the enumeration', () => {
  it('is reading both sides', () => {
    // Same reason as the scan check above: two empty sets agree perfectly.
    expect(EXTERNAL.length).toBeGreaterThan(50);
    expect(CHARTER_RECORDS.length).toBeGreaterThan(50);
    expect(CATEGORY_OF_OFFICE.size).toBeGreaterThan(15);
  });

  it('publishes every external service the charter names', () => {
    // An unaccounted service is a failure of the ticket, not a scope decision
    // — CONT-208 criterion 5, read as every EXTERNAL service, because all 68
    // internal ones carry CONT-002's recorded exclusion.
    expect(servicesMissingFrom(EXTERNAL, CHARTER_RECORDS)).toEqual([]);
  });

  it('publishes nothing that is not one', () => {
    // The other direction, and the one that catches an invented page or an
    // internal service reaching the tree.
    expect(recordsWithNoService(EXTERNAL, CHARTER_RECORDS)).toEqual([]);
  });

  it('claims each service exactly once', () => {
    expect(servicesClaimedTwice(CHARTER_RECORDS)).toEqual([]);
  });

  it('files every record in the category its office is assigned', () => {
    expect(misfiled(CHARTER_RECORDS, CATEGORY_OF_OFFICE)).toEqual([]);
  });

  it('uses the frozen title, slug and office — never a re-derived one', () => {
    // The failure this prevents is quiet: a page authored from the PDF instead
    // of the vocabulary reads fine and breaks every join that follows it.
    expect(driftedFromVocabulary(EXTERNAL, CHARTER_RECORDS)).toEqual([]);
  });

  it('cites an archived document, with a checksum that still matches', () => {
    const byFile = new Map(
      CHARTER_DOCUMENTS.documents.map(document => [document.file, document])
    );
    const bad: string[] = [];
    for (const { page } of CHARTER_RECORDS) {
      const document = byFile.get(page.charterDocument.file);
      if (!document) {
        bad.push(`${page.slug}: cites an unarchived document`);
        continue;
      }
      if (document.sha256 !== page.charterDocument.sha256)
        bad.push(`${page.slug}: checksum has moved since it was transcribed`);
      if (document.title !== page.charterDocument.title)
        bad.push(`${page.slug}: document title is not the published one`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps every group whole, and merges none of them', () => {
    // Grouped, never merged: merging would mean choosing one set of
    // requirements for a resident and hiding the other.
    const published = new Set(
      CHARTER_RECORDS.map(record => record.page.charterServiceId)
    );
    const broken = VOCABULARY.groups
      .filter(group => group.members.some(member => !published.has(member)))
      .map(group => group.id);
    expect(broken).toEqual([]);
  });

  it('carries no verification record while the Verifier role is vacant', () => {
    /*
     * Not a permanent rule — a tripwire. PROG-101's two-person rule means a
     * record cannot honestly exist yet, so the honest state is null on all of
     * them. The day somebody fills the role and checks a page, this test goes
     * red and is DELETED in the same commit that ticks CONT-212.
     *
     * Its value is the failure it prevents: a record invented to make a box
     * tick. The schema already rejects one naming the same handle twice; this
     * rejects one appearing at all before there is a second person.
     */
    const claimed = CHARTER_RECORDS.filter(
      ({ page }) => page.verificationRecord !== null
    ).map(({ page }) => page.slug);
    expect(claimed).toEqual([]);
  });
});

describe('a service page shows the transcription, and says whose it is', () => {
  /*
   * ⚠️ THIS REPLACED THE EIGHT-HEADING RULE ON 2026-08-10.
   *
   * What was here required ★ TAGO-004's seven charter headings on every
   * transcribed page and forbade them on every untranscribed one. That shape
   * was right about wanting one agreed structure and wrong about which one:
   * it meant re-deriving every field out of the transcription, and every field
   * that could not be re-derived turned into a page saying *this page cannot
   * tell you yet* — on thirty services whose transcription sat complete in the
   * record the whole time.
   *
   * The document's own structure is the structure now. What must hold is that
   * every page SHOWS it and ATTRIBUTES it, because a transcription without its
   * source is a rumour with better typography.
   */
  const CHARTER_PAGES = PAGES.filter(
    page =>
      page.path.startsWith('content/services/') ||
      page.path.startsWith('content/government/legislative/')
  );

  it('is actually reading the charter pages', () => {
    expect(CHARTER_PAGES.length).toBeGreaterThan(50);
  });

  it('shows the transcription on every one', () => {
    const missing = CHARTER_PAGES.filter(
      page =>
        !/^##\s+(What the charter says|Ano ang sinasabi ng charter)\s*$/m.test(
          page.text
        )
    ).map(page => page.path);
    expect(missing).toEqual([]);
  });

  it('names and links the document on every one', () => {
    const uncited = CHARTER_PAGES.filter(
      page =>
        !/^##\s+(The official document|Ang opisyal na dokumento)\s*$/m.test(
          page.text
        ) || !/https:\/\/tago\.gov\.ph\//.test(page.text)
    ).map(page => page.path);
    expect(uncited).toEqual([]);
  });

  it('🔴 claims on no page that a second person has checked it', () => {
    /*
     * ⚠️ Reversed on 2026-08-10, and the reversal is the point.
     *
     * This required every charter page to CARRY the sentence *"not yet checked
     * by a second person"*. The blockquote that carried it was removed by
     * instruction; the requirement went with it, and what remains is the
     * assertion that no page ever says the opposite.
     *
     * The Verifier role is still vacant and every `verificationRecord` is still
     * `null` — `transcription-integrity.test.ts` asserts both. What a reader
     * now gets on the page is the source block: what the page was read from,
     * when, and that the document wins where the two disagree.
     */
    const claiming = CHARTER_PAGES.filter(page =>
      /(?<!not yet )(?:checked|verified) by a second person|(?<!hindi pa )nasusuri ng pangalawang tao/i.test(
        page.text
      )
    ).map(page => page.path);
    expect(claiming).toEqual([]);
  });

  it('🔴 carries no completeness block — that belongs to the transcript', () => {
    /*
     * The *Also printed for this service* block is every fragment the document
     * prints that the structured blocks did not carry. It is what lets the
     * token-completeness check reach zero, and it belongs on the full-document
     * transcript, which exists to be checked against.
     *
     * On a task page it is a pile of loose fragments under the answer, and a
     * resident reading how to register a birth is not served by it. Removed
     * from task pages on 2026-08-10 at the project lead's instruction; this is
     * what stops it coming back with the next generator change.
     */
    const offenders = CHARTER_PAGES.filter(page =>
      /Also printed for this service|Nakalimbag din para sa serbisyong ito/.test(
        page.text
      )
    ).map(page => page.path);

    expect(offenders).toEqual([]);
  });

  it('🔴 carries no “what the charter does not say” section', () => {
    /*
     * That section told every reader that no document states where to go or the
     * office's hours. Both were already answered elsewhere and better: **Office
     * or Division** names the office on every page, and the hours are the
     * standard government office hours rather than something each charter would
     * restate.
     *
     * Removed on 2026-08-10 at the project lead's instruction. A page that
     * spends a section saying it cannot tell you something it never needed to
     * is a page that reads as less complete than it is.
     */
    const offenders = CHARTER_PAGES.filter(page =>
      /^##\s+(What the charter does not say|Ano ang hindi sinasabi ng charter)\s*$/m.test(
        page.text
      )
    ).map(page => page.path);

    expect(offenders).toEqual([]);
  });

  it('names the office on every page instead', () => {
    // The replacement for the section above, and the reason it was not needed:
    // every page states which office provides the service, twice — in the
    // "Who provides it" line and in the charter's own Office or Division row.
    const unnamed = CHARTER_PAGES.filter(
      page =>
        !/\*\*(Who provides it|Sino ang nagbibigay nito):\*\*/.test(page.text)
    ).map(page => page.path);

    expect(unnamed).toEqual([]);
  });

  it('fires on a doctored page', () => {
    const doctored = [
      {
        path: 'fixture',
        text: '# A service\n\n**Also printed for this service**\n\n> stray',
      },
    ];
    expect(
      doctored.filter(page => /Also printed for this service/.test(page.text))
    ).toHaveLength(1);
  });
});

describe('the reconciliation actually fires', () => {
  /*
   * Doctored pairs, run through the same functions the real tree is run
   * through. Without these, all six checks above would pass just as happily on
   * two empty arrays — which is exactly the state this content tree was in a
   * day ago.
   */
  const service: VocabularyService = {
    id: 'municipal-health-office#external-1',
    section: 'external',
    charterTitle: 'Consultation',
    taskTitle: 'See a doctor for a consultation',
    slug: 'see-a-doctor-for-a-consultation',
    office: { canonical: 'Municipal Health Office' },
    answers: null,
  };

  const filed = (
    over: Partial<CharterRecord> = {},
    folder = 'services/health'
  ) =>
    [
      {
        page: {
          name: service.taskTitle,
          slug: service.slug,
          office: service.office.canonical,
          charterServiceId: service.id,
          group: null,
          ...over,
        } as CharterRecord,
        folder,
      },
    ] satisfies Filed[];

  const categories = new Map([['Municipal Health Office', 'services/health']]);

  it('agrees when the pair agrees', () => {
    expect(servicesMissingFrom([service], filed())).toEqual([]);
    expect(recordsWithNoService([service], filed())).toEqual([]);
    expect(misfiled(filed(), categories)).toEqual([]);
    expect(driftedFromVocabulary([service], filed())).toEqual([]);
  });

  it('catches a service with no page', () => {
    expect(servicesMissingFrom([service], [])).toEqual([service.id]);
  });

  it('catches a page with no service — an invented one, or an internal one', () => {
    expect(
      recordsWithNoService(
        [service],
        filed({ charterServiceId: 'municipal-accounting-office#internal-6' })
      )
    ).toHaveLength(1);
  });

  it('catches one service claimed by two pages', () => {
    expect(servicesClaimedTwice([...filed(), ...filed()])).toEqual([
      service.id,
    ]);
  });

  it('catches a page filed in the wrong category', () => {
    expect(misfiled(filed({}, 'services/tourism'), categories)).toHaveLength(1);
  });

  it('catches a title, slug, office or group re-derived instead of joined', () => {
    expect(
      driftedFromVocabulary([service], filed({ name: 'Consult a doctor' }))
    ).toHaveLength(1);
    expect(
      driftedFromVocabulary([service], filed({ slug: 'consult-a-doctor' }))
    ).toHaveLength(1);
    expect(
      driftedFromVocabulary(
        [service],
        filed({ office: 'Municipality Health Office' })
      )
    ).toHaveLength(1);
    expect(
      driftedFromVocabulary([service], filed({ group: 'medical-certificate' }))
    ).toHaveLength(1);
  });
});

describe('every charter page has a body, and every body a manifest entry', () => {
  /*
   * The failure that looks like nothing is wrong: the file sits there, correct,
   * and the page 404s. Checked here across the charter tree specifically, at
   * the scale where it becomes likely — 99 slugs typed once each.
   */
  it('has a markdown file behind every charter slug', () => {
    const orphans = CHARTER_RECORDS.filter(
      ({ page, folder }) =>
        !existsSync(path.join(CONTENT, folder, `${page.slug}.md`))
    ).map(({ page }) => page.slug);
    expect(orphans).toEqual([]);
  });

  it('lists every charter markdown file in its manifest', () => {
    const listed = new Set(
      CHARTER_RECORDS.map(({ page, folder }) => `${folder}/${page.slug}.md`)
    );
    const unlisted = PAGES.filter(
      page =>
        (page.path.startsWith('content/services/') ||
          page.path.startsWith('content/government/legislative/')) &&
        !page.path.endsWith('.fil.md') &&
        !listed.has(page.path.replace(/^content\//, ''))
    ).map(page => page.path);
    expect(unlisted).toEqual([]);
  });

  it('gives no two pages the same slug, in any category', () => {
    // Two categories claiming one slug is two pages claiming one URL.
    const seen = new Map<string, number>();
    for (const { page } of CHARTER_RECORDS)
      seen.set(page.slug, (seen.get(page.slug) ?? 0) + 1);
    expect([...seen].filter(([, count]) => count > 1)).toEqual([]);
  });
});

describe('the Filipino set is the one that was chosen, and no other', () => {
  /*
   * CONT-211. The twenty are picked by transaction class and recorded in
   * inventory/task-vocabulary.yaml, because "the twenty the most residents
   * need" cannot be measured until a route has served a page — so the
   * selection has to be a written decision rather than whoever felt like
   * translating something.
   *
   * 🔴 These files are AUTHORED, not REVIEWED. The Translator role is vacant
   * (docs/governance.md), and CONT-211 criterion 2 stays unticked until a
   * fluent speaker has read them. Twenty files existing is not twenty files
   * checked, and this test asserts the first thing only.
   */
  const PRIORITY: string[] = VOCABULARY.filipinoPriority.slugs;

  const filipinoPages = PAGES.filter(page => page.path.endsWith('.fil.md'));
  const charterFilipino = filipinoPages.filter(
    page =>
      page.path.startsWith('content/services/') ||
      page.path.startsWith('content/government/legislative/')
  );

  it('still covers every one of the recorded twenty', () => {
    /*
     * ⚠️ This used to assert the charter Filipino set was EXACTLY the twenty.
     * CONT-402 superseded that by translating everything, so an equality check
     * would now fail on success. What still matters is that the twenty chosen
     * by transaction class were not dropped in the sweep — so it is now a
     * subset check, and full coverage is asserted separately below.
     */
    const shipped = new Set(
      charterFilipino.map(page =>
        path.basename(page.path).replace(/\.fil\.md$/, '')
      )
    );
    expect(PRIORITY.filter(slug => !shipped.has(slug))).toEqual([]);
  });

  it('names a service that exists, for every one', () => {
    const slugs = new Set(EXTERNAL.map(service => service.slug));
    expect(PRIORITY.filter(slug => !slugs.has(slug))).toEqual([]);
  });

  it('has an English counterpart beside every Filipino body', () => {
    const orphans = charterFilipino
      .filter(
        page =>
          !existsSync(path.join(ROOT, page.path.replace(/\.fil\.md$/, '.md')))
      )
      .map(page => page.path);
    expect(orphans).toEqual([]);
  });

  it('shares one manifest entry with its English counterpart, so the source cannot diverge', () => {
    /*
     * Criterion 4 — same source, same verification level, same check date —
     * holds by construction rather than by care: there is one entry per slug
     * and both locales render from it. This asserts the construction, so that
     * adding a per-locale source later fails here first.
     */
    const bySlug = new Map(
      CHARTER_RECORDS.map(({ page }) => [page.slug, page])
    );
    for (const page of charterFilipino) {
      const slug = path.basename(page.path).replace(/\.fil\.md$/, '');
      const entry = bySlug.get(slug);
      expect(entry, `${slug} has no manifest entry`).toBeDefined();
      expect(entry!.source.retrievedAt).toBe(entry!.lastCheckedAt);
      expect(entry!.verification).toBe('V3');
    }
  });

  it('publishes no fee in Filipino outside the charter pages', () => {
    // Asserted separately from the English sweep because a figure is the one
    // thing translation may never change, and a reviewer reading only the
    // English would not catch it. Inverted alongside the English scan on
    // 2026-08-10: a transcribed charter page carries figures in both locales,
    // and they must be the SAME figures — see § the Filipino carries the
    // charter's figures unchanged.
    expect(
      hits(
        filipinoPages.filter(
          page =>
            !page.path.startsWith('content/services/') &&
            !page.path.startsWith('content/government/legislative/') &&
            !page.path.startsWith('content/charter/')
        ),
        /₱\s?[\d,]+|\bPHP\s?[\d,]+|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/
      )
    ).toEqual([]);
  });

  it('carries the charter figures into Filipino unchanged', () => {
    /*
     * The rule that replaces the ban, and the more important one. A fee is
     * what the counter will ask for BY NAME; translating or reformatting it
     * produces a figure the form does not carry. So every fee-shaped string on
     * a Filipino charter page must appear, byte for byte, on its English twin.
     */
    const FEE =
      /₱\s?[\d,]+|\bPHP\s?[\d,]+|\bPhp\.?\s?[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
    const drifted: string[] = [];

    for (const page of filipinoPages) {
      const twin = PAGES.find(
        other => other.path === page.path.replace('.fil.md', '.md')
      );
      if (!twin) continue;
      const english = new Set(twin.text.match(FEE) ?? []);
      for (const figure of new Set(page.text.match(FEE) ?? [])) {
        if (!english.has(figure)) drifted.push(`${page.path} → ${figure}`);
      }
    }
    expect(drifted).toEqual([]);
  });

  it('keeps document, office and charter wording untranslated', () => {
    // CONT-211 criterion 3. A translated form name sends somebody to the
    // counter to ask for a document that does not exist.
    const byId = new Map(EXTERNAL.map(service => [service.slug, service]));
    for (const page of charterFilipino) {
      const slug = path.basename(page.path).replace(/\.fil\.md$/, '');
      const service = byId.get(slug)!;
      expect(page.text, `${slug}: office name`).toContain(
        service.office.canonical
      );
      const firstLineOfCharterTitle = service.charterTitle
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);
      expect(page.text, `${slug}: charter wording`).toContain(
        firstLineOfCharterTitle
      );
    }
  });
});

describe('only a resident-facing ambiguity reaches the page', () => {
  /*
   * ★ TAGO-201 carries two note fields and exactly one of them renders.
   *
   * They were one field to begin with, and it went wrong in a specific way:
   * "the extractor captured the heading as far as 'National Building Code of'"
   * appeared under a heading that says the charter does not answer your
   * question, followed by "guessing which reading is right would be inventing a
   * fact". There was no competing reading — the sentence was simply untrue
   * there, on nine of eleven pages, and the two genuine ambiguities stopped
   * standing out among them.
   */
  const SECTION = '## What the charter leaves unclear';

  const bodyOf = ({ page, folder }: Filed) =>
    PAGES.find(doc => doc.path === `content/${folder}/${page.slug}.md`);

  it('renders the section on exactly the records that carry an ambiguity', () => {
    const wrong: string[] = [];
    for (const record of CHARTER_RECORDS) {
      const body = bodyOf(record);
      if (!body) continue;
      const rendered = body.text.includes(SECTION);
      const declared = record.page.ambiguity !== null;
      if (rendered !== declared)
        wrong.push(
          `${record.page.slug}: ambiguity=${declared}, section=${rendered}`
        );
    }
    expect(wrong).toEqual([]);
  });

  it('never renders a transcription note', () => {
    // Build detail, recorded for the verifier. A resident has no use for it and
    // it reads as noise on a civic page.
    const leaked = CHARTER_RECORDS.filter(record => {
      const note = record.page.transcriptionNote;
      if (!note) return false;
      const body = bodyOf(record);
      return body ? body.text.includes(note.slice(0, 40)) : false;
    }).map(record => record.page.slug);
    expect(leaked).toEqual([]);
  });

  it('still records provenance for every title read off the document by hand', () => {
    // The 6 `read-from-pdf` titles. Dropping the rendered section must not
    // mean dropping the record of WHY the title is ours rather than published.
    const unexplained = CHARTER_RECORDS.filter(
      ({ page }) =>
        page.charterTitleSource === 'read-from-pdf' &&
        page.transcriptionNote === null
    ).map(({ page }) => page.slug);
    expect(unexplained).toEqual([]);
    expect(
      CHARTER_RECORDS.filter(
        ({ page }) => page.charterTitleSource === 'read-from-pdf'
      )
    ).toHaveLength(6);
  });

  it('says on the page itself that a read-from-pdf title is this project’s', () => {
    // The rendered half of the same fact, and the half a reader needs.
    const silent = CHARTER_RECORDS.filter(({ page }) => {
      if (page.charterTitleSource !== 'read-from-pdf') return false;
      const body = bodyOf(
        CHARTER_RECORDS.find(r => r.page.slug === page.slug)!
      );
      return body ? !body.text.includes('read off the document by hand') : true;
    }).map(({ page }) => page.slug);
    expect(silent).toEqual([]);
  });
});

/**
 * ★ TAGO-301 · CONT-301 — the transparency register, reconciled against the
 * mandated set.
 *
 * This is Wave 5's checkpoint, and like the charter reconciliation it is
 * DERIVED rather than written down: the set comes from
 * inventory/disclosure-set.yaml, so the register and the list cannot drift.
 *
 * ⚠️ What a machine can check here is that every listed document has exactly
 * one entry and that each entry's status is internally honest. What it CANNOT
 * check is whether the list is complete — the governing issuance was sought on
 * 2026-08-09 and could not be retrieved, and that limit is recorded in the
 * file itself rather than papered over by a green test.
 */
type DisclosureDocument = { slug: string; name: string };

const DISCLOSURE_SET = yaml.load(
  readFileSync(path.join(ROOT, 'inventory', 'disclosure-set.yaml'), 'utf8')
) as {
  issuance: { obtained: boolean; channels: { url: string }[] };
  documents: DisclosureDocument[];
  excluded: { what: string }[];
};

const REGISTER = (() => {
  const manifest = MANIFESTS.find(
    file => file.path === 'content/transparency/register/index.yaml'
  );
  if (!manifest)
    throw new Error('the transparency register manifest is missing');
  const parsed = transparencyManifestSchema.safeParse(yaml.load(manifest.text));
  if (!parsed.success)
    throw new Error(`the register is not a register: ${parsed.error}`);
  return parsed.data.pages;
})();

/** Both directions, as pure functions, so each can be fired at bad input. */
const documentsWithNoEntry = (
  set: DisclosureDocument[],
  entries: { slug: string }[]
) => {
  const present = new Set(entries.map(entry => entry.slug));
  return set.filter(doc => !present.has(doc.slug)).map(doc => doc.slug);
};

const entriesWithNoDocument = (
  set: DisclosureDocument[],
  entries: { slug: string }[]
) => {
  const listed = new Set(set.map(doc => doc.slug));
  return entries.filter(entry => !listed.has(entry.slug)).map(e => e.slug);
};

describe('the transparency register accounts for the mandated set', () => {
  it('is reading both sides', () => {
    // Two empty sets agree perfectly, which is how this check would rot.
    expect(DISCLOSURE_SET.documents.length).toBeGreaterThanOrEqual(10);
    expect(REGISTER.length).toBeGreaterThanOrEqual(10);
  });

  it('has an entry for every document in the set', () => {
    expect(documentsWithNoEntry(DISCLOSURE_SET.documents, REGISTER)).toEqual(
      []
    );
  });

  it('has no entry for anything outside it', () => {
    expect(entriesWithNoDocument(DISCLOSURE_SET.documents, REGISTER)).toEqual(
      []
    );
  });

  it('claims each document exactly once', () => {
    const slugs = REGISTER.map(entry => entry.slug);
    expect(slugs.length).toBe(new Set(slugs).size);
  });

  it('records where it looked, and when, for everything not located', () => {
    // The whole failure mode of a gap register: an absence indistinguishable
    // from nobody having looked. The schema refuses an empty list; this also
    // pins that every check carries a real date.
    const bad = REGISTER.filter(
      entry => entry.status === 'not-located'
    ).flatMap(entry =>
      entry.lookedFor.length === 0 ||
      entry.lookedFor.some(look => !/^\d{4}-\d{2}-\d{2}$/.test(look.checkedAt))
        ? [entry.slug]
        : []
    );
    expect(bad).toEqual([]);
    expect(
      REGISTER.filter(entry => entry.status === 'not-located').length
    ).toBeGreaterThan(0);
  });

  it('marks nothing as requested while no request can be sent', () => {
    /*
     * 🔴 PROG-201 is retired and the correspondence lane with it, so no item
     * can honestly be `requested`. The status stays in the schema — the day
     * the lane re-opens, the register needs no re-shaping — but an entry
     * using it today would describe an ask that never happened.
     *
     * When that changes, this test is deleted deliberately, in a diff
     * somebody reviews. That is the same shape as the Phase 0 route freeze.
     */
    expect(REGISTER.filter(entry => entry.status === 'requested')).toEqual([]);
  });

  it('links the one published document rather than rehosting it', () => {
    const linked = REGISTER.filter(entry => entry.status === 'linked');
    expect(linked).toHaveLength(1);
    expect(linked[0]?.source.url).toMatch(/^https:\/\/tago\.gov\.ph\//);
    expect(linked[0]?.fiscalYear).toBe('2022');
  });

  it('holds no statement of assets, liabilities and net worth', () => {
    // Permanently excluded. The schema refuses one; this proves none slipped
    // in under a different field, and that the page explaining the request
    // route does exist — the exclusion is a position, not a hole.
    const held = /\bSALN\b|statements?\s+of\s+assets/i;
    expect(
      REGISTER.filter(
        entry => held.test(entry.name) || held.test(entry.documentName)
      )
    ).toEqual([]);
    expect(
      existsSync(
        path.join(
          ROOT,
          'content/transparency/requests/how-to-request-a-saln.md'
        )
      )
    ).toBe(true);
  });

  it('cites, on every absence, a place it actually checked', () => {
    /*
     * `verification` on a `not-located` entry describes the CHECK, not a
     * document — no official record says a document is unpublished. `V3`
     * therefore means the absence was observed first-hand at the primary
     * address, and that claim is only true if the address cited is one this
     * project actually opened.
     *
     * Without this, an entry could cite a page nobody looked at and still
     * carry the strongest level in the standard. See docs/governance.md
     * § What a level means on a recorded absence.
     */
    const mismatched = REGISTER.filter(entry => entry.status === 'not-located')
      .filter(
        entry => !entry.lookedFor.some(look => look.url === entry.source.url)
      )
      .map(entry => entry.slug);
    expect(mismatched).toEqual([]);
  });

  it('claims no level stronger than the looking supports', () => {
    // V3 is first-hand at the primary location. An entry claiming it while
    // every address it checked was unreachable would be claiming an
    // observation nobody could make.
    const overclaimed = REGISTER.filter(
      entry =>
        entry.verification === 'V3' &&
        entry.lookedFor.length > 0 &&
        entry.lookedFor.every(look => look.result === 'not-retrievable')
    ).map(entry => entry.slug);
    expect(overclaimed).toEqual([]);
  });

  it('records that the governing issuance was not obtained', () => {
    // The register's own limit, asserted rather than left to a comment. If
    // somebody later retrieves the issuance they flip this, and the test tells
    // them the completeness claim may change with it.
    expect(DISCLOSURE_SET.issuance.obtained).toBe(false);
    expect(DISCLOSURE_SET.issuance.channels.length).toBeGreaterThan(0);
  });
});

describe('the register reconciliation actually fires', () => {
  const set: DisclosureDocument[] = [
    { slug: 'alpha', name: 'Alpha' },
    { slug: 'beta', name: 'Beta' },
  ];

  it('agrees when the pair agrees', () => {
    const entries = [{ slug: 'alpha' }, { slug: 'beta' }];
    expect(documentsWithNoEntry(set, entries)).toEqual([]);
    expect(entriesWithNoDocument(set, entries)).toEqual([]);
  });

  it('catches a mandated document with no entry', () => {
    expect(documentsWithNoEntry(set, [{ slug: 'alpha' }])).toEqual(['beta']);
  });

  it('catches an entry for something nobody mandated', () => {
    expect(
      entriesWithNoDocument(set, [
        { slug: 'alpha' },
        { slug: 'beta' },
        { slug: 'invented' },
      ])
    ).toEqual(['invented']);
  });
});

describe('every municipal URL a page cites was actually retrieved', () => {
  /*
   * The provenance rule, made checkable at last. A page may cite the
   * municipality only at an address this project has retrieved, dated and
   * checksummed — otherwise "retrieved 2026-08-09" is a claim about a fetch
   * nobody can show happened.
   *
   * Scoped to tago.gov.ph on purpose: a national agency's page is cited with
   * its URL and date but is not archived here, and pretending otherwise would
   * be the same overclaim in the other direction.
   */
  const inventoried = new Set<string>();
  for (const file of [
    'site-pages.yaml',
    'phase3-pages.yaml',
    'charter-documents.yaml',
  ]) {
    const text = readFileSync(path.join(ROOT, 'inventory', file), 'utf8');
    for (const [url] of text.matchAll(/https:\/\/tago\.gov\.ph\/[^\s"']+/g)) {
      inventoried.add(url.replace(/[),.]+$/, ''));
    }
  }

  const cited = new Set<string>();
  for (const manifest of MANIFESTS) {
    for (const [url] of manifest.text.matchAll(
      /https:\/\/tago\.gov\.ph\/[^\s"']+/g
    )) {
      cited.add(url.replace(/[),.]+$/, ''));
    }
  }

  it('is reading both sides', () => {
    expect(inventoried.size).toBeGreaterThan(30);
    expect(cited.size).toBeGreaterThan(10);
  });

  it('cites no municipal address that appears in no inventory', () => {
    expect([...cited].filter(url => !inventoried.has(url))).toEqual([]);
  });
});

/**
 * CONT-402 · CONT-401 — the whole corpus, in both languages, with a cadence.
 *
 * These are the first checks in this project that sweep EVERY page rather than
 * a section. That is the point of Wave 6: the failures they catch are ones no
 * per-page review would ever see, because each page is individually fine.
 */
describe('Filipino coverage is complete', () => {
  const english = PAGES.filter(page => !page.path.endsWith('.fil.md'));
  const filipino = new Set(
    PAGES.filter(page => page.path.endsWith('.fil.md')).map(page => page.path)
  );

  it('is reading the whole tree', () => {
    expect(english.length).toBeGreaterThan(100);
  });

  it('has a Filipino body for every English page', () => {
    // CONT-402 criterion 1, measured rather than claimed.
    const untranslated = english
      .filter(page => !filipino.has(page.path.replace(/\.md$/, '.fil.md')))
      .map(page => page.path);
    expect(untranslated).toEqual([]);
  });

  it('reaches 100%, and says so as a number', () => {
    expect(filipino.size).toBe(english.length);
  });

  it('leaves no Filipino page without an English counterpart', () => {
    const orphans = [...filipino]
      .filter(
        p => !english.some(e => e.path === p.replace(/\.fil\.md$/, '.md'))
      )
      .sort();
    expect(orphans).toEqual([]);
  });

  it('labels every Filipino page as an unreviewed draft', () => {
    /*
     * 🔴 CONT-402 criterion 2 CANNOT close — the Translator role is vacant, so
     * not one of these has been read by a fluent speaker. A page that does not
     * say so reads as though it had been, which is the difference between a
     * draft and a claim.
     *
     * When the role is filled and a page is reviewed, its notice comes off in
     * a diff somebody reviews — deliberately, one page at a time.
     */
    const unlabelled = [...filipino]
      .filter(
        p => !PAGES.find(page => page.path === p)?.text.includes('**Paunawa:**')
      )
      .sort();
    expect(unlabelled).toEqual([]);
  });

  it('🔴 carries no paragraph that was never actually translated', () => {
    /*
     * File existence is not translation, and this test exists because the
     * first Filipino sweep produced pages whose unique prose was still
     * English under translated headings — 26 of them. A whole-page similarity
     * check missed it, because a page can be 70% Filipino boilerplate and
     * still open with an English paragraph nobody translated.
     *
     * So this looks at LINES. A long sentence dense in English function words
     * and empty of Filipino ones has not been translated, whatever the rest
     * of the page looks like.
     *
     * Terms of art, office names, document titles and URLs stay English by
     * rule — hence the length floor and the requirement for FIVE English
     * markers, which a phrase like "Business Licensing and Permitting
     * Division" cannot reach on its own.
     *
     * 🔴 EXTENDED 2026-08-10, when the charter's contents came into scope.
     * A transcribed requirement, step or fee is carried through in the
     * document's own English on BOTH locales, deliberately: a requirement is
     * what the counter will ask for by name, and "Certificate of Live Birth"
     * rendered into Filipino is a phrase no clerk will recognise. Those lines
     * arrive as table rows (already skipped, they start `|`) and as ordered
     * list items, which is why `^\d+\.` joins the skip set. The project's own
     * prose around them is still swept, and that is what this check is for.
     */
    const ENGLISH =
      /\b(the|is|are|was|were|of|and|that|which|with|from|this|these|does|not|for|it)\b/gi;
    const FILIPINO =
      /\b(ang|ng|sa|ay|mga|hindi|para|ito|kung|nang|nito|iyon|bawat|walang)\b/gi;

    const untranslated: string[] = [];
    for (const page of PAGES.filter(p => p.path.endsWith('.fil.md'))) {
      for (const raw of page.text.split('\n')) {
        const line = raw.trim();
        if (line.length < 60) continue;
        // An INDENTED line continues a list item — in practice the second and
        // third lines of a transcribed step. Tested on the raw line, because
        // `line` has already been trimmed.
        if (/^\s/.test(raw)) continue;
        // A LIST MARKER of any shape opens a transcribed charter item, and the
        // charter writes `1.Original` with no space after the dot as often as
        // `1. Original`, so the space is not required. `1\.` is the escaped
        // form used where a list does not count up and markdown would renumber
        // it — see scripts/charter-pages.mjs.
        if (
          /^[-#>|]|^\d{1,2}\\?[.)]|^[•·▪◦*]|```/.test(line) ||
          line.includes('http')
        )
          continue;
        const english = line.match(ENGLISH)?.length ?? 0;
        const filipino = line.match(FILIPINO)?.length ?? 0;
        if (english >= 5 && filipino <= 1) {
          untranslated.push(`${page.path}: ${line.slice(0, 60)}…`);
        }
      }
    }
    expect(untranslated).toEqual([]);
  });

  it('fires on a Filipino page left in English', () => {
    const ENGLISH =
      /\b(the|is|are|was|were|of|and|that|which|with|from|this|these|does|not|for|it)\b/gi;
    const FILIPINO =
      /\b(ang|ng|sa|ay|mga|hindi|para|ito|kung|nang|nito|iyon|bawat|walang)\b/gi;
    const doctored =
      'The annual budget is the document that says how much the municipality plans to spend.';
    expect((doctored.match(ENGLISH) ?? []).length).toBeGreaterThanOrEqual(5);
    expect((doctored.match(FILIPINO) ?? []).length).toBeLessThanOrEqual(1);

    // And the other direction: a real translated line must NOT trip it.
    const real =
      'Ang taunang badyet ang dokumentong nagsasabi kung magkano ang balak gastusin ng munisipyo.';
    expect((real.match(FILIPINO) ?? []).length).toBeGreaterThan(1);
  });

  it('adds no Surigaonon locale', () => {
    // CONT-402 criterion 5. Starting it without a fluent speaker would ship an
    // unreviewed locale, which is the thing the Filipino side already is and
    // is not a reason to do it twice.
    const other = PAGES.filter(page =>
      /\.(sgd|sur|surigaonon)\.md$/.test(page.path)
    );
    expect(other).toEqual([]);
    const messages = readFileSync(
      path.join(ROOT, 'messages', 'fil.json'),
      'utf8'
    );
    expect(messages.length).toBeGreaterThan(100);
    expect(existsSync(path.join(ROOT, 'messages', 'sgd.json'))).toBe(false);
  });
});

describe('every page declares a cadence, and no check date is invented', () => {
  const entries = MANIFESTS.flatMap(manifest => {
    const parsed = manifestSchema.parse(yaml.load(manifest.text));
    return parsed.pages.map(page => ({ page, manifest: manifest.path }));
  });

  const BASELINE = yaml.load(
    readFileSync(path.join(ROOT, 'inventory', 'check-dates.yaml'), 'utf8')
  ) as { takenAt: string; pages: Record<string, string> };

  it('is reading the whole tree', () => {
    expect(entries.length).toBeGreaterThan(100);
    expect(Object.keys(BASELINE.pages).length).toBe(entries.length);
  });

  it('declares a data class on every entry', () => {
    // Guaranteed by the schema; asserted anyway, because "the schema covers
    // it" is how a loosened schema goes unnoticed.
    expect(
      entries.filter(({ page }) => !DATA_CLASSES.includes(page.dataClass))
    ).toEqual([]);
  });

  it('carries no check date in the future', () => {
    const today = BASELINE.takenAt;
    const ahead = entries
      .filter(({ page }) => page.lastCheckedAt > today)
      .map(({ page }) => page.slug);
    expect(ahead).toEqual([]);
  });

  it('nothing is stale yet, and that is a fact about age rather than about care', () => {
    const today = BASELINE.takenAt;
    const stale = entries
      .filter(
        ({ page }) =>
          freshnessOf(page.dataClass, page.lastCheckedAt, today) === 'stale'
      )
      .map(({ page }) => page.slug);
    expect(stale).toEqual([]);
  });

  it('🔴 lets no check date advance past the baseline without a recorded review', () => {
    /*
     * CONT-401 criterion 5, and the only mechanism in this repository that can
     * actually enforce it. A check date moved without a check is a falsified
     * record: it converts "nobody has looked" into "somebody looked and it is
     * still true", which is a different and false claim.
     *
     * Prose cannot stop that. This can: the baseline is committed, it is
     * regenerated only by a deliberate `npm run freshness -- --baseline`, and
     * a date that moves past it must arrive with a `lastReview` naming the
     * role that did the checking.
     */
    const falsified: string[] = [];
    for (const { page, manifest } of entries) {
      const key = `${path.dirname(manifest).replace(/^content\//, '')}/${page.slug}`;
      const recorded = BASELINE.pages[key];
      if (recorded === undefined) {
        falsified.push(
          `${key}: not in the baseline — regenerate it deliberately`
        );
        continue;
      }
      if (page.lastCheckedAt > recorded && page.lastReview === null) {
        falsified.push(
          `${key}: ${recorded} → ${page.lastCheckedAt} with no lastReview`
        );
      }
    }
    expect(falsified).toEqual([]);
  });

  it('🔴 keeps the generated report agreeing with the tested computation', () => {
    /*
     * The staleness thresholds exist TWICE. `src/lib/freshness.ts` is the
     * contract and is unit-tested; `scripts/freshness.mjs` re-implements them
     * inline, because a `.mjs` script cannot import the TypeScript module —
     * and the script is the copy that writes the report a maintenance owner
     * actually reads.
     *
     * Two implementations of one rule drift, and this one would drift
     * silently: the report would go on looking authoritative while disagreeing
     * with the contract. So the two are pinned to each other here. If somebody
     * changes a cadence in one place and not the other, this goes red.
     *
     * The real fix is one implementation. Until a `.mjs` core shared by both
     * is worth the refactor, this is the check that makes the duplication
     * safe rather than merely known.
     */
    const report = readFileSync(
      path.join(ROOT, 'inventory', 'freshness-report.md'),
      'utf8'
    );

    const claimed = report.match(
      /against (\d+) published pages in (\d+) manifests/
    );
    expect(claimed, 'the report does not state its own totals').not.toBeNull();
    expect(Number(claimed![1])).toBe(entries.length);
    expect(Number(claimed![2])).toBe(MANIFESTS.length);

    const today = BASELINE.takenAt;
    const computed = entries.map(({ page }) =>
      freshnessOf(page.dataClass, page.lastCheckedAt, today)
    );
    const overdue = computed.filter(s => s === 'stale' || s === 'due').length;
    const future = computed.filter(s => s === 'undated').length;

    // The report names pages needing review individually; when there are none
    // it says so in prose. Either way the two must agree on the count.
    const listed = [...report.matchAll(/^\| `[a-z0-9-]+` \| `/gm)].length;
    expect(listed).toBe(overdue);
    expect(report.includes('Check dates in the future')).toBe(future > 0);
  });

  it('records no review at all yet, which is the honest state', () => {
    // Nothing has been re-checked since it was written. A lastReview appearing
    // is the tripwire: it means somebody did the work, and this assertion is
    // then deleted deliberately rather than quietly loosened.
    expect(entries.filter(({ page }) => page.lastReview !== null)).toEqual([]);
  });
});

describe('the history timeline', () => {
  /*
   * Loaded and validated directly here, mirroring every other record above:
   * `content.ts` imports `next/cache` and cannot be unit-tested, so the tree
   * is read straight off disk against the same schema the loader uses.
   */
  const TIMELINE_PATH = path.join(CONTENT, 'home', 'history', 'timeline.yaml');

  function loadTimeline() {
    const raw = readFileSync(TIMELINE_PATH, 'utf8');
    const parsed = timelineSchema.safeParse(yaml.load(raw));
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
    return parsed.data;
  }

  it('exists and validates against the schema', () => {
    expect(existsSync(TIMELINE_PATH)).toBe(true);
    expect(() => loadTimeline()).not.toThrow();
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work.
    const doctored = { source: { url: 'https://example.invalid' } };
    expect(timelineSchema.safeParse(doctored).success).toBe(false);
  });

  it('carries at least six entries, each with both locales complete', () => {
    const timeline = loadTimeline();
    expect(timeline.entries.length).toBeGreaterThanOrEqual(6);

    for (const entry of timeline.entries) {
      expect(entry.title.en.length).toBeGreaterThan(0);
      expect(entry.title.fil.length).toBeGreaterThan(0);
      expect(entry.body.en.length).toBeGreaterThan(0);
      expect(entry.body.fil.length).toBeGreaterThan(0);
      // Never a pre-formatted English date string — a bare 4-digit year or a
      // full ISO calendar date, so `dates.ts` can format it per locale.
      expect(entry.period).toMatch(/^\d{4}(-\d{2}-\d{2})?$/);
    }
  });

  it('reaches `V3` — a primary source, not a paraphrase of one', () => {
    // The whole reason this timeline can name anyone at all: it is read from,
    // and checked against, the municipality's own history page directly.
    const timeline = loadTimeline();
    expect(timeline.verification).toBe('V3');
    expect(timeline.source.url).toBe('https://tago.gov.ph/about-us-2/history/');
  });

  it('mixes milestone and non-milestone entries', () => {
    // The mix is what exercises both markers on the rail — a timeline that is
    // all one or the other never renders the branch it does not use.
    const milestones = loadTimeline().entries.map(entry => entry.milestone);
    expect(milestones.some(Boolean)).toBe(true);
    expect(milestones.some(value => !value)).toBe(true);
  });

  describe('🔴 named historical figures stay inside content/', () => {
    /*
     * Root rule 13's carve-out is narrow by design: a historical figure
     * already in a cited public record may be named in `content/`, and ONLY
     * there. This asserts the carve-out was not read as a licence to mention
     * a name anywhere convenient — not in the component that renders this
     * file, not in another component, not in a comment, not in a test
     * fixture, not in a message string.
     *
     * The candidates are extracted from the loaded content rather than
     * hardcoded here, so a future edit to a name cannot silently
     * desynchronise this guardrail from the record it is guarding. The
     * extraction is a two-or-three-capitalised-word pattern, which is
     * slightly broader than "person names" — it also catches phrases like
     * "Executive Order" or "Philippine Revolution". That is fine: checking a
     * few institutional phrases costs nothing, and the two names that matter
     * (Francis Burton Harrison, Catalino Pareja — named here in this comment
     * only to explain the test, never as a literal string the test itself
     * matches against) are guaranteed to be swept up by the same pattern.
     */
    const CANDIDATES = loadTimeline()
      .entries.flatMap(entry => [entry.body.en, entry.body.fil])
      .join(' ')
      .match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}\b/g)
      /*
       * The pattern above cannot tell a person's name from a two-or-three-word
       * INSTITUTIONAL phrase — "Executive Order No", "Provincial Board",
       * "Philippine Revolution", "Municipal President" all match it too, and
       * every one of those is legitimate, expected content in
       * `messages/en.json → history.intro`, which explains in prose why this
       * timeline names anyone at all. None of them is a person, so none of
       * them belongs in a check for whether a PERSON'S name leaked out of
       * content/. This denylist is words that mark an institution or a role
       * rather than a name — not an escape hatch for an actual leaked name,
       * which would not contain any of them.
       */
      ?.filter(
        phrase =>
          !/\b(?:Order|Revolution|Board|Town|Lungsod|Municipal|Government|History|Municipality|Provincial|Philippine)\b/.test(
            phrase
          )
      );

    it('found candidate phrases to check — the check is not a no-op', () => {
      expect(CANDIDATES).not.toBeNull();
      expect(CANDIDATES!.length).toBeGreaterThan(0);
    });

    it('candidate phrases appear nowhere in src/, only in content/', () => {
      // `sourceFilesIn` already excludes every `.test.ts`/`.spec.ts` file, this
      // one included — no self-match to filter out by hand.
      const SRC_FILES = sourceFilesIn(path.join(ROOT, 'src'));
      for (const phrase of new Set(CANDIDATES)) {
        const offenders = hits(
          SRC_FILES,
          new RegExp(phrase.replace(/\s/g, '\\s+'))
        );
        expect(offenders, `"${phrase}" appears in src/`).toEqual([]);
      }
    });

    it('candidate phrases appear nowhere in messages/, only in content/', () => {
      for (const locale of ['en', 'fil']) {
        const text = readFileSync(
          path.join(ROOT, 'messages', `${locale}.json`),
          'utf8'
        );
        for (const phrase of new Set(CANDIDATES)) {
          expect(
            text.includes(phrase),
            `"${phrase}" appears in messages/${locale}.json`
          ).toBe(false);
        }
      }
    });
  });
});

describe('the getting-here cards', () => {
  const TRAVEL_PATH = path.join(CONTENT, 'home', 'getting-here', 'routes.yaml');

  function loadTravel() {
    const raw = readFileSync(TRAVEL_PATH, 'utf8');
    const parsed = travelSchema.safeParse(yaml.load(raw));
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
    return parsed.data;
  }

  it('exists and validates against the schema', () => {
    expect(existsSync(TRAVEL_PATH)).toBe(true);
    expect(() => loadTravel()).not.toThrow();
  });

  it('fires on a doctored fixture', () => {
    // A guardrail that has never gone red is not known to work.
    expect(travelSchema.safeParse({ cards: [] }).success).toBe(false);
  });

  it('carries four cards, each complete in both locales', () => {
    const travel = loadTravel();
    expect(travel.cards).toHaveLength(4);

    for (const card of travel.cards) {
      for (const field of [card.kicker, card.title, card.body]) {
        expect(field.en.length).toBeGreaterThan(0);
        expect(field.fil.length).toBeGreaterThan(0);
        // A Filipino string identical to its English is an untranslated field
        // wearing a translation's clothes — the fallback banner cannot see it.
        expect(field.fil).not.toBe(field.en);
      }
    }
    expect(travel.summary.fil).not.toBe(travel.summary.en);
  });

  it('promotes exactly one card to the inverse surface', () => {
    // The arrival card. Two would stop it reading as the odd one out; none
    // would leave four identical boxes a reader skims past.
    const inverse = loadTravel().cards.filter(c => c.surface === 'inverse');
    expect(inverse).toHaveLength(1);
    expect(inverse[0].kicker.en.toLowerCase()).toContain('here');
  });

  it('🔴 states no timetable, fare or schedule', () => {
    /*
     * The card set is ORIENTATION only, and the schema deliberately cannot
     * carry a departure time or a price: those change without notice, would
     * each need their own citation, and this file has one shared source and a
     * slow cadence.
     *
     * This scans for the shapes a schedule takes — a clock time, a peso
     * amount, a "daily/hourly" frequency claim — so the constraint is enforced
     * rather than merely intended. The one duration that IS present
     * ("roughly 13 minutes") is a journey length, not a departure time, and is
     * flagged in the file's own header for confirmation.
     */
    const travel = loadTravel();
    const prose = travel.cards
      .flatMap(c => [c.body.en, c.body.fil, c.title.en, c.title.fil])
      .join(' ');

    expect(prose).not.toMatch(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i);
    expect(prose).not.toMatch(/₱\s*\d/);
    expect(prose).not.toMatch(/\bevery\s+\d+\s+(?:minutes?|hours?)\b/i);
  });

  it('records its level, and does not overclaim it', () => {
    // Supplied rather than read off a published transport record.
    const travel = loadTravel();
    expect(travel.verification).toBe('V0');
    expect(travel.source.url).toBeNull();
  });
});
