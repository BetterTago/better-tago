import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { charterManifestSchema, type CharterRecord } from './content-schema';
import { REPO_ROOT as ROOT, filesMatching } from './file-scan';

/**
 * ★ TAGO-203 — the transcription checks that live in the BUILD rather than in a
 * checklist.
 *
 * A transcription error in a fee is indistinguishable from a lie to the person
 * who paid it. These checks cannot tell whether a figure is RIGHT — only a
 * second human reading the PDF can do that, which is CONT-212 and is blocked on
 * a vacant Verifier role. What they can do is make it impossible to ship a page
 * that skipped the process:
 *
 *   Tier 1 · COMPLETENESS — every token of the source document appears
 *            somewhere in the markdown derived from it. Nothing was summarised
 *            away.
 *   Tier 2 · NO MUTATION — every figure on a page appears byte-identically in
 *            the document it cites, and every figure in the record appears on
 *            its page. Nothing was rounded, reformatted or modernised.
 *
 * WHY THE EXTRACTED YAML AND NOT THE PDF. The archived PDFs are git-ignored —
 * they are the municipality's documents and this project does not redistribute
 * them — so a clone has no PDFs and a check that needed them would be skipped
 * on CI, which is the same as not existing. `inventory/charter-transcripts/`
 * is the committed, byte-faithful record of what came out of each one, written
 * by `scripts/charter-extract.mjs` and never edited by hand. Comparing against
 * it proves the generator did not mutate anything on the way to the page; the
 * checksum in every record is what ties that record back to the exact copy.
 */

const CONTENT = path.join(ROOT, 'content');
const TRANSCRIPTS = path.join(ROOT, 'inventory', 'charter-transcripts');

type ExtractedService = {
  id: string;
  section: string;
  charterTitle: string | null;
  requirements: { item: string | null; whereToSecure: string | null }[];
  steps: Record<string, string | undefined>[];
  fees: string[];
  processingTimes: string[];
  total: { fee: string | null; processingTime: string | null } | null;
  text: string[];
  confidence: string;
};

type ExtractedDocument = {
  document: string;
  sha256: string;
  services: ExtractedService[];
};

const DOCUMENTS: ExtractedDocument[] = existsSync(TRANSCRIPTS)
  ? filesMatching(TRANSCRIPTS, /\.yaml$/).map(
      file => yaml.load(file.text) as ExtractedDocument
    )
  : [];

const SERVICES = new Map(
  DOCUMENTS.flatMap(document =>
    document.services.map(service => [service.id, service])
  )
);

const CHARTER_MANIFESTS = filesMatching(CONTENT, /^index\.yaml$/).filter(
  file =>
    file.path.startsWith('content/services/') ||
    file.path.startsWith('content/government/legislative/')
);

const RECORDS: CharterRecord[] = CHARTER_MANIFESTS.flatMap(
  file => (yaml.load(file.text) as { pages: CharterRecord[] }).pages
);

const PAGES = new Map(
  filesMatching(CONTENT, /\.md$/)
    .filter(file => !file.path.endsWith('README.md'))
    .map(file => [file.path, file.text])
);

const pageFor = (record: CharterRecord, locale: 'en' | 'fil') => {
  const suffix = locale === 'fil' ? '.fil.md' : '.md';
  for (const [file, text] of PAGES) {
    if (file.endsWith(`/${record.slug}${suffix}`)) return text;
  }
  return null;
};

describe('the integrity scan itself', () => {
  it('is reading both sides', () => {
    // A scan that silently reads nothing turns every check below into a green
    // no-op, which is worse than no check because it looks tended.
    expect(DOCUMENTS.length).toBe(22);
    expect(SERVICES.size).toBe(167);
    expect(RECORDS.length).toBeGreaterThan(90);
    expect(PAGES.size).toBeGreaterThan(100);
  });

  it('has a transcript for every archived charter document', () => {
    const inventory = yaml.load(
      readFileSync(
        path.join(ROOT, 'inventory', 'charter-documents.yaml'),
        'utf8'
      )
    ) as { documents: { file: string }[] };

    const extracted = new Set(DOCUMENTS.map(document => document.document));
    const missing = inventory.documents
      .map(document => document.file)
      .filter(file => !extracted.has(file));

    expect(missing).toEqual([]);
  });
});

