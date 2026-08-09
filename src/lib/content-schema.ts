import { z } from 'zod';
import { isDataClass } from './freshness';

/**
 * The content contract, kept separate from the loader.
 *
 * `content.ts` imports `next/cache`, which only resolves inside the Next
 * runtime — so anything that lives there cannot be unit-tested. These schemas
 * ARE the contract between the content layer and everything that renders it,
 * which makes them the part most worth testing, so they live in a module with
 * no framework imports at all.
 */

/** Where a fact came from, how it reached us, and when a human last looked. */
export const sourceSchema = z.object({
  label: z.object({
    en: z.string().min(1),
    fil: z.string().min(1).optional(),
  }),
  /** Null only for a source with no public URL — a letter, a posted notice. */
  url: z.url().nullable(),
  documentTitle: z.string().min(1).optional(),
  documentType: z.enum(['web', 'pdf', 'letter', 'notice', 'photograph']),
  retrievedAt: z.iso.date(),
});

/**
 * How well a fact is stood up, strongest first: `V3` primary · `V2` official
 * communication · `V1` corroborated indirect · `V0` unconfirmed.
 *
 * The definitions, a worked example of each, which level is good enough for
 * what, and the 90-day `V0` re-check live in ONE place — docs/governance.md.
 * Do not restate the rules here: this docblock used to, and had already fallen
 * a rule behind.
 */
export const verificationSchema = z.enum(['V3', 'V2', 'V1', 'V0']);

/**
 * A contributor handle — lowercase, hyphenated, self-chosen.
 *
 * Deliberately the same shape as a page slug, and deliberately unable to
 * express a personal name or an email address: no spaces, no `@`, no dots.
 * Contributing here requires no personal information, and this format is what
 * keeps that true rather than someone remembering it at review time.
 */
const contributorHandleSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must be a lowercase, hyphenated handle — never a name or an address'
  );

/**
 * Who collected a fact, who checked it, and when — the record that makes the
 * two-person rule checkable instead of merely stated.
 *
 * The refinement is the point: a record naming the same handle twice does not
 * parse, so a page cannot ship having been verified by the person who wrote it.
 * Documented in docs/governance.md § the two-person rule.
 */
export const verificationRecordSchema = z
  .object({
    collectedBy: contributorHandleSchema,
    verifiedBy: contributorHandleSchema,
    /** The day the second person checked it against the source. */
    verifiedAt: z.iso.date(),
  })
  .refine(record => record.collectedBy !== record.verifiedBy, {
    message:
      'the collector never verifies their own work — collectedBy and verifiedBy must differ',
    path: ['verifiedBy'],
  });

/**
 * ★ TAGO-401 criterion 5 — a page with no data class FAILS the build.
 *
 * Not a warning, not a default. A page with no cadence never goes stale, so it
 * would sit there looking tended for as long as nobody noticed — which is the
 * precise failure CONT-401 exists to close, and it is invisible until a fact
 * on it is three years old.
 *
 * The enum is derived from `config/freshness.config.json` rather than written
 * here, so a class cannot exist in a manifest without a cadence behind it.
 */
const dataClassSchema = z.string().refine(isDataClass, {
  message:
    'unknown data class. Declare it in config/freshness.config.json first — a class with no cadence is a page that never goes stale',
});

export const pageEntrySchema = z.object({
  dataClass: dataClassSchema,
  name: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case'),
  description: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  /** The office that owns the service. A FIELD — never the page's identity. */
  office: z.string().min(1).optional(),
  source: sourceSchema,
  verification: verificationSchema,
  lastCheckedAt: z.iso.date(),
  /**
   * Who last re-checked this against its source, BY ROLE, and when.
   *
   * CONT-401 criterion 5: a page is never made to look fresh by advancing its
   * check date without somebody actually re-checking it. Prose cannot prevent
   * that; this plus the committed `inventory/check-dates.yaml` baseline can —
   * a `lastCheckedAt` that moves past the baseline with no `lastReview` added
   * in the same change fails the build.
   *
   * A ROLE, never a handle and never a name. The verification record uses
   * handles because it is about two specific people not being the same person;
   * a review is about a job having been done.
   *
   * `null` everywhere today: nothing has been re-checked since it was written,
   * and claiming otherwise is the falsification this field exists to make
   * visible.
   */
  lastReview: z
    .object({
      role: z.enum([
        'project-lead',
        'transcriber',
        'verifier',
        'office-liaison',
        'field-checker',
        'translator',
        'content-reviewer',
        'platform-maintainer',
        'maintenance-owner',
      ]),
      at: z.iso.date(),
    })
    .nullable(),
});

export const manifestSchema = z.object({ pages: z.array(pageEntrySchema) });

/**
 * The charter document a record was drawn from — named, and pinned to the copy
 * that was actually read.
 *
 * The `sha256` is the point. A charter revision that moves a fee is otherwise
 * indistinguishable from the document we transcribed against, and "retrieved
 * 2026-08-09" is not a defence if nobody can say retrieved *what*.
 */
