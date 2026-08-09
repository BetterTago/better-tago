import { describe, expect, it } from 'vitest';
import {
  manifestSchema,
  pageEntrySchema,
  verificationRecordSchema,
} from './content-schema';

/**
 * The content contract is the one thing every page depends on, so these tests
 * are written the pessimistic way round: each one proves the schema REJECTS a
 * plausible mistake. A schema test that only feeds it valid input proves
 * nothing — the schema could be `z.any()` and still pass.
 */

const validEntry = {
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