/** Every fee-shaped string, in the notations this archive actually prints. */
const FEE =
  /₱\s?[\d,]+(?:\.\d{2})?|\bPHP\s?[\d,]+(?:\.\d{2})?|\bPhp\.?\s?[\d,]+(?:\.\d{2})?|\bP\s?[\d,]+\.\d{2}|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

const figuresIn = (text: string) => new Set(text.match(FEE) ?? []);

describe('Tier 2 · no figure was rounded, reformatted or modernised', () => {
  /*
   * ★ TAGO-202 criterion 3: a fee is carried through byte-for-byte or the draft
   * fails. The archive prints `P 1,000.00`, `P1250.00`, `Php200.00`,
   * `Php. 100.00` and `PHP100.00`, several of them inside one document. That
   * inconsistency is DATA — it is what the counter and the form will say — and
   * tidying it into one house style is the single most tempting change anybody
   * will propose to this content, because it looks like an improvement.
   */

  it('states no figure on a page that is not in the document', () => {
    /*
     * The authority is the EXTRACTED DOCUMENT TEXT, not the structured subset
     * of it. A service page now carries the transcription as transcribed —
     * including the completeness block, which is precisely the part the
     * structured fields do not hold — so checking against those fields flagged
     * figures that are in the charter and on the page and correct.
     *
     * What this still catches is the thing worth catching: a figure typed onto
     * a page that is in no document at all.
     */
    const invented: string[] = [];

    for (const record of RECORDS) {
      const body = pageFor(record, 'en');
      const service = SERVICES.get(record.charterServiceId);
      if (!body || !service) continue;

      /*
       * Compared with the SPACES STRIPPED from both sides.
       *
       * A cell legitimately spans lines: the engineering charter breaks
       * "₱ 50.00" across a line boundary, so the `₱` and the `50.00` are two
       * entries in `text` and the figure exists in neither. Matching per line
       * called a real figure invented. Matching on the joined text instead
       * would resurrect the opposite bug — a `P` ending one line and a `2`
       * starting the next reads as `P 2`.
       *
       * Ignoring whitespace on both sides asserts what actually matters: the
       * currency mark and the digits appear in the document, in that order.
       */
      const flattened = service.text.join(' ').replace(/\s+/g, '');

      for (const figure of figuresIn(body)) {
        if (!flattened.includes(figure.replace(/\s+/g, ''))) {
          invented.push(`${record.slug} → ${figure}`);
        }
      }
    }

    expect(invented).toEqual([]);
  });

  it('carries every figure in the record back to the extracted document', () => {
    // The other direction. The check above catches a figure typed onto a page;
    // this catches one typed into a manifest, which no page review would see
    // because the page and the record would agree with each other.
    const untraceable: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      const service = SERVICES.get(record.charterServiceId);
      if (!service) {
        untraceable.push(`${record.slug} → no extracted service`);
        continue;
      }

      const document = new Set<string>();
      for (const source of service.text) {
        for (const figure of figuresIn(source)) document.add(figure);
      }

      for (const source of [
        ...record.content.fees,
        record.content.totalFee ?? '',
        ...record.content.steps.map(step => step.fee ?? ''),
      ]) {
        for (const figure of figuresIn(source)) {
          if (!document.has(figure))
            untraceable.push(`${record.slug} → ${figure}`);
        }
      }
    }

    expect(untraceable).toEqual([]);
  });

  it('keeps the Filipino page carrying the same figures as the English', () => {
    // A translated figure is a wrong figure. The rule is that project prose is
    // translated and charter strings never are.
    const drifted: string[] = [];

    for (const record of RECORDS) {
      const english = pageFor(record, 'en');
      const filipino = pageFor(record, 'fil');
      if (!english || !filipino) continue;

      const there = figuresIn(english);
      for (const figure of figuresIn(filipino)) {
        if (!there.has(figure)) drifted.push(`${record.slug} → ${figure}`);
      }
    }

    expect(drifted).toEqual([]);
  });

  it('fires on a doctored figure', () => {
    /*
     * ★ TAGO-203 criterion 5 — a check that has never gone red is not known to
     * work. This is the exact edit the checks above exist to catch: the
     * document's `P 1,000.00` tidied into the house currency glyph.
     */
    const document = figuresIn('The fee is P 1,000.00 for the first copy.');
    const tidied = figuresIn('The fee is ₱1,000.00 for the first copy.');

    expect([...document]).toEqual(['P 1,000.00']);
    expect([...tidied].every(figure => document.has(figure))).toBe(false);

    // And a rounding, which is the other half of the same rule. Asserted as
    // "the document's figure is no longer there" rather than with `.every`,
    // which an empty set satisfies trivially — the first draft of this test
    // passed on a rounding that removed the figure altogether.
    const rounded = figuresIn('The fee is P 1,000 for the first copy.');
    expect(rounded.has('P 1,000.00')).toBe(false);
    expect([...document].some(figure => !rounded.has(figure))).toBe(true);
  });

  it('does not fire on a date, a count or a cadence', () => {
    // A check that fails on "22 documents" gets deleted in its first week.
    expect(
      figuresIn(
        'Checked on 9 August 2026 across 22 documents, re-checked every 90 days.'
      ).size
    ).toBe(0);
  });
});

