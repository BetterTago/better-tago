import { describe, expect, it } from 'vitest';
import {
  charterManifestSchema,
  charterRecordSchema,
  manifestSchema,
  pageEntrySchema,
  transparencyManifestSchema,
  transparencyRecordSchema,
  verificationRecordSchema,
} from './content-schema';
import { DATA_CLASSES } from './freshness';

/**
 * The content contract is the one thing every page depends on, so these tests
 * are written the pessimistic way round: each one proves the schema REJECTS a
 * plausible mistake. A schema test that only feeds it valid input proves
 * nothing — the schema could be `z.any()` and still pass.
 */

const validEntry = {
  dataClass: 'charter-derived',
  lastReview: null,
  name: 'Renew a business permit',
  slug: 'renew-a-business-permit',
  description: 'What to bring, where to go, what it costs, how long it takes.',
  office: 'Business Licensing and Permitting Division',
  source: {
    label: { en: "Municipality of Tago Citizen's Charter" },
    url: 'https://tago.gov.ph/about-us-2/citizens-charter/',
    documentTitle: 'Business Licensing and Permitting Division',
    documentType: 'pdf',
    retrievedAt: '2026-08-03',
  },
  verification: 'V3',
  lastCheckedAt: '2026-08-03',
};

/** `validEntry` with one required key removed. */
function without(key: keyof typeof validEntry): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...validEntry };
  delete copy[key];
  return copy;
}

