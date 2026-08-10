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
 * A field the charter is SILENT on — recorded as an absence, not left blank.
 *
 * ★ TAGO-201 criterion 2 in its original meaning, restored on 2026-08-10 when
 * ⛔ PROG-003 re-opened and the transcription came back into scope. The
 * criterion had been recast because the index-and-link shape carried no charter
 * fields at all, so there was nothing on a page for it to attach to. There is
 * now.
 *
 * The distinction it protects is between a field nobody looked at and a field
 * somebody looked for and did not find. Both render as no answer; only one of
 * them is honest about why, and only one of them belongs in the gap register.
 */
export const notStatedFieldSchema = z.enum([
  'whereToGo',
  'officeHours',
  'output',
  'eligibility',
  'fees',
  'processingTime',
  'requirements',
]);

/**
 * One requirement, and where the charter says to get it.
 *
 * `whereToSecure` is nullable because the document sometimes leaves the second
 * column empty, and an empty column is a fact about the document. It is never
 * filled in from a neighbouring row.
 */
export const requirementSchema = z.object({
  item: z.string().min(1),
  /**
   * Whether the item carries the charter's OWN list marker — `1.`, `•`, `-`.
   *
   * The renderer supplies a bullet only where the document supplied none.
   * Where a charter numbers its own list, that numbering is transcribed with
   * it: a requirement printed `1.Original Immunization Card` under a markdown
   * bullet reads `- 1.Original Immunization Card`, and renumbering a list a
   * resident may be holding a paper form against is not transcribing it.
   */
  marked: z.boolean(),
  whereToSecure: z.string().min(1).nullable(),
});

/**
 * One row of the charter's client-steps table, carried through verbatim.
 *
 * Every field is nullable because every one of them is genuinely absent on some
 * real row: the resident does nothing during an office's internal step, a
 * merged fee cell cannot be attributed to the rows it covers, and a page whose
 * prose columns were identified by position alone publishes no labels at all.
 * A null here means *the charter did not say, in this row* — never *we did not
 * look*.
 */
export const charterStepSchema = z.object({
  clientStep: z.string().min(1).nullable(),
  agencyAction: z.string().min(1).nullable(),
  fee: z.string().min(1).nullable(),
  processingTime: z.string().min(1).nullable(),
  personResponsible: z.string().min(1).nullable(),
});

/**
 * The charter's contents for one service — the half of a page a resident came
 * for, and the half this project could not publish until 2026-08-10.
 *
 * 🔴 EVERY STRING IN HERE IS BYTE-IDENTICAL TO THE DOCUMENT. The archive prints
 * `P 1,000.00`, `P1250.00`, `Php200.00` and `PHP100.00`, several of them inside
 * one file, and that inconsistency is data: it is what the counter will say.
 * Normalising a figure — even to make a page look tidier — is the failure ★
 * TAGO-202 criterion 3 exists to forbid, and `transcription-integrity.test.ts`
 * fails the build on one.
 *
 * `extractionFlags` and `columnsNamedBy` are provenance for the verifier, not
 * copy for a resident. They record how confidently each figure was read, which
 * is what makes a second-person check possible without re-deriving the geometry.
 */
