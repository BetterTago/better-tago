import { describe, expect, it } from 'vitest';
import { manifestSchema, pageEntrySchema } from './content-schema';

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