describe('a page entry', () => {
  it('accepts a fully cited entry', () => {
    expect(pageEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it('rejects an entry with no source at all', () => {
    // Cite or don't publish. This is the rule the whole project rests on, so
    // it is the one that must be structurally impossible to skip.
    expect(pageEntrySchema.safeParse(without('source')).success).toBe(false);
  });

  it('rejects an entry with no check date', () => {
    // A fact without a date is a fact nobody can tell has gone stale.
    expect(pageEntrySchema.safeParse(without('lastCheckedAt')).success).toBe(
      false
    );
  });

  it('rejects a check date that is not an ISO date', () => {
    const result = pageEntrySchema.safeParse({
      ...validEntry,
      lastCheckedAt: 'August 2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a slug that would not match a filename', () => {
    for (const slug of [
      'Renew A Business Permit',
      'renew_a_business_permit',
      'renew-a-business-permit-',
      'Renew-A-Permit',
    ]) {
      expect(pageEntrySchema.safeParse({ ...validEntry, slug }).success).toBe(
        false
      );
    }
  });

  it('rejects a verification level it does not recognise', () => {
    expect(
      pageEntrySchema.safeParse({ ...validEntry, verification: 'verified' })
        .success
    ).toBe(false);
  });

  it('allows a source with no URL, for a letter or a posted notice', () => {
    const result = pageEntrySchema.safeParse({
      ...validEntry,
      source: {
        ...validEntry.source,
        url: null,
        documentType: 'notice',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a source URL that is not a URL', () => {
    const result = pageEntrySchema.safeParse({
      ...validEntry,
      source: { ...validEntry.source, url: 'tago.gov.ph' },
    });
    expect(result.success).toBe(false);
  });
});

describe('a verification record', () => {
  /*
   * The two-person rule is the load-bearing rule of the verification standard,
   * and the one most tempting to skip with one contributor and a page nearly
   * finished. These fixtures are deliberately synthetic — a handle that looks
   * like a real contributor is how an unversioned claim about a real person
   * gets into a test file and stays there.
   */
  const validRecord = {
    collectedBy: 'handle-one',
    verifiedBy: 'handle-two',
    verifiedAt: '2026-08-09',
  };

  it('accepts a record checked by a second person', () => {
    expect(verificationRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  it('rejects a record whose collector verified their own work', () => {
    // The whole point. A transcription error in a fee is indistinguishable
    // from a lie to the person who paid it, and the person who made the error
    // is the person least able to see it.
    const result = verificationRecordSchema.safeParse({
      ...validRecord,
      verifiedBy: validRecord.collectedBy,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty collector', () => {
    expect(
      verificationRecordSchema.safeParse({ ...validRecord, collectedBy: '' })
        .success
    ).toBe(false);
  });

  it('rejects an empty verifier', () => {
    // Separate from the case above on purpose: one "a required field is
    // missing" test would not prove both halves of the record are enforced.
    expect(
      verificationRecordSchema.safeParse({ ...validRecord, verifiedBy: '' })
        .success
    ).toBe(false);
  });

  it('rejects a verification date that is not an ISO date', () => {
    expect(
      verificationRecordSchema.safeParse({
        ...validRecord,
        verifiedAt: 'last August',
      }).success
    ).toBe(false);
  });

  it('rejects a handle that could be a personal name or an address', () => {
    // Contributing requires no personal information, and the handle format is
    // what keeps that structural rather than remembered.
    for (const collectedBy of [
      'Two Words',
      'someone@example.org',
      'Capitalised',
      'trailing-',
      'under_score',
    ]) {
      expect(
        verificationRecordSchema.safeParse({ ...validRecord, collectedBy })
          .success
      ).toBe(false);
    }
  });
});

describe('a manifest', () => {
  it('accepts a list of entries', () => {
    expect(manifestSchema.safeParse({ pages: [validEntry] }).success).toBe(
      true
    );
  });

  it('rejects a manifest with no pages key', () => {
    expect(manifestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a manifest whose entries are bare strings', () => {
    expect(
      manifestSchema.safeParse({ pages: ['renew-a-business-permit'] }).success
    ).toBe(false);
  });
});

/**
 * ★ TAGO-201 — the charter-service record.
 *
 * Same pessimism as above, and one extra reason for it: this record is
 * authored ninety-nine times. A mistake a reviewer would catch once is a
 * mistake that ships eighty-eight more times, so every rule below is one the
 * parser enforces rather than one a contributor remembers.
 */
const validCharterRecord = {
  ...validEntry,
  charterServiceId:
    'business-licensing-and-permitting-division-external-services#external-3',
  charterSection: 'external',
  charterDocument: {
    title: 'Business Licensing and Permitting Division External Services',
    file: 'Business-Licensing-and-Permitting-Division-External-Services.pdf',
    sha256: '0000000000000000000000000000000000000000000000000000000000000000',
  },
  charterTitle: 'Processing of Application for Business Permit Renewal',
  charterTitleSource: 'extracted',
  group: 'business-permit',
  ambiguity: null,
  ambiguityFil: null,
  transcriptionNote: null,
  verificationRecord: null,
  content: null,
};

/** The charter's contents, as the extractor emits them for a clean service. */
const validCharterContent = {
  eligibility: 'All New Business Taxpayers within Tago, Surigao del Sur',
  classification: 'Simple',
  typeOfTransaction: 'G2B – Government to Business',
  requirements: [
    {
      item: '1. Barangay Business Clearance (original copy)',
      marked: true,
      whereToSecure: 'Barangay Hall',
    },
  ],
  requirementSources: [],
  steps: [
    {
      clientStep: 'Submit the requirements',
      agencyAction: 'Receive and check',
      fee: 'P 1,000.00',
      processingTime: '15 Minutes',
      personResponsible: 'Licensing Staff',
    },
  ],
  totalFee: 'P 1,000.00',
  totalProcessingTime: '15 Minutes',
  fees: ['P 1,000.00'],
  processingTimes: ['15 Minutes'],
  mergedColumns: [],
  columnsNamedBy: { fee: 'content', processingTime: 'content' },
  proseColumnsTrusted: true,
  stepsAreStructured: true,
  extractionFlags: [],
  notStated: ['whereToGo', 'officeHours', 'output'],
};

describe('a charter record', () => {
  it('accepts a fully cited, unverified record', () => {
    expect(charterRecordSchema.safeParse(validCharterRecord).success).toBe(
      true
    );
  });

  it('accepts a record carrying the charter’s contents', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        content: validCharterContent,
      }).success
    ).toBe(true);
  });

  it('refuses transcribed contents below V2', () => {
    /*
     * PROG-101's floor as a property of the data. Fees, deadlines and
     * requirements ship at `V2` or better — never `V1`. Two secondary sources
     * agreeing is how a fee that changed years ago stays alive on ten websites,
     * and this record now carries all three of the fields that rule names.
     */
    for (const verification of ['V1', 'V0']) {
      expect(
        charterRecordSchema.safeParse({
          ...validCharterRecord,
          verification,
          content: validCharterContent,
        }).success,
        verification
      ).toBe(false);
    }
  });

  it('still accepts a weak level on a record that transcribes nothing', () => {
    // The floor is about what the page STATES. An index-and-link record makes
    // no claim about a fee, so the rule has nothing to bite on.
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        verification: 'V1',
        content: null,
      }).success
    ).toBe(true);
  });

  it('refuses a partially filled transcription', () => {
    // Whole or null. A page showing three of five requirements is more
    // dangerous than one showing none, because it looks complete.
    const { requirements, ...partial } = validCharterContent;
    expect(requirements).toBeDefined();
    expect(
      charterRecordSchema.safeParse({ ...validCharterRecord, content: partial })
        .success
    ).toBe(false);
  });

  it('refuses an ambiguity that renders in one locale only', () => {
    // A Filipino page showing an English paragraph under a translated heading
    // is the failure CONT-402 exists to catch, and it is invisible to anyone
    // reviewing the English.
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        ambiguity:
          'The charter carries two entries and does not say what separates them.',
        ambiguityFil: null,
      }).success
    ).toBe(false);
  });

  it('rejects an internal service outright', () => {
    // The worst outcome available in this tree: a resident sent to a counter
    // for something only another office can request.
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        charterSection: 'internal',
        charterServiceId: 'municipal-accounting-office#internal-6',
      }).success
    ).toBe(false);
  });

  it('rejects a section that disagrees with the inventory id', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        charterServiceId: 'municipal-accounting-office#internal-6',
      }).success
    ).toBe(false);
  });

  it('rejects an id that is not an inventory id', () => {
    // The charter's own printed number is not unique; joining on it
    // mis-assigns one service's title to another. See inventory/README.md.
    for (const id of ['3', 'municipal-health-office', 'MHO#external-1', '']) {
      expect(
        charterRecordSchema.safeParse({
          ...validCharterRecord,
          charterServiceId: id,
        }).success,
        id
      ).toBe(false);
    }
  });

  it('rejects a record with no charter document', () => {
    const rest: Record<string, unknown> = { ...validCharterRecord };
    delete rest.charterDocument;
    expect(charterRecordSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a charter document with no checksum, or a bad one', () => {
    for (const sha256 of ['', 'not-a-hash', 'ABC123', '0'.repeat(63)]) {
      expect(
        charterRecordSchema.safeParse({
          ...validCharterRecord,
          charterDocument: { ...validCharterRecord.charterDocument, sha256 },
        }).success,
        sha256
      ).toBe(false);
    }
  });

  it('rejects V3 claimed without a retrievable address for the document', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        verification: 'V3',
        source: { ...validCharterRecord.source, url: null },
      }).success
    ).toBe(false);
  });

  it('rejects a title source it does not know', () => {
    // `read-from-pdf` exists so a human-supplied title never reads as a
    // published one. A third value would quietly reintroduce that confusion.
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        charterTitleSource: 'inferred',
      }).success
    ).toBe(false);
  });

  it('requires group, ambiguity and the transcription note to be stated, even when empty', () => {
    // `null` is a decision; a missing key is a question nobody asked.
    for (const key of ['group', 'ambiguity', 'transcriptionNote'] as const) {
      const copy: Record<string, unknown> = { ...validCharterRecord };
      delete copy[key];
      expect(charterRecordSchema.safeParse(copy).success, key).toBe(false);
    }
  });

  it('rejects an empty ambiguity or transcription note — say it, or say null', () => {
    for (const key of ['ambiguity', 'transcriptionNote'] as const) {
      expect(
        charterRecordSchema.safeParse({ ...validCharterRecord, [key]: '' })
          .success,
        key
      ).toBe(false);
    }
  });

  it('keeps provenance out of the resident-facing field', () => {
    /*
     * The two are separate because only ONE of them renders, under a heading
     * saying the document does not answer your question. "The extractor
     * truncated a heading" is not that, and putting it there made the section's
     * closing line a non-sequitur on nine pages.
     *
     * The schema cannot tell them apart — a human decides — so this asserts
     * only that both can be held at once, which is what the split is for.
     */
    const parsed = charterRecordSchema.safeParse({
      ...validCharterRecord,
      ambiguity:
        'The charter registers this twice and does not say what separates them.',
      ambiguityFil:
        'Dalawang beses itong nakatala sa charter at hindi sinasabi kung ano ang naghihiwalay sa kanila.',
      transcriptionNote:
        'The published heading was truncated and completed by hand.',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('the verification record on a charter record', () => {
  const verified = {
    collectedBy: 'a-transcriber',
    verifiedBy: 'a-verifier',
    verifiedAt: '2026-08-09',
  };

  it('accepts a complete record naming two different handles', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        verificationRecord: verified,
      }).success
    ).toBe(true);
  });

  it('rejects one naming the same handle twice', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        verificationRecord: { ...verified, verifiedBy: verified.collectedBy },
      }).success
    ).toBe(false);
  });

  it('rejects a partially filled record — whole, or null', () => {
    // A half-claimed check is worse than an absent one: it reads as done.
    for (const key of ['collectedBy', 'verifiedBy', 'verifiedAt'] as const) {
      const partial: Record<string, unknown> = { ...verified };
      delete partial[key];
      expect(
        charterRecordSchema.safeParse({
          ...validCharterRecord,
          verificationRecord: partial,
        }).success,
        key
      ).toBe(false);
    }
  });

  it('rejects a free-text verification date', () => {
    expect(
      charterRecordSchema.safeParse({
        ...validCharterRecord,
        verificationRecord: { ...verified, verifiedAt: 'August 2026' },
      }).success
    ).toBe(false);
  });

  it('rejects a handle that could carry a personal name or an address', () => {
    for (const handle of ['A Name', 'someone@example.com', 'first.last']) {
      expect(
        charterRecordSchema.safeParse({
          ...validCharterRecord,
          verificationRecord: { ...verified, verifiedBy: handle },
        }).success,
        handle
      ).toBe(false);
    }
  });
});

