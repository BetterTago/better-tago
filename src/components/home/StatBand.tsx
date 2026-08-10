import { getFormatter, getTranslations } from 'next-intl/server';
import { CountUp } from '@/components/ui/CountUp';
import { GapNotice } from '@/components/ui/GapNotice';
import { Link } from '@/i18n/navigation';
import { type GapPath, lguConfig } from '@/lib/lgu-config';

/**
 * The province's own land area, for the share the land-area caption states.
 *
 * 🔴 A DERIVED figure, so the working is shown rather than the result asserted.
 * `253.28 ÷ 4932.70 × 100 = 5.13%`.
 *
 * The denominator is the province's total land area as published in the same
 * tertiary record's article on Surigao del Sur, retrieved 2026-08-10, where the
 * infobox and the body text agree exactly — unlike the municipality's own
 * article, whose two land areas do not.
 *
 * ⚠️ It also settles which of those two is wrong. The Tago article claims its
 * 343.52 km² is "about 7.55% of the total area of Surigao del Sur"; against
 * 4,932.70 km² that share is 6.96%, not 7.55%. The body paragraph therefore
 * fails against the province's own published figure as well as against its own
 * infobox, which is why the infobox value is the one this portal publishes.
 *
 * Recorded here rather than in the configuration because it is not a fact ABOUT
 * Tago — it is the denominator of a presentation-level ratio. The value it
 * divides, and the full reasoning, are in `lgu.sources.landAreaKm2.note`.
 */
const PROVINCE_LAND_AREA_KM2 = 4932.7;

/**
 * The four headline figures, as a full-bleed band.
 *
 * A blocking band on `--surface-band` — the emblem's deep green in light theme
 * and the night band in dark — carrying `data-surface="inverse"` so its ink,
 * link and line roles all re-point and no child sets a colour of its own. The
 * heading is `sr-only`: the band is a landmark for a screen reader and a
 * horizontal rule for everyone else, and a visible "at a glance" title above
 * four figures earns nothing.
 *
 * ## Every figure here is `V1`, and the captions say so
 *
 * Three of the four were closed on 2026-08-10 through a TERTIARY path: the
 * national statistics authority's own PSGC record answers HTTP 403 to an
 * automated request, so the population, the census year and the barangay count
 * were read from an encyclopaedia that attributes them to that release. The
 * land area came the same way and is worse — its source prints two values that
 * differ by 36% and reconciles neither.
 *
 * Each caption says the one thing a reader wants beside the number — the census
 * and the agency, the classification, the share of the province. The full
 * citation, the retrieval date and the reasoning live in
 * `lgu.sources.<field>.note`, one edit away from the value they explain.
 *
 * Income class is the only one of the four the municipality states about itself.
 *
 * ## The gap contract still governs this band
 *
 * A figure with no value renders its register entry, verbatim, through
 * `GapNotice` — never an em dash, a zero, `N/A`, a skeleton, an "approximate"
 * value, or the neighbouring city's answer. Nothing is missing today, and the
 * branch is still built and still tested, because the day a figure is withdrawn
 * is the worst possible day to discover its empty state was never designed.
 *
 * ## Adding or closing a figure requires no code change
 *
 * The band iterates `FIGURES`; each entry resolves to a value with its
 * `lgu.sources` citation, or falls to the gap list. `lgu-config.ts` refuses to
 * parse a value without a source or a null without a register entry, so the two
 * halves cannot drift.
 */
const FIGURES = [
  { key: 'population', gap: 'lgu.population', fractionDigits: 0 },
  // Income class rather than households, by instruction: it is the figure the
  // municipality states about ITSELF, and a household count adds little beside
  // a population a reader has just read.
  { key: 'incomeClass', gap: null, fractionDigits: 0 },
  { key: 'barangayCount', gap: 'lgu.barangayCount', fractionDigits: 0 },
  // Two decimals kept deliberately: 253 is a different, unsourced figure, and
  // this one is contested enough already.
  { key: 'landAreaKm2', gap: 'lgu.landAreaKm2', fractionDigits: 2 },
] as const;