describe('Tier 1 · nothing the extraction found is lost on the way to a page', () => {
  /*
   * ⚠️ THIS CHECK MOVED ON 2026-08-10, and the move is a real weakening that is
   * recorded rather than hidden.
   *
   * It used to assert that every TOKEN of a source document appeared in the
   * markdown derived from it — residue zero across all 22 documents. That was
   * only possible because each transcript ended every service with an *Also
   * printed for this service* block holding the fragments the tables did not
   * carry. Those blocks were removed at the project lead's instruction: they
   * read as a pile of loose text under an answer that already said the same
   * thing in a readable shape.
   *
   * 🔴 SO THE PAGES NO LONGER CARRY EVERY FRAGMENT. The DOCUMENT'S FULL TEXT
   * still does — `inventory/charter-transcripts/*.yaml` holds every service
   * line by line, it is committed, and it is what a verifier reads against the
   * PDF. What the build can still prove is the half that protects a resident:
   * nothing the extraction FOUND is dropped between the record and the page.
   */

  const normalise = (text: string) =>
    text
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '');

  const LEDGER = JSON.parse(
    readFileSync(
      path.join(ROOT, 'inventory', 'charter-completeness.json'),
      'utf8'
    )
  ) as {
    services: Record<string, { notRendered: string[] }>;
    totals: { services: number };
  };

  it('🔴 loses no word of any document, across the pages and the ledger', () => {
    /*
     * THE COMPLETENESS GUARANTEE, restored on 2026-08-10.
     *
     * It was zero-residue when every transcript ended a service with an *Also
     * printed for this service* block. Those blocks were removed from both
     * layers — they read as a pile of loose text under an answer that already
     * said the same thing in a readable shape — and the guarantee went with
     * them.
     *
     * `inventory/charter-completeness.json` is where those lines went. It is
     * reference material for a verifier reading against the PDF, it is never
     * rendered and never served, and this is the check that makes deleting it a
     * red build rather than a silent loss.
     *
     * Residue is measured against the UNION of what the pages carry and what
     * the ledger holds. Zero, across all 167 services.
     */
    const tokens = (text: string) =>
      text
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .split(' ')
        .filter(token => token.length > 0);

    // Hoisted: tokenising every page inside the per-service loop is 167 passes
    // over the whole tree, and the test timed out rather than failed.
    const onThePages = new Set<string>();
    for (const [file, text] of PAGES) {
      if (
        file.startsWith('content/charter/documents/') ||
        file.startsWith('content/services/') ||
        file.startsWith('content/government/legislative/')
      ) {
        for (const token of tokens(text)) onThePages.add(token);
      }
    }

    const lost: string[] = [];

    for (const [id, service] of SERVICES) {
      const entry = LEDGER.services[id];
      if (!entry) {
        lost.push(`${id} → no ledger entry`);
        continue;
      }

      const covered = new Set(tokens(entry.notRendered.join(' ')));
      for (const token of onThePages) covered.add(token);

      const missing = [...new Set(tokens(service.text.join(' ')))].filter(
        token => !covered.has(token)
      );
      if (missing.length > 0) {
        lost.push(`${id} → ${missing.slice(0, 5).join(', ')}`);
      }
    }

    expect(lost).toEqual([]);
  });

  it('🔴 keeps a ledger entry for every service, so it cannot be quietly emptied', () => {
    expect(Object.keys(LEDGER.services).length).toBe(SERVICES.size);
    expect(LEDGER.totals.services).toBe(167);
  });

  it('keeps every service’s full text in the committed record', () => {
    // The record is where completeness lives now, so it must actually hold it.
    const empty = [...SERVICES.values()]
      .filter(service => (service.text ?? []).join('').trim().length === 0)
      .map(service => service.id);

    expect(empty).toEqual([]);
    expect(
      [...SERVICES.values()].every(service => service.text.length > 2)
    ).toBe(true);
  });

  it('renders every requirement the record holds', () => {
    const dropped: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      const body = pageFor(record, 'en');
      if (!body) continue;
      const flat = normalise(body);

      for (const requirement of record.content.requirements) {
        if (!flat.includes(normalise(requirement.item))) {
          dropped.push(`${record.slug} → ${requirement.item.slice(0, 48)}`);
        }
      }
    }

    expect(dropped).toEqual([]);
  });

  it('renders every fee and every processing time the record holds', () => {
    // The two fields a resident acts on. A rendering that drops one is the
    // failure this whole feature exists to end.
    const dropped: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      const body = pageFor(record, 'en');
      if (!body) continue;
      const flat = normalise(body);

      for (const value of [
        ...record.content.fees,
        ...record.content.processingTimes,
        record.content.totalFee ?? '',
        record.content.totalProcessingTime ?? '',
      ]) {
        if (value && !flat.includes(normalise(value))) {
          dropped.push(`${record.slug} → ${value}`);
        }
      }
    }

    expect(dropped).toEqual([]);
  });

  it('has a transcript page for every extracted document', () => {
    const stemOf = (document: string) =>
      document
        .replace(/\.pdf$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const missing = DOCUMENTS.filter(
      document =>
        !PAGES.has(`content/charter/documents/${stemOf(document.document)}.md`)
    ).map(document => document.document);

    expect(missing).toEqual([]);
  });

  it('lists every internal service on its transcript, and nowhere else', () => {
    /*
     * 68 of the archive's 167 services are government-to-government. They have
     * no resident counter and never enter content/services/ — the transcript is
     * the only place they appear, which is why it exists at all.
     */
    const internal = [...SERVICES.values()].filter(
      service => service.section === 'internal'
    );
    expect(internal.length).toBe(68);

    const taskPages = [...PAGES.entries()]
      .filter(([file]) => file.startsWith('content/services/'))
      .map(([, text]) => normalise(text))
      .join('');

    // A title that is only in the charter's internal section must not appear on
    // any task page.
    const leaked = internal
      .filter(
        service => service.charterTitle && service.charterTitle.length > 24
      )
      .filter(service => taskPages.includes(normalise(service.charterTitle!)))
      .map(service => service.id);

    expect(leaked).toEqual([]);
  });

  it('fires on a dropped requirement', () => {
    // A check that has never gone red is not known to work.
    const page = normalise('Bring the birth certificate.');
    expect(page.includes(normalise('Certificate of Live Birth'))).toBe(false);
  });
});

