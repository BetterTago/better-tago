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
    /**
     * 🔴 Required, and it was missing until 2026-08-09.
     *
     * Six municipal facts sat in this block with no source and no check date,
     * while every other published fact in this project carried all three. They
     * predated the rule being enforced anywhere the schema could see, and
     * nothing rendered them, so nothing caught it.
     *
     * They are all stated on the municipality's own history page. Requiring
     * the citation here is what stops the next fact being added the same way —
     * CONT-304 criterion 3.
     */
    source: z.object({
      label: z.string().min(1),
      url: z.url(),
      checkedAt: z.iso.date(),
    }),
  }),
  /**
   * Where each OBTAINED figure came from — the mirror of `pending`.
   *
   * `note` is not decoration. The one entry here today records a figure the
   * municipality states about itself while the national issuance that set it
   * was never retrieved, and a reader deserves that distinction beside the
   * value rather than in a commit message.
   */
  sources: z.record(
    z.string(),
    z.object({
      label: z.string().min(1),
      url: z.url(),
      checkedAt: z.iso.date(),
      note: z.string().min(40),
    })
  ),
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
  /** The day the sources below were last swept for a municipal number. */
  checkedAt: z.iso.date(),
  /**
   * The re-check cadence, in days. 90, per the governance standard: emergency
   * information is the one class allowed to ship unconfirmed, and the price of
   * that is that it comes off the page if nobody looks at it for a quarter.
   */
  recheckDays: z.int().positive(),
  /**
   * Where a municipal number was looked for, and what came back.
   *
   * The gap is the published content here, and a gap with no record of the
   * looking is indistinguishable from nobody having looked. Each entry is a
   * source that WOULD have carried the number if it existed.
   */
  sourcesChecked: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.url(),
        result: z.enum(['no-municipal-number-published', 'not-retrievable']),
        checkedAt: z.iso.date(),
      })
    )
    .min(1),
});

/**
 * The municipal figures this project tracks one way or the other.
 *
 * Each is either null with a `pending` entry, or filled with a `lgu.sources`
 * entry — never neither, never both. They are the ten that a resident would
 * expect a municipality page to state and that no single source hands over.
 *
 * `officialName`, `province`, `region` and the like are deliberately NOT here:
 * they are the municipality's identity rather than figures about it, and
 * requiring a citation per word would make the register noise.
 */
const TRACKED_LGU_FACTS = [
  'district',
  'psgc',
  'postalCode',
  'incomeClass',
  'coordinates',
  'landAreaKm2',
  'barangayCount',
  'population',
  'households',
  'censusYear',
] as const;

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

/**
 * How a gap actually gets closed.
 *
 * `written-request` is deliberately ABSENT. The correspondence lane was retired
 * — no request is being sent to any office — so an entry claiming a letter will
 * close it would be false on the day it was written. Re-opening that lane is a
 * deliberate decision, and it should cost a change here rather than happen by
 * someone typing a channel that reads plausible.
 *
 * See docs/governance.md § the Phase 0 positions.
 */
const gapChannel = z.enum([
  /** Published somewhere on the municipality's own site, once it is. */
  'official-site',
  /** A national agency's own published record — the statistics authority, say. */
  'national-agency',
  /** Somebody in Tago looking at a wall, a door, or a counter. */
  'field-verification',
  /**
   * This project doing something, rather than anyone else answering.
   *
   * Exactly one entry uses it, and it is the only gap in this register that is
   * not about the municipality at all: the project has no mail address of its
   * own. Kept in the same register rather than a second one, because a reader
   * asking "what is missing here" deserves one list.
   */
  'project',
]);

/**
 * A gap in the record, and what it would take to close it.
 *
 * This used to be a bare string, and two of the register's own requirements
 * could not be met by that shape at all: an entry has to name the channel that
 * would close it, and it has to carry **the date it was last checked, not the
 * date it was written**. Prose can claim both and nothing can check either,
 * which is how every date in this register came to be inherited rather than
 * made.
 */
const pendingEntrySchema = z.object({
  /**
   * What is missing and how it gets closed, in a real sentence.
   *
   * The 40-character floor is not styling: it is what stops `"TODO"` closing a
   * gap. A register whose entries can be one word is a register that fills up
   * with them.
   */
  note: z.string().min(40),
  channel: gapChannel,
  /**
   * `open` — not obtained yet. `held` — obtained and deliberately NOT published.
   *
   * The two are not the same absence and must not read as one. Exactly one
   * field is `held` today: the postal code the official site publishes sits
   * outside this province's range, so publishing it would propagate an error
   * and "correcting" it would invent one.
   */
  state: z.enum(['open', 'held']),
  /**
   * The day a human last went and looked. Not the day the entry was written.
   *
   * Stamping this without checking is the one way to make the register worse
   * than having none — it converts "nobody has looked" into "somebody looked
   * and it is still missing", which is a different and false claim.
   */
  lastCheckedAt: z.iso.date(),
});

