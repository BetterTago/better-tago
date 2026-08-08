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
 * V3 verified primary · V2 official communication · V1 corroborated indirect ·
 * V0 unconfirmed. Fees, deadlines and requirements must be V2 or better; V0 is
 * for safety-critical information only, and only while it is visibly labelled.
 */
export const verificationSchema = z.enum(['V3', 'V2', 'V1', 'V0']);

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