describe('a transcribed page is at V2 or better, and says it is unverified', () => {
  /*
   * PROG-101's floor: fees, deadlines and requirements ship at `V2` or better,
   * never `V1`. The schema refuses the record; this asserts the tree agrees, so
   * the rule is checked where a contributor edits rather than only where a
   * developer runs zod.
   */

  it('publishes no transcribed figure below V2', () => {
    const weak = RECORDS.filter(
      record =>
        record.content !== null && !['V3', 'V2'].includes(record.verification)
    ).map(record => record.slug);
    expect(weak).toEqual([]);
  });

  it('claims no second-person verification while the Verifier role is vacant', () => {
    /*
     * The tripwire, not a build failure — deliberately. With the role vacant no
     * page can carry a valid record, so failing on a MISSING one would fail on
     * all of them and leave two ways out: fake a record, or delete the check.
     * This goes red on the day the first honest one appears, which is the day
     * somebody should be reading this file anyway.
     */
    expect(
      RECORDS.filter(record => record.verificationRecord !== null)
    ).toEqual([]);
  });

  it('says on every transcribed page that nobody has checked it', () => {
    // The rendered half. A resident about to pay a fee is told, on the page,
    // that one person read it off a PDF and no second person read it back.
    const silent = RECORDS.filter(record => {
      if (!record.content) return false;
      const body = pageFor(record, 'en');
      return body ? !body.includes('not yet checked by a second person') : true;
    }).map(record => record.slug);

    expect(silent).toEqual([]);
  });
});