export const charterDocumentSchema = z.object({
  /** The title the municipality publishes it under — its link text, not the filename. */
  title: z.string().min(1),
  file: z.string().regex(/\.pdf$/, 'the published filename, ending .pdf'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'a lowercase hex sha256'),
});

/**
 * A service's stable inventory id — `<document>#<section>-<ordinal>`.
 *
 * NOT the charter's own printed number, which is not unique: one office prints
 * `10` twice and two documents print none at all, so 167 services collapse to
 * 159 distinct keys and anything joined on it mis-assigns silently. See
 * inventory/README.md § `id`.
 */
const charterServiceIdSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*#(?:external|internal)-\d+$/,
    'must be an inventory id, e.g. municipal-health-office#external-10'
  );

/**
 * A charter-derived record: the shape ★ TAGO-201 freezes, and the contract
 * every Phase 2 content ticket is authored against.
 *
 * It is `pageEntrySchema` plus the four things a hundred-odd records need that
 * a generic page does not — the join back to the inventory, the section, the
 * ambiguity the charter left, and whether a second person has checked it.
 *
 * 🔴 What this record deliberately CANNOT carry is the charter's contents. No
 * fee, requirement, processing time or step field exists here, because
 * republishing those is a permission this project has not asked for (⛔
 * PROG-003, fallback: index-and-link only). The eight-field guide TAGO-004
 * froze is the shape that returns WITH a written permission; until then its
 * absence from this schema is the position, not an omission.
 */
export const charterRecordSchema = pageEntrySchema
  .extend({
    charterServiceId: charterServiceIdSchema,
    /**
     * Always `external`, and stated rather than assumed.
     *
     * Internal services are government-to-government. Publishing one as a
     * resident task sends somebody to a counter they cannot transact at, which
     * is the worst outcome available in this content tree — so the schema
     * refuses the value rather than trusting a reviewer to notice it.
     */
    charterSection: z.literal('external', {
      message:
        'internal services are government-to-government and are never published as resident tasks',
    }),
    charterDocument: charterDocumentSchema,
    /** The charter's own wording for this service, verbatim and uncorrected. */
    charterTitle: z.string().min(1),
    /**
     * `extracted` — lifted from the document's own service heading.
     * `read-from-pdf` — a human read it off the page, because the heading was
     * truncated, was a container for sub-services, or did not exist at all.
     * A human-supplied title must never read as a published one.
     */
    charterTitleSource: z.enum(['extracted', 'read-from-pdf']),
    /** The vocabulary group id, when the charter answers one question twice. */
    group: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case')
      .nullable(),
    /**
     * What the charter left unclear FOR A RESIDENT — carried onto the page as
     * stated, and never resolved by the transcriber.
     *
     * Kept narrow on purpose. This field renders, under a heading that tells
     * somebody the document does not answer their question, and it is followed
     * by "guessing which reading is right would be inventing a fact". Both are
     * true of "the charter registers a death twice and does not say what
     * separates them"; neither is true of "the extractor truncated a heading".
     * Putting the second kind here made that closing line a non-sequitur on
     * nine pages, and diluted the field until the two that mattered stopped
     * standing out. Provenance goes in `transcriptionNote` instead.
     */
    ambiguity: z.string().min(1).nullable(),
    /**
     * How THIS PROJECT read the document — a truncated heading completed by
     * hand, a service number the charter prints twice, an office spelled two
     * ways in one file.
     *
     * Recorded in the data and deliberately NOT rendered: it is what the
     * second-person verification pass needs in order to check the entry
     * (CONT-212), and it is build detail a resident has no use for.
     */
    transcriptionNote: z.string().min(1).nullable(),
    /**
     * Null until a second person has checked it. Never partially filled: the
     * record either parses whole or not at all, so a half-claimed check cannot
     * ship. With the Verifier role vacant this is null everywhere, and that is
     * the honest state rather than a gap to paper over.
     */
    verificationRecord: verificationRecordSchema.nullable(),
  })
  .refine(record => record.charterServiceId.includes('#external-'), {
    message:
      'charterSection says external but the inventory id does not — they must agree',
    path: ['charterServiceId'],
  })
  .refine(
    record => record.verification !== 'V3' || record.source.url !== null,
    {
      message:
        'V3 is a primary source. Claiming it without a retrievable address for the document is not a citation',
      path: ['source', 'url'],
    }
  );

export const charterManifestSchema = z.object({
  pages: z.array(charterRecordSchema),
});

/**
 * Where a document was looked for, and what came back.
 *
 * Deliberately the same shape as `emergency.sourcesChecked` in the config: a
 * gap with no record of the looking is indistinguishable from nobody having
 * looked, and that shape has already proved it can carry the difference.
 *
 * `result` is what was OBSERVED at that address on that date — never why. The
 * register records that a document was not at the place checked; it does not
 * say anything about whether it exists, or about anyone's intent.
 */
