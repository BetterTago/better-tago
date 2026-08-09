import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  charterManifestSchema,
  manifestSchema,
  type CharterRecord,
} from './content-schema';
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

describe('the eight-field guide has not crept back in', () => {
  /*
   * The fee scan above is digit-shaped and catches "₱50". It does not catch
   * the likelier version: somebody with the PDF open helpfully adding a
   * "## What to bring" list, which contains no number at all.
   *
   * These are exactly the headings ★ TAGO-004 froze for the service guide —
   * the shape that returns WITH a written permission to republish. Their
   * appearance under content/services/ means somebody started transcribing
   * without one. See ⛔ PROG-003.
   *
   * Anchored to end-of-line on purpose: the page template's own
   * "## What to bring, what it costs, how long it takes" is the deliberate
   * REFUSAL to state any of them, and a looser pattern would fail on it.
   */
  const GUIDE_HEADING =
    /^##[ \t]+(?:Who can apply|What to bring|Where to go|Office hours|Fees|How long it takes|What you get|If something goes wrong)[ \t]*$/m;

  /** Office records legitimately carry `## Office hours` — CONT-103's dated gap. */
  const CHARTER_PAGES = PAGES.filter(
    page =>
      page.path.startsWith('content/services/') ||
      page.path.startsWith('content/government/legislative/')
  );

  it('is actually reading the charter pages', () => {
    expect(CHARTER_PAGES.length).toBeGreaterThan(50);
  });

  it('carries none of the eight headings', () => {
    expect(hits(CHARTER_PAGES, GUIDE_HEADING)).toEqual([]);
  });

  it('fires on a doctored page', () => {
    for (const heading of ['## Fees', '## What to bring', '## Who can apply']) {
      expect(
        hits(
          [
            {
              path: 'fixture',
              text: `# A service\n\n${heading}\n\nSomething.`,
            },
          ],
          GUIDE_HEADING
        ),
        heading
      ).toHaveLength(1);
    }
  });

  it('does not fire on the template’s own refusal heading', () => {
    // The one that would break this check if it were written loosely.
    expect(
      hits(
        [
          {
            path: 'fixture',
            text: '## What to bring, what it costs, how long it takes\n\nThis page does not say.',
          },
        ],
        GUIDE_HEADING
      )
    ).toEqual([]);
  });

  it('leaves the office directory’s own hours heading alone', () => {
    // CONT-103 requires `## Office hours` on all 21 office records, stated as
    // a dated "not stated". Scoping this scan to charter pages is what keeps
    // the two rules from cancelling each other out.
    const offices = PAGES.filter(page =>
      page.path.startsWith('content/government/offices/')
    );
    expect(offices.length).toBe(21);
    expect(hits(offices, /^##[ \t]+Office hours[ \t]*$/m).length).toBe(21);
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

  it('has twenty of them, and they are the recorded twenty', () => {
    const shipped = charterFilipino
      .map(page => path.basename(page.path).replace(/\.fil\.md$/, ''))
      .sort();
    expect(shipped).toEqual([...PRIORITY].sort());
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

  it('publishes no fee in Filipino either', () => {
    // The scan above already covers the whole tree. Asserted separately
    // because a figure is the one thing translation may never change, and a
    // reviewer reading only the English would not catch it.
    expect(
      hits(
        filipinoPages,
        /₱\s?[\d,]+|\bPHP\s?[\d,]+|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/
      )
    ).toEqual([]);
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