describe('a charter manifest', () => {
  it('accepts a list of charter records', () => {
    expect(
      charterManifestSchema.safeParse({ pages: [validCharterRecord] }).success
    ).toBe(true);
  });

  it('rejects a plain page entry — a charter page owes its provenance', () => {
    expect(
      charterManifestSchema.safeParse({ pages: [validEntry] }).success
    ).toBe(false);
  });
});

/**
 * ★ TAGO-301 — the transparency document register.
 *
 * Every rejection below is a way the register could quietly stop being honest:
 * a link nobody can follow, an absence nobody looked for, a request that never
 * happened, a person recorded where an office belongs, and the one document
 * this project has said it will never hold.
 */
const validRegisterEntry = {
  dataClass: 'transparency',
  lastReview: null,
  name: 'Annual budget',
  slug: 'annual-budget',
  description: 'The budget the municipal council enacts for a fiscal year.',
  source: {
    label: { en: 'Municipality of Tago — Transparency Seal' },
    url: 'https://tago.gov.ph/transparency-seal/',
    documentType: 'web',
    retrievedAt: '2026-08-09',
  },
  verification: 'V3',
  lastCheckedAt: '2026-08-09',
  documentName: 'Annual budget',
  fiscalYear: null,
  status: 'not-located',
  lookedFor: [
    {
      label: 'Municipality of Tago — Transparency Seal page',
      url: 'https://tago.gov.ph/transparency-seal/',
      result: 'not-published-here',
      checkedAt: '2026-08-09',
    },
  ],
  requestedOf: null,
  requestedAt: null,
};

