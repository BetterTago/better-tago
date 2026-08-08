import { z } from 'zod';
import rawConfig from '../../config/lgu.config.json';

/**
 * The ONLY module that reads config/lgu.config.json.
 *
 * Nothing about Tago as an entity — its name, coordinates, domain, brand
 * colour, figures, or contacts — is hardcoded in a component. It comes from
 * here. That is what makes the portal re-pointable at another LGU by editing
 * one file. See docs/coding-standards.md, "Configuration & environment".
 *
 * The unusual part of this schema is that almost every municipal fact is
 * NULLABLE, and a null has to be defended. When this portal was scaffolded the
 * municipality had not yet been spoken to, and most of what a profile page
 * wants — barangay count, population, land area, coordinates, office hours,
 * an emergency hotline — is not published anywhere we can cite. Inventing any
 * of it, or borrowing a neighbouring municipality's, is the most dangerous
 * failure mode this project has: it looks complete and it is false.
 *
 * So the rule is encoded rather than remembered. Every null field must have a
 * matching entry in `pending` saying what is missing and how it gets closed,
 * and every `pending` entry must point at a field that is actually still null.
 * A labelled gap is honest; a silent omission looks like concealment, and a
 * stale entry is how a register stops being read.
 */

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a 6-digit hex');

const sourceSchema = z.object({
  url: z.url().nullable(),
  checkedAt: z.iso.date(),
});

const portalSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  /**
   * The visible mark, in two lines: a de-emphasised `lead` over a larger `main`
   * that renders in caps. Stored split rather than derived from `name` by
   * slicing off `lgu.shortName` — that trick works only while the portal is
   * named "Better" + the municipality, and it would fail silently, mid-header,
   * the day it stopped being true.
   */
  wordmark: z.object({ lead: z.string().min(1), main: z.string().min(1) }),
  domain: z.url(),
  brandColor: hexColor,
  accentColor: hexColor,
  /** Why the palette is what it is. Required, because the reason is a rule. */
  paletteNote: z.string().min(1),
  tagline: z.string().min(1),
  /**
   * Not configurable. This portal is independent of the Municipality of Tago,
   * every page says so, and there is no value of this field that lets it stop
   * saying so.
   */
  independent: z.literal(true),
  repository: z.url().nullable(),
  /** The programme this portal belongs to, for the footer attribution. */
  network: z.object({ name: z.string().min(1), url: z.url() }),
});

const lguSchema = z.object({
  type: z.enum(['municipality', 'city']),
  officialName: z.string().min(1),
  shortName: z.string().min(1),
  province: z.string().min(1),
  region: z.string().min(1),
  district: z.string().min(1).nullable(),
  psgc: z
    .string()
    .regex(/^\d{9,10}$/)
    .nullable(),
  postalCode: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  incomeClass: z.string().min(1).nullable(),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .nullable(),
  landAreaKm2: z.number().positive().nullable(),
  barangayCount: z.int().positive().nullable(),
  population: z.int().positive().nullable(),
  households: z.int().positive().nullable(),
  censusYear: z.int().min(1900).max(2200).nullable(),
  /** Published on the official history page, and cited there. */
  history: z.object({
    establishedYear: z.int(),
    reEstablishedDate: z.iso.date(),
    townConversionInstrument: z.string().min(1),
    townConversionDate: z.iso.date(),
    firstMunicipalTermStart: z.iso.date(),
    separatedFrom: z.string().min(1),
  }),
});

const officialSiteSchema = z.object({
  url: z.url(),
  status: z.enum(['live', 'degraded', 'unreachable']),
  checkedAt: z.iso.date(),
  note: z.string().min(1),
});

const contactSchema = z.object({
  municipalHall: z.object({
    name: z.string().min(1),
    locality: z.string().min(1),
    address: z.string().min(1),
    mapUrl: z.url().nullable(),
    phone: z.string().min(1).nullable(),
    /**
     * `published-unverified` means: it is on the official contact page, and
     * nobody has rung it yet. The UI renders it with that caveat rather than as
     * a bare `tel:` link, because a number that does not answer costs a
     * resident the same trip a wrong number does.
     */
    phoneStatus: z.enum(['published-unverified', 'verified', 'unreachable']),
    email: z.email().nullable(),
    officeHours: z.string().min(1).nullable(),
    source: sourceSchema,
  }),
  project: z.object({
    email: z.email().nullable(),
    correctionChannel: z.url().nullable(),
  }),
});

const hotlineSchema = z.object({
  label: z.string().min(1),
  number: z.string().min(1),
  /** 'not stated' is a legitimate value. A guess is not. */
  hours: z.string().min(1),
  verification: z.enum(['V3', 'V2', 'V1', 'V0']),
  source: z.object({
    label: z.string().min(1),
    url: z.url().nullable(),
    checkedAt: z.iso.date(),
  }),
});

const emergencySchema = z.object({
  nationalLine: z.string().min(1),
  municipalHotlines: z.array(hotlineSchema),
  status: z.enum(['not-obtained', 'requested', 'partial', 'obtained']),
  note: z.string().min(1),
});

/** The subtrees whose nulls are municipal gaps. `pending` describes them. */
const FACT_GROUPS = [
  'portal',
  'lgu',
  'officialSite',
  'contact',
  'emergency',
  'socials',
] as const;

/** Dotted paths of every null leaf beneath `value`. Arrays are not descended. */
function nullPaths(value: unknown, prefix: string): string[] {
  if (value === null) return [prefix];
  if (Array.isArray(value) || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
    nullPaths(v, `${prefix}.${key}`)
  );
}

const configSchema = z
  .object({
    portal: portalSchema,
    lgu: lguSchema,
    officialSite: officialSiteSchema,
    contact: contactSchema,
    emergency: emergencySchema,
    socials: z.object({ municipalFacebook: z.url().nullable() }),
    sources: z.record(z.string(), z.url()),
    pending: z.record(z.string(), z.string().min(40)),
  })
  .superRefine((config, ctx) => {
    const nulls = new Set(
      FACT_GROUPS.flatMap(group => nullPaths(config[group], group))
    );
    const registered = new Set(Object.keys(config.pending));

    for (const path of nulls) {
      if (registered.has(path)) continue;
      ctx.addIssue({
        code: 'custom',
        path: ['pending', path],
        message: `${path} is null with no entry in \`pending\`. Say what is missing and how it gets closed, or give the field a sourced value.`,
      });
    }

    for (const path of registered) {
      if (nulls.has(path)) continue;
      ctx.addIssue({
        code: 'custom',
        path: ['pending', path],
        message: `${path} has a \`pending\` entry but is no longer null. Delete the entry — a register nobody trusts is a register nobody reads.`,
      });
    }
  });

export type LguConfig = z.infer<typeof configSchema>;

/**
 * Parsed once at module load. A malformed config is a build-time failure, not
 * a page that renders `undefined` where a hotline should be.
 */
export const lguConfig: LguConfig = configSchema.parse(rawConfig);

/** The schema itself, so a test can prove the invariants actually bite. */
export const lguConfigSchema = configSchema;
