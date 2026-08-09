import { z } from 'zod';
import rawFreshness from '../../config/freshness.config.json';

/**
 * ★ TAGO-401 — how a check date becomes a staleness state.
 *
 * 🔴 **Shipped in half, deliberately.** The contract, the computation and the
 * report are here. What is NOT here is the rendered notice a resident sees:
 * that is `StalenessNotice` in TAGO-104, which is Wave 3 and behind the
 * PROG-104 gate. Recorded so nobody later reads this contract as fully frozen.
 *
 * The half deferred adds no field and changes no shape; it only reads one.
 *
 * Framework-free on purpose, for the same reason `content-schema.ts` is:
 * `content.ts` imports `next/cache` and cannot be unit-tested, and this is
 * arithmetic that decides whether a resident is shown a warning.
 */

const classSchema = z.object({
  cadenceDays: z.int().positive(),
  why: z.string().min(1),
  immediateTriggers: z.array(z.string().min(1)).min(1),
});

const freshnessConfigSchema = z.object({
  note: z.string().min(1),
  classes: z.record(z.string(), classSchema),
});

export const freshnessConfig = freshnessConfigSchema.parse(rawFreshness);

export type DataClass = keyof typeof freshnessConfig.classes;

/** Every declared class name. The one list — nothing hardcodes a subset. */
export const DATA_CLASSES = Object.keys(freshnessConfig.classes);

export const isDataClass = (value: unknown): value is string =>
  typeof value === 'string' && value in freshnessConfig.classes;

/**
 * `fresh` — inside its cadence.
 * `due` — within the last tenth of its cadence, so a review can be scheduled
 *   before a reader ever sees a warning.
 * `stale` — past it. This is what the notice renders on, once one exists.
 * `undated` — a check date in the future, which is not a state a real check
 *   can produce and is therefore a defect rather than a degree of staleness.
 */
export type Freshness = 'fresh' | 'due' | 'stale' | 'undated';

const DAY_MS = 86_400_000;

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end))
    throw new Error(`not an ISO date: ${from} / ${to}`);
  return Math.round((end - start) / DAY_MS);
}

/**
 * The whole computation, and **no page can opt out of it** (★ criterion 2):
 * an unknown class throws rather than defaulting to a long cadence, because a
 * page that quietly never goes stale is the exact failure this ticket closes.
 *
 * `forcedStaleClasses` carries ★ criterion 3 — an immediate trigger firing.
 * `charter-diff` is its first real caller: a document whose checksum moved
 * makes every page derived from it stale that day, not at its next annual
 * review.
 */
export function freshnessOf(
  dataClass: string,
  lastCheckedAt: string,
  today: string,
  forcedStaleClasses: readonly string[] = []
): Freshness {
  const declared = freshnessConfig.classes[dataClass];
  if (!declared)
    throw new Error(
      `unknown data class "${dataClass}". Declare it in config/freshness.config.json — a page with no cadence never goes stale, which is the failure this exists to prevent.`
    );

  const age = daysBetween(lastCheckedAt, today);
  if (age < 0) return 'undated';
  if (forcedStaleClasses.includes(dataClass)) return 'stale';
  if (age > declared.cadenceDays) return 'stale';
  if (age > declared.cadenceDays * 0.9) return 'due';
  return 'fresh';
}

export const cadenceOf = (dataClass: string): number => {
  const declared = freshnessConfig.classes[dataClass];
  if (!declared) throw new Error(`unknown data class "${dataClass}"`);
  return declared.cadenceDays;
};

export const triggersFor = (dataClass: string): readonly string[] => {
  const declared = freshnessConfig.classes[dataClass];
  if (!declared) throw new Error(`unknown data class "${dataClass}"`);
  return declared.immediateTriggers;
};