const register = (patch: Record<string, unknown>) =>
  transparencyRecordSchema.safeParse({ ...validRegisterEntry, ...patch });

describe('a transparency register entry', () => {
  it('accepts a not-located entry that records where it was looked for', () => {
    expect(register({}).success).toBe(true);
  });

  it('rejects not-located with nothing looked for', () => {
    // The whole failure mode of a gap register: an absence nobody can tell
    // apart from nobody having looked.
    expect(register({ lookedFor: [] }).success).toBe(false);
  });

  it('rejects linked with no address to link', () => {
    expect(
      register({
        status: 'linked',
        source: { ...validRegisterEntry.source, url: null },
      }).success
    ).toBe(false);
  });

  it('accepts linked when the document has an address', () => {
    expect(register({ status: 'linked' }).success).toBe(true);
  });

  it('rejects requested with no office and no date', () => {
    expect(register({ status: 'requested' }).success).toBe(false);
  });

  it('accepts requested when both are recorded', () => {
    expect(
      register({
        status: 'requested',
        requestedOf: 'Municipal Budget Office',
        requestedAt: '2026-08-09',
      }).success
    ).toBe(true);
  });

  it('rejects request details on an entry that was never requested', () => {
    // A half-filled request reads, to anyone rendering this, as an ask that
    // happened. Nothing was asked, and the register may not imply it was.
    expect(register({ requestedOf: 'Municipal Budget Office' }).success).toBe(
      false
    );
  });

  it('rejects a person where an office belongs', () => {
    expect(
      register({
        status: 'requested',
        requestedOf: 'Hon. A Person',
        requestedAt: '2026-08-09',
      }).success
    ).toBe(false);
  });

  it('rejects an entry with no check date', () => {
    const noDate: Record<string, unknown> = { ...validRegisterEntry };
    delete noDate.lastCheckedAt;
    expect(transparencyRecordSchema.safeParse(noDate).success).toBe(false);
  });

  it('rejects a fiscal year that is not one', () => {
    expect(register({ fiscalYear: 'FY2022' }).success).toBe(false);
    expect(register({ fiscalYear: '2022' }).success).toBe(true);
  });

  it('rejects a statement of assets, liabilities and net worth', () => {
    // The permanent hold, made a property of the data. A contributor working
    // from a list of mandated documents would add this in good faith, which
    // is exactly why review is not where it should be caught.
    expect(
      register({
        name: 'Statement of assets, liabilities and net worth',
        slug: 'statement-of-assets-liabilities-and-net-worth',
        documentName: 'Statement of Assets, Liabilities and Net Worth',
      }).success
    ).toBe(false);
  });

  it('rejects it under its acronym too', () => {
    expect(
      register({
        name: 'SALN filings',
        slug: 'saln-filings',
        documentName: 'SALN',
      }).success
    ).toBe(false);
  });

  it('does not fire on an ordinary financial statement', () => {
    // The rule is phrase-matched, not word-matched. "Financial statements" is
    // a mandated document this register MUST carry, and an over-broad hold
    // would silently drop it — a gap created by the anti-gap machinery.
    expect(
      register({
        name: 'Financial statements',
        slug: 'financial-statements',
        documentName: 'Annual financial statements',
      }).success
    ).toBe(true);
  });
});