export const charterContentSchema = z.object({
  eligibility: z.string().min(1).nullable(),
  classification: z.string().min(1).nullable(),
  typeOfTransaction: z.string().min(1).nullable(),
  requirements: z.array(requirementSchema),
  /**
   * Places the charter names for obtaining the requirements, where it does NOT
   * print them against individual items.
   *
   * These documents commonly set the *where to secure* column as one tall cell
   * beside a dozen requirements, and which address belongs to which item is
   * then not in the page's geometry at all. Pairing is therefore
   * all-or-nothing: either every address lines up with exactly one requirement,
   * or none of them is attached and they are carried here instead, under a
   * heading that says so. Guessing the pairing would send somebody to the wrong
   * counter with a citation on it.
   */
  requirementSources: z.array(z.string().min(1)),
  steps: z.array(charterStepSchema),
  /** The charter's own summary row. `null` where the document prints none. */
  totalFee: z.string().min(1).nullable(),
  totalProcessingTime: z.string().min(1).nullable(),
  /** Every distinct fee the service states, in document order. */
  fees: z.array(z.string().min(1)),
  processingTimes: z.array(z.string().min(1)),
  /**
   * Columns the charter prints ONCE across several rows. Where those rows are
   * is not recoverable from the document's geometry, so the figure is stated at
   * service level and never spread — see scripts/charter-values.mjs.
   */
  mergedColumns: z.array(z.string().min(1)),
  /** `header` · `content` · `position` — how each column was identified. */
  columnsNamedBy: z.record(
    z.string(),
    z.enum(['header', 'content', 'position'])
  ),
  /**
   * False when the client-step / agency-action / person-responsible columns
   * were told apart by position alone. The page then presents the row's text
   * without claiming which is the resident's move and which is the office's.
   */
  proseColumnsTrusted: z.boolean(),
  /**
   * False where the steps could not be arranged into a table at all — a page
   * whose gutters gave no columns, or a table long enough that it plainly was
   * not one service's worth of rows.
   *
   * ⚠️ It is PROVENANCE, not a rendering switch. An earlier version quoted
   * those steps instead of tabulating them and the page said so; the page now
   * shows the charter's own table either way, so nothing renders differently on
   * this. What it still tells a verifier is which tables the tooling could not
   * resolve, and those are the ones to read against the PDF first.
   *
   * Neither condition means the content is wrong; both mean it resisted being
   * laid out. Treating them as defects withheld eighteen services, including
   * the building permit — whose table genuinely runs across twenty pages.
   */
  stepsAreStructured: z.boolean(),
  extractionFlags: z.array(z.string().min(1)),
  /** What the charter is silent on — an absence somebody looked for. */
  notStated: z.array(notStatedFieldSchema),
});

/**
 * A charter-derived record: the shape ★ TAGO-201 freezes, and the contract
 * every Phase 2 content ticket is authored against.
 *
 * It is `pageEntrySchema` plus the join back to the inventory, the section, the
 * ambiguity the charter left, whether a second person has checked it — and,
 * since 2026-08-10, the charter's actual contents.
 *
 * ⚠️ **`content` is nullable, and the nullability is the honest part.** A
 * record whose extraction needs a human carries `null` rather than a
 * half-filled guess, and its page publishes what it publishes today: the
 * service exists, this office provides it, here is the document. Partial is not
 * an option — the object parses whole or not at all — because a page showing
 * three of five requirements is more dangerous than one showing none.
 */