const configSchema = z
  .object({
    portal: portalSchema,
    lgu: lguSchema,
    officialSite: officialSiteSchema,
    contact: contactSchema,
    emergency: emergencySchema,
    socials: z.object({ municipalFacebook: z.url().nullable() }),
    sources: z.record(z.string(), z.url()),
    pending: z.record(z.string(), pendingEntrySchema),
  })
  .superRefine((config, ctx) => {
    const nulls = new Set(
      FACT_GROUPS.flatMap(group => nullPaths(config[group], group))
    );

    /*
     * An empty hotline list is a gap, and `nullPaths` cannot see it.
     *
     * Arrays are not descended — correctly, or every element would become a
     * registered path — so `municipalHotlines: []` was invisible to a register
     * whose entire purpose is to be exhaustive. It was also the LARGEST gap in
     * the record: a coastal municipality with no findable local emergency
     * number. The one absence most worth registering was the one the register
     * structurally could not hold.
     */
    if (config.emergency.municipalHotlines.length === 0) {
      nulls.add('emergency.municipalHotlines');
    }

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

    /*
     * The mirror of the rule above, and it was missing.
     *
     * `pending` made every NULL account for itself. Nothing made a non-null
     * one do the same, so the moment a figure was obtained it became an
     * unsourced assertion — which is the failure `lgu.history` had already
     * silently committed with six facts before 2026-08-09.
     *
     * So each tracked fact is now in exactly one of two states: null with a
     * `pending` entry saying how it gets closed, or filled with a `sources`
     * entry saying where it came from and when somebody looked. Neither, or
     * both, is a build failure.
     */
    for (const field of TRACKED_LGU_FACTS) {
      const filled = config.lgu[field] !== null;
      const sourced = field in config.lgu.sources;
      if (filled && !sourced) {
        ctx.addIssue({
          code: 'custom',
          path: ['lgu', 'sources', field],
          message: `lgu.${field} has a value and no entry in \`lgu.sources\`. Cite where it came from and when it was checked, or set it back to null with a \`pending\` entry.`,
        });
      }
      if (!filled && sourced) {
        ctx.addIssue({
          code: 'custom',
          path: ['lgu', 'sources', field],
          message: `lgu.${field} is null but carries a source. A citation for a fact this project does not hold reads as though it did.`,
        });
      }
    }

    for (const field of Object.keys(config.lgu.sources)) {
      if ((TRACKED_LGU_FACTS as readonly string[]).includes(field)) continue;
      ctx.addIssue({
        code: 'custom',
        path: ['lgu', 'sources', field],
        message: `lgu.sources.${field} names no tracked fact. Add it to TRACKED_LGU_FACTS or remove the entry.`,
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

export type PendingEntry = z.infer<typeof pendingEntrySchema>;

/**
 * Every path the gap register accounts for, as a UNION of the actual keys.
 *
 * Taken from the raw JSON rather than from the parsed value on purpose. The
 * schema types `pending` as a record keyed by `string`, which would make
 * `gapFor('lgu.populaton')` — note the typo — a perfectly well-typed call that
 * renders nothing. Read off the import, TypeScript knows the thirteen paths
 * that exist and rejects the fourteenth at compile time.
 *
 * Adding or closing a gap stays a configuration change: a new `null` plus its
 * entry widens this union by itself, and filling a value narrows it, with no
 * component edited either way.
 */
export type GapPath = keyof typeof rawConfig.pending;

/** The register's paths, in file order. */
export const GAP_PATHS = Object.keys(lguConfig.pending) as GapPath[];

/**
 * The register entry for one path — the words the UI is allowed to print.
 *
 * `GapNotice` renders what this returns and nothing else, which is what stops a
 * gap being explained one way on a page and another way in the register. The
 * throw is the runtime half of the compile-time union above: a path that
 * survives type-checking but is not in the register (a config edited without a
 * rebuild, a value read from data) fails loudly rather than rendering an empty
 * block, because an invisible gap is exactly the failure the register exists to
 * prevent.
 */
export function gapFor(path: GapPath): PendingEntry {
  const entry = lguConfig.pending[path] as PendingEntry | undefined;
  if (!entry)
    throw new Error(
      `no \`pending\` entry for "${path}". A gap surface may only render a reason the register already carries — add the entry to config/lgu.config.json, or render a value.`
    );
  return entry;
}