describe('a transparency manifest', () => {
  it('accepts a list of register entries', () => {
    expect(
      transparencyManifestSchema.safeParse({ pages: [validRegisterEntry] })
        .success
    ).toBe(true);
  });

  it('rejects a plain page entry — a register row owes its status', () => {
    expect(
      transparencyManifestSchema.safeParse({ pages: [validEntry] }).success
    ).toBe(false);
  });
});

/**
 * ★ TAGO-401 · CONT-401 — the data class, and the review record.
 *
 * A page with no cadence never goes stale. It sits there looking tended for as
 * long as nobody notices, and nobody notices until a fact on it is years old.
 * That is why this is a build failure rather than a warning.
 */
describe('the data class on a page entry', () => {
  it('rejects an entry that declares none', () => {
    const noClass: Record<string, unknown> = { ...validEntry };
    delete noClass.dataClass;
    expect(pageEntrySchema.safeParse(noClass).success).toBe(false);
  });

  it('rejects a class with no cadence behind it', () => {
    // The enum is derived from config/freshness.config.json, so a class
    // cannot be invented in a manifest and quietly acquire no cadence.
    expect(
      pageEntrySchema.safeParse({ ...validEntry, dataClass: 'whenever' })
        .success
    ).toBe(false);
  });

  it('accepts every class the config declares', () => {
    for (const dataClass of DATA_CLASSES) {
      expect(
        pageEntrySchema.safeParse({ ...validEntry, dataClass }).success,
        dataClass
      ).toBe(true);
    }
  });

  it('requires the review record to be present, even as null', () => {
    // Optional would let a page omit it and read as "never claimed a review",
    // which is the same thing but unenforceable. Explicit null is a statement.
    const noReview: Record<string, unknown> = { ...validEntry };
    delete noReview.lastReview;
    expect(pageEntrySchema.safeParse(noReview).success).toBe(false);
  });

  it('accepts a review recorded by role', () => {
    expect(
      pageEntrySchema.safeParse({
        ...validEntry,
        lastReview: { role: 'maintenance-owner', at: '2026-08-09' },
      }).success
    ).toBe(true);
  });

  it('rejects a review recorded by a handle or a name', () => {
    // A review is about a job having been done, not about which two people
    // were involved — that is the verification record's question.
    for (const role of ['handle-one', 'A Person', 'somebody@example.org']) {
      expect(
        pageEntrySchema.safeParse({
          ...validEntry,
          lastReview: { role, at: '2026-08-09' },
        }).success,
        role
      ).toBe(false);
    }
  });

  it('rejects a review with no date', () => {
    expect(
      pageEntrySchema.safeParse({
        ...validEntry,
        lastReview: { role: 'maintenance-owner' },
      }).success
    ).toBe(false);
  });
});