export const charterRecordSchema = pageEntrySchema
  .extend({
    /**
     * The charter's contents, or `null` where the extraction was not good
     * enough to publish and a human has not yet resolved it.
     */
    content: charterContentSchema.nullable(),
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
     * The Filipino of the above. It lives in the manifest rather than in the
     * markdown because the English does — this is the one piece of project
     * prose the data layer carries, and a page rendered from data cannot
     * translate it at render time. Required whenever `ambiguity` is set;
     * `null` reads as "there is nothing to translate", which would be a lie on
     * a page that renders an English paragraph under a Filipino heading.
     */
    ambiguityFil: z.string().min(1).nullable(),
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
  .refine(
    record => (record.ambiguity === null) === (record.ambiguityFil === null),
    {
      message:
        'an ambiguity renders in both locales or in neither — a Filipino page showing an English paragraph under a translated heading is the failure CONT-402 exists to catch',
      path: ['ambiguityFil'],
    }
  )
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
  )
  /**
   * PROG-101's floor, as a property of the data rather than a promise.
   *
   * Fees, deadlines and requirements ship at `V2` or better — never `V1`, and
   * never `V0`. Two secondary sources agreeing is how a fee that changed years
   * ago stays alive on ten websites, and this record now carries all three of
   * the fields that rule names.
   */
  .refine(
    record =>
      record.content === null ||
      record.verification === 'V3' ||
      record.verification === 'V2',
    {
      message:
        'a page stating fees, requirements or processing time is at V2 or better — see docs/governance.md',
      path: ['verification'],
    }
  )
  /**
   * A transcription cites the copy it was read from, or it is unverifiable.
   *
   * The `sha256` is what makes a later charter revision detectable; without it
   * "transcribed 2026-08-10" says nothing about transcribed from WHAT, and no
   * second person can repeat the check.
   */
  .refine(
    record =>
      record.content === null || record.charterDocument.sha256.length === 64,
    {
      message:
        'transcribed contents must name the exact copy they came from, by checksum',
      path: ['charterDocument', 'sha256'],
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

/**
 * A bilingual string pair. Body copy — never UI chrome, which stays in
 * `messages/{en,fil}.json` — so a translation ships beside the fact it
 * translates rather than in a second file a content author has to remember.
 */
const bilingualSchema = z.object({
  en: z.string().min(1),
  fil: z.string().min(1),
});

/**
 * One dated entry in a narrative timeline.
 *
 * `period` is a bare 4-digit year OR a full ISO calendar date — never a
 * pre-formatted string like "November 6, 1918". A pre-formatted date is
 * English by construction and cannot be rendered in the other locale; storing
 * the raw value and formatting it through `next-intl` at render time (as every
 * other date in this portal is required to) is what keeps a Filipino reader
 * from meeting an English date inside Filipino prose.
 *
 * `milestone` is a DESIGN signal, not a magnitude judgement: it decides which
 * marker the timeline rail draws (filled or hollow) and is stated in text
 * for a screen reader, never left as colour alone.
 */
export const timelineEntrySchema = z.object({
  period: z.union([z.string().regex(/^\d{4}$/), z.iso.date()]),
  milestone: z.boolean(),
  title: bilingualSchema,
  body: bilingualSchema,
});

/**
 * A short narrative timeline, one shared citation for every entry.
 *
 * 🔴 Where a historical office-holder is named inside an entry's `body`, that
 * name is permitted ONLY because this file is `content/` — root rule 13's own
 * carve-out for "historical figures already in a cited public record,
 * rendered through content/". The carve-out does not extend to `messages/`,
 * to a component, to a test fixture, or to this schema's own comments, and a
 * reviewer should treat a name appearing anywhere else in a diff touching this
 * file as a blocking finding.
 */
export const timelineSchema = z.object({
  source: sourceSchema,
  verification: verificationSchema,
  lastCheckedAt: z.iso.date(),
  entries: z.array(timelineEntrySchema).min(1),
});

export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export type Timeline = z.infer<typeof timelineSchema>;

/**
 * One "getting here" card: a kicker, a heading and a short body.
 *
 * `surface: 'inverse'` promotes a card to the dark ground. It is a DESIGN
 * signal rather than a ranking — the last card is the arrival one, and giving
 * it a different ground is what stops four identical boxes reading as a list
 * a reader skims past.
 */
export const travelCardSchema = z.object({
  kicker: bilingualSchema,
  title: bilingualSchema,
  body: bilingualSchema,
  surface: z.enum(['default', 'inverse']).default('default'),
});

/**
 * How to reach the municipality, as a small set of cards.
 *
 * 🔴 One shared `source` for the set, like the timeline: travel facts here are
 * general orientation — which airport, which corridor, which poblacion — not
 * timetables. A schedule or a fare would need its own citation per card and a
 * far shorter re-check cadence than this shape gives, so neither belongs in
 * here without extending the schema first.
 */
export const travelSchema = z.object({
  source: sourceSchema,
  verification: verificationSchema,
  lastCheckedAt: z.iso.date(),
  summary: bilingualSchema,
  cards: z.array(travelCardSchema).min(1),
});

export type TravelCard = z.infer<typeof travelCardSchema>;
export type Travel = z.infer<typeof travelSchema>;

export type PageEntry = z.infer<typeof pageEntrySchema>;
export type CharterRecord = z.infer<typeof charterRecordSchema>;
export type TransparencyRecord = z.infer<typeof transparencyRecordSchema>;
export type DisclosureStatus = z.infer<typeof disclosureStatusSchema>;
export type CharterDocumentRef = z.infer<typeof charterDocumentSchema>;
export type CharterContent = z.infer<typeof charterContentSchema>;
export type CharterStep = z.infer<typeof charterStepSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type NotStatedField = z.infer<typeof notStatedFieldSchema>;
export type SourceRef = z.infer<typeof sourceSchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