describe('the record and its manifest agree with the frozen contract', () => {
  it('parses every charter manifest, transcription and all', () => {
    for (const file of CHARTER_MANIFESTS) {
      const parsed = charterManifestSchema.safeParse(yaml.load(file.text));
      expect(parsed.success, `${file.path}: ${parsed.error}`).toBe(true);
    }
  });

  it('joins every record to a real extracted service', () => {
    const orphaned = RECORDS.filter(
      record => !SERVICES.has(record.charterServiceId)
    ).map(record => record.charterServiceId);
    expect(orphaned).toEqual([]);
  });

  it('records the extractor’s confidence for every published service', () => {
    /*
     * ⚠️ This used to REFUSE to publish anything the extractor had not marked
     * `high`, and thirty services said *this page cannot tell you yet* while
     * their transcription sat complete in the record. The page now publishes
     * the transcription as transcribed, so confidence no longer decides whether
     * a resident sees anything.
     *
     * It still decides what a VERIFIER looks at first, so it must be recorded
     * for every one of them.
     */
    const unrecorded = RECORDS.filter(record => {
      const service = SERVICES.get(record.charterServiceId);
      return !service || !['high', 'needs-human'].includes(service.confidence);
    }).map(record => record.slug);

    expect(unrecorded).toEqual([]);
  });

  it('publishes no requirement that carries no information at all', () => {
    /*
     * ⚠️ NARROWED, not skipped, when the page stopped re-sectioning the
     * transcription into *What to bring* and started showing the charter's own
     * checklist table.
     *
     * It used to refuse a list containing a bare bullet or a row continuing
     * mid-sentence. Those are the DOCUMENT'S structure — it sets sub-items on
     * their own lines under a bullet — and refusing them is what withheld
     * thirty services whose transcription was complete. Presented as the
     * charter's own checklist, beside everything else the document prints for
     * that service, they read as what they are.
     *
     * What is still refused is a row with nothing in it: an empty cell, or one
     * holding only punctuation. That is not the document's structure, it is an
     * extraction that dropped a line, and it tells a resident nothing.
     */
    const empty: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      for (const requirement of record.content.requirements) {
        if (!/[\p{L}\p{N}]/u.test(requirement.item)) {
          empty.push(`${record.slug} → ${JSON.stringify(requirement.item)}`);
        }
      }
    }

    expect(empty).toEqual([]);
  });

  it('fires on a doctored requirements list', () => {
    // A check that has never gone red is not known to work.
    const doctored = ['1. Birth Certificate', '•', 'with two witnesses'];
    expect(
      doctored.filter(item => item.length < 5 || /^[•\-–—*]+$/.test(item))
    ).toHaveLength(1);
    expect(doctored.filter(item => /^[a-z(]/.test(item))).toHaveLength(1);
  });

  it("renders the charter's own list numbers, never its own", () => {
    /*
     * 🔴 Markdown renumbers an ordered list. It takes the start from the first
     * item and then counts up, so `1. 2. 3.` survives and `1, 2, 3, 4, 5, 7`
     * does not — and eleven of these lists do not count up. The charter prints
     * one that skips 6, one that starts at 7, and one that reads `1, 1, 1`.
     *
     * Renumbering is silent and it is not cosmetic: a resident may be reading
     * this against the paper form on the counter. So every number the record
     * holds must appear on the page attached to the same requirement.
     */
    const renumbered: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      const body = pageFor(record, 'en');
      if (!body) continue;

      for (const requirement of record.content.requirements) {
        const numbered = requirement.item.match(
          /^\s*(\d{1,2})\s*[.)]\s*(\S.*)$/
        );
        if (!numbered) continue;

        const [, number, text] = numbered;
        /*
         * A LONG prefix, EVERY match considered, and the escaped form allowed.
         *
         * A 24-character prefix collided with a sibling: the zoning
         * certification lists "6. Additional Requirements if prior to…" beside
         * "7. Additional Requirements if Land Classification…", and the check
         * reported a renumbering on a page that was correct. And a
         * non-consecutive list is written `7\.` so markdown renders it
         * literally, so the backslash has to be permitted here.
         */
        const opening = text
          .slice(0, 70)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const onPage = new RegExp(
          `(?:^|\\n)\\s*(\\d{1,2})\\\\?[.)]\\s*${opening}`,
          'gm'
        );
        const found = [...body.matchAll(onPage)].map(match => match[1]);

        if (found.length === 0) continue;
        if (!found.includes(number)) {
          renumbered.push(
            `${record.slug} → charter says ${number}, page says ${found.join('/')}`
          );
        }
      }
    }

    expect(renumbered).toEqual([]);
  });

  it('fires on a renumbered list', () => {
    // A check that has never gone red is not known to work. This is exactly
    // what markdown does to `1, 2, 4` if it is handed to an ordered list.
    const charter = ['1. First', '2. Second', '4. Fourth'];
    const rendered = charter.map((item, index) =>
      item.replace(/^\d+/, String(index + 1))
    );
    const drift = charter.filter((item, index) => item !== rendered[index]);
    expect(drift).toHaveLength(1);
  });

  it('publishes no field whose value is only punctuation', () => {
    /*
     * 🔴 The agriculture office writes `Who may avail?` with a question mark
     * rather than a colon. The label pattern accepted only `:`, matched the
     * label anyway, found the `?` left over and returned it as the value — so
     * ten published pages answered *Who can apply* with **"?"**.
     *
     * A value with no letter and no digit in it is not a value.
     */
    const junk: string[] = [];

    for (const record of RECORDS) {
      if (!record.content) continue;
      for (const [field, value] of Object.entries({
        eligibility: record.content.eligibility,
        classification: record.content.classification,
        typeOfTransaction: record.content.typeOfTransaction,
      })) {
        if (typeof value === 'string' && !/[\p{L}\p{N}]/u.test(value)) {
          junk.push(`${record.slug} → ${field}: ${JSON.stringify(value)}`);
        }
      }
    }

    expect(junk).toEqual([]);
  });

  it('never doubles a list marker the document printed once', () => {
    // Several charters set the numbers in a narrow column of their own AND
    // repeat them in the text. Read as two markers it becomes `1. 1. RSBSA stub`.
    const doubled = RECORDS.filter(record =>
      record.content?.requirements.some(requirement =>
        /^\s*(\d{1,2})\s*\.\s*\1\s*\./.test(requirement.item)
      )
    ).map(record => record.slug);

    expect(doubled).toEqual([]);
  });

  it('lists no fee or duration as a place to obtain a requirement', () => {
    /*
     * Where the requirements run past the steps header the re-read can reach
     * the steps table, and `None`, `3 Minutes` and a named officer were being
     * published under *where the charter says to get them*.
     */
    const misplaced: string[] = [];
    const NOT_A_PLACE =
      /^\s*(?:none|free|n\/a|\d+\s*(?:minutes?|mins?|hours?|hrs?|days?|working\s+days?)|(?:₱|PHP|Php|P)\s?[\d,]+(?:\.\d{2})?)\s*$/i;

    for (const record of RECORDS) {
      if (!record.content) continue;
      for (const value of [
        ...record.content.requirementSources,
        ...record.content.requirements.map(entry => entry.whereToSecure ?? ''),
      ]) {
        if (value && NOT_A_PLACE.test(value)) {
          misplaced.push(`${record.slug} → ${JSON.stringify(value)}`);
        }
      }
    }

    expect(misplaced).toEqual([]);
  });

  it('fires on each of those three', () => {
    // None of them has ever been allowed to pass silently again.
    expect(/[\p{L}\p{N}]/u.test('?')).toBe(false);
    expect(/^\s*(\d{1,2})\s*\.\s*\1\s*\./.test('1. 1. RSBSA stub')).toBe(true);
    expect(/^\s*(?:none|\d+\s*minutes?)\s*$/i.test('3 Minutes')).toBe(true);
  });

  it('records what the charter is silent on, rather than leaving it blank', () => {
    // ★ TAGO-201 criterion 2, restored. Office hours are stated by no document
    // in this archive, so every transcribed record must say so explicitly.
    const unrecorded = RECORDS.filter(
      record =>
        record.content !== null &&
        !record.content.notStated.includes('officeHours')
    ).map(record => record.slug);
    expect(unrecorded).toEqual([]);
  });
});
