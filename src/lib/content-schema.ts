import { z } from 'zod';

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

export const pageEntrySchema = z.object({
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
});

export const manifestSchema = z.object({ pages: z.array(pageEntrySchema) });

export type PageEntry = z.infer<typeof pageEntrySchema>;
export type SourceRef = z.infer<typeof sourceSchema>;
export type Verification = z.infer<typeof verificationSchema>;
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