export async function StatBand({
  locale,
  /* Defaulted from the configuration so the fully-populated band — and the gap
     branch — are both reachable from a fixture. */
  lgu = lguConfig.lgu,
}: {
  locale: string;
  lgu?: (typeof lguConfig)['lgu'];
}) {
  const [t, format] = await Promise.all([
    getTranslations('stats'),
    getFormatter(),
  ]);

  const present = FIGURES.map(figure => ({
    ...figure,
    value: lgu[figure.key],
  })).filter(figure => figure.value !== null);

  const missing = FIGURES.filter(figure => lgu[figure.key] === null);

  return (
    <section
      data-surface="inverse"
      aria-labelledby="stats-heading"
      className="border-y border-line bg-surface-band text-ink"
    >
      <h2 id="stats-heading" className="sr-only">
        {t('regionLabel')}
      </h2>

      {present.length > 0 && (
        <dl className="page-measure grid grid-cols-1 gap-x-10 gap-y-8 py-9 sm:grid-cols-2 lg:grid-cols-4">
          {present.map(figure => {
            const numeric = typeof figure.value === 'number';
            const formatted = numeric
              ? format.number(figure.value as number, {
                  minimumFractionDigits: figure.fractionDigits,
                  maximumFractionDigits: figure.fractionDigits,
                })
              : String(figure.value);

            return (
              <div key={figure.key}>
                <dt className="mb-2 text-2xs font-semibold tracking-caps text-ink-on-band-muted uppercase">
                  {t(`label.${figure.key}`)}
                </dt>
                <dd>
                  <span className="font-display text-stat font-bold tabular-nums">
                    {numeric ? (
                      // Animates up to a value ALREADY in the server-rendered
                      // HTML, so nothing ever publishes "0 residents" — not
                      // even for a frame.
                      <CountUp
                        to={figure.value as number}
                        fractionDigits={figure.fractionDigits}
                        locale={locale}
                      >
                        {formatted}
                      </CountUp>
                    ) : (
                      formatted
                    )}
                    {figure.key === 'landAreaKm2' && (
                      <span className="text-lg font-medium text-ink-on-band-muted">
                        {' '}
                        {t('squareKilometres')}
                      </span>
                    )}
                  </span>

                  {/*
                    A caption, not a link — a 15px-tall tap target under a
                    headline figure is worse than no link. It says the one thing
                    a reader wants beside the number; the full citation, the
                    retrieval date and the reasoning live in
                    `lgu.sources.<field>` and surface on the register.

                    🔴 The barangay caption states an ABSENCE rather than a
                    split, and this was checked twice, on request, before being
                    left that way. The urban/rural classification is published
                    only on the national statistics authority's PSGC record,
                    confirmed to be a Cloudflare JavaScript challenge rather
                    than a simple bot block — no automated fetch can complete
                    it. A tertiary aggregator (philatlas.com) was read as a
                    second channel and carries five population columns for
                    Tago's barangays and no classification column at all. A
                    caption reading "18 urban, 6 rural" would be invented, and
                    inventing it here — under a real figure, in the same
                    typeface — is exactly how a guess acquires the authority of
                    a fact. See `lgu.pending['lgu.psgc']` for both attempts.
                  */}
                  <span className="mt-2 block text-xs leading-relaxed text-ink-on-band-muted">
                    {figure.key === 'landAreaKm2'
                      ? t('caption.landAreaKm2', {
                          percent: format.number(
                            ((figure.value as number) /
                              PROVINCE_LAND_AREA_KM2) *
                              100,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          ),
                        })
                      : t(`caption.${figure.key}`)}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {missing.length > 0 && (
        <div className="page-measure pb-9">
          {/*
            ONE notice for the figures that are not obtained, rather than a row
            of identical dashed boxes. It carries the first missing figure's own
            words, from the register, and the rest are named beside it.
          */}
          <GapNotice path={missing[0].gap as GapPath} />
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-on-band-muted">
            {t('alsoMissing', {
              figures: missing
                .map(figure => t(`label.${figure.key}`))
                .join(t('listSeparator')),
            })}{' '}
            <Link
              href="/gaps"
              className="underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
            >
              {t('seeRegister')}
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