export const lookedForSchema = z.object({
  label: z.string().min(1),
  url: z.url().nullable(),
  result: z.enum(['not-published-here', 'not-retrievable', 'published-here']),
  checkedAt: z.iso.date(),
});

/**
 * How a mandated disclosure document actually stands.
 *
 * `not-located` is a FIRST-CLASS state, not the absence of one. ★ TAGO-301's
 * whole reason for existing is that a labelled gap is honest and an omission
 * looks like concealment, so the register's central field is a status rather
 * than a URL and every mandated document has a row whether or not it was found.
 */
export const disclosureStatusSchema = z.enum([
  /** Published by the municipality, and this project links the original. */
  'linked',
  /** Published somewhere else citable — a national portal, another office. */
  'published',
  /** Asked for, and the asking is logged. Never a claim about the answer. */
  'requested',
  /** Not at the addresses checked, on the dates recorded. Nothing more. */
  'not-located',
]);

/**
 * A name this project will not record, in any form.
 *
 * Statements of assets, liabilities and net worth are on a permanent,
 * documented hold — not deferred, not "pending a request". They are personal
 * financial disclosures about identifiable people, and republishing them is
 * outside what a volunteer restatement project has any business doing.
 *
 * It is a schema rule rather than a review rule because the failure would be
 * one contributor acting in good faith on a list of "mandated documents": the
 * register EXISTS to enumerate that list, so the wrong entry is the natural
 * mistake here rather than an unlikely one. The positive half — how a resident
 * requests one — is an ordinary page in content/transparency/requests/.
 */
const HELD_DOCUMENT = /\bSALN\b|statements?\s+of\s+assets/i;

/** Personal honorifics. `requestedOf` records an OFFICE, never a person. */
const PERSONAL_TITLE =
  /^\s*(hon\.?|mr\.?|ms\.?|mrs\.?|atty\.?|engr\.?|dr\.?)\s/i;

/**
 * A transparency register entry: the shape ★ TAGO-301 freezes, and the
 * contract CONT-301 fills in and the transparency route renders.
 *
 * It is `pageEntrySchema` plus the four things a disclosure register needs
 * that a generic page does not — which document it is, which fiscal year,
 * where it actually stands, and where it was looked for.
 */
export const transparencyRecordSchema = pageEntrySchema
  .extend({
    /** The document's name as the enumeration names it, not as we'd phrase it. */
    documentName: z.string().min(1),
    /** Null where the document is not annual — a land-use plan, say. */
    fiscalYear: z
      .string()
      .regex(/^\d{4}$/, 'a four-digit fiscal year, or null')
      .nullable(),
    status: disclosureStatusSchema,
    lookedFor: z.array(lookedForSchema),
    /** The OFFICE a request went to. Never a person — see PERSONAL_TITLE. */
    requestedOf: z.string().min(1).nullable(),
    requestedAt: z.iso.date().nullable(),
  })
  .refine(record => record.status !== 'linked' || record.source.url !== null, {
    message:
      'a linked document must carry the address it is linked at — otherwise the status claims a link nobody can follow',
    path: ['source', 'url'],
  })
  .refine(
    record => record.status !== 'not-located' || record.lookedFor.length > 0,
    {
      message:
        'not-located must record where it was looked for and when. Without that it is indistinguishable from nobody having looked',
      path: ['lookedFor'],
    }
  )
  .refine(
    record =>
      record.status !== 'requested' ||
      (record.requestedOf !== null && record.requestedAt !== null),
    {
      message:
        'a requested document records when it was asked for and of which office',
      path: ['requestedOf'],
    }
  )
  .refine(
    record =>
      record.status === 'requested' ||
      (record.requestedOf === null && record.requestedAt === null),
    {
      message:
        'only a requested document carries request details — a half-filled request reads as an ask that never happened',
      path: ['requestedAt'],
    }
  )
  .refine(record => !PERSONAL_TITLE.test(record.requestedOf ?? ''), {
    message: 'requestedOf names an office, never a person',
    path: ['requestedOf'],
  })
  .refine(
    record =>
      !HELD_DOCUMENT.test(record.documentName) &&
      !HELD_DOCUMENT.test(record.name) &&
      !HELD_DOCUMENT.test(record.slug),
    {
      message:
        'statements of assets, liabilities and net worth are on a permanent documented hold and are never recorded here. The register explains how a resident requests one instead',
      path: ['documentName'],
    }
  );

export const transparencyManifestSchema = z.object({
  pages: z.array(transparencyRecordSchema),
});

export type PageEntry = z.infer<typeof pageEntrySchema>;
export type CharterRecord = z.infer<typeof charterRecordSchema>;
export type TransparencyRecord = z.infer<typeof transparencyRecordSchema>;
export type DisclosureStatus = z.infer<typeof disclosureStatusSchema>;
export type CharterDocumentRef = z.infer<typeof charterDocumentSchema>;
export type SourceRef = z.infer<typeof sourceSchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
