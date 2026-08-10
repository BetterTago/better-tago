import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Section } from '@/components/ui/Section';
import { lguConfig } from '@/lib/lgu-config';
import { telHref } from '@/lib/tel';
import { EmergencyCallBand } from './EmergencyCallBand';

/**
 * Emergency — section 03, after history.
 *
 * 🔴 **On this portal the emergency section's content IS a gap, and a gap about
 * emergency numbers in a municipality facing the Pacific is the most important
 * thing this page has to say.** That has not changed. What changed, by
 * instruction on 2026-08-10, is where the section SITS: it was originally
 * promoted to position 02, ahead of history, on the strength of that argument.
 * It now runs after history instead. The argument for building it as a
 * first-class section rather than an empty state stands regardless of where
 * it sits in the page — that part of this comment was never about ordering.
 *
 * ## Six agencies now render here, at `V3`
 *
 * Until 2026-08-10 this section rendered a `GapNotice` and nothing else: four
 * sweeps — the official site, the provincial site and two national police
 * directories — had all come back empty, so the honest content was the
 * absence. The numbers were then found on the municipality's own official
 * Facebook page, which is the municipality publishing them on its own channel:
 * `V3` by this project's definition, not a hand-off taken on trust.
 *
 * The old caution survives as SHAPE rather than as prose: a provenance callout
 * still sits ABOVE the numbers rather than in a footnote, and it links the
 * source so a reader can check it instead of taking this page's word.
 *
 * ⚠️ Each agency USED to repeat its own verification level beside its name.
 * That was removed on 2026-08-10, by instruction, as redundant with the
 * callout — which is true while all six share one source and one level. It
 * stops being true the moment one is re-sourced at a different level, and at
 * that point the per-row line has to come back rather than the callout being
 * quietly widened to cover a claim it no longer makes. `verification` is still
 * required per hotline in the schema, so the data is there when it is needed.
 *
 * What renders today:
 *
 * · A **provenance callout**, above the numbers, linking the source.
 * · **Six agencies**, two columns, each one row however many numbers it has.
 * · The **national line**, as a full-width band at the BOTTOM — the one number
 *   that works from any phone anywhere.
 *
 * The "where this project looked" list of failed sweeps was removed on
 * 2026-08-10, by instruction, now that the search has succeeded.
 * `emergency.sourcesChecked` is unchanged in the configuration and still
 * carries all four, so the record of the search is intact — it is simply no
 * longer rendered.
 *
 * What still never renders: a provincial number substituted FOR a missing
 * municipal one, an undated number, or a plausible guess. Two entries ARE
 * provincial/national bodies (the Coast Guard station, the Red Cross) — listed
 * because they serve Tago and a resident needs them, which is a different
 * thing from substitution.
 *
 * The section sits on a full-bleed dark slab in both themes
 * (`data-surface="inverse"`), so its ink, link and line roles all re-point.
 * `text-ink` is applied ON that element and not left to inherit: `body` sets
 * `color` from `--ink`, which resolves to the LIGHT theme's near-black there
 * and inherits down as a fixed value, so without this the headings inside the
 * slab render black on a dark ground.
 */
export async function EmergencySection({
  /* Defaulted from the configuration so the populated state is reachable from a
     fixture — see HotlineTicker for the reasoning. */
  emergency = lguConfig.emergency,
}: {
  emergency?: (typeof lguConfig)['emergency'];
} = {}) {
  const [t, tHome] = await Promise.all([
    getTranslations('emergency'),
    getTranslations('home'),
  ]);
  /*
   * The guard is on the STATUS as well as the array: `partial` or `requested`
   * with a stale array is exactly the state in which a half-obtained number
   * could leak onto a page.
   *
   * There is deliberately NO `GapNotice` fallback any more. It used to render
   * `pending['emergency.municipalHotlines']` — and the moment the numbers were
   * published, the schema deleted that register entry (a `pending` key whose
   * value is no longer missing fails the parse). `GapPath` is a union read off
   * the register, so the old fallback stopped type-checking, which is the type
   * system correctly reporting that the gap is closed. Withdrawing the numbers
   * would restore the register entry and the branch together — a deliberate
   * edit, which is the right cost for taking emergency numbers off a page.
   */
  const hasMunicipal =
    emergency.status === 'obtained' && emergency.municipalHotlines.length > 0;

  /*
   * All six share one source — the municipality's own page — so the citation
   * is stated ONCE above the list rather than repeated six times.
   *
   * ⚠️ That is only honest while they genuinely do share it. This reads the
   * first entry's source and presents it as the source for all of them; if an
   * agency is ever re-sourced, this callout would silently misattribute it,
   * and the per-row line removed on 2026-08-10 is what has to come back.
   */
  const hotlineSource = emergency.municipalHotlines[0]?.source;

  return (
    <div
      data-surface="inverse"
      className="relative mt-14 overflow-hidden bg-surface-inverse text-ink sm:mt-16"
    >
      <div aria-hidden="true" className="slab-glow absolute inset-0" />
      <div className="relative">
        <Section
          id="emergency"
          eyebrow={tHome('eyebrowEmergency')}
          heading={tHome('emergencyHeading')}
          className="page-measure pb-14 sm:pb-16"
          intro={
            <p className="mb-6 leading-relaxed text-ink-secondary">
              {tHome('emergencyIntro')}
            </p>
          }
        >
          {hasMunicipal ? (
            <>
              {/* 🔴 The provenance callout sits ABOVE the numbers, never in a
                  footnote. A reader deciding whether to trust a number needs
                  it BEFORE they read one — and it links the source so they can
                  check it themselves rather than taking this page's word. */}
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-line-control bg-surface-sunken px-4 py-3.5">
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4.5 shrink-0 text-ink-accent"
                />
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {tHome('hotlinesSourced')}{' '}
                  {hotlineSource?.url && (
                    <a
                      href={hotlineSource.url}
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
                    >
                      {hotlineSource.label}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                      />
                    </a>
                  )}
                </p>
              </div>

              {/*
                ONE panel, rows divided by a rule — not six separate cards.
                Six bordered cards read as six unrelated things; a single
                bounded list reads as one directory, which is what it is.

                Each row splits: the agency on the START side, its numbers on
                the END side. An agency is ONE row however many numbers it
                publishes — a reader scanning for "who do I call" reads the
                agency first, and repeating its name beside each number would
                bury exactly that.

                Two columns at `lg`, so the six sit three and three; the rule
                between rows is drawn with `border-t` on every row but the
                first in each column.
              */}
              <div className="grid gap-x-4 lg:grid-cols-2">
                {[
                  emergency.municipalHotlines.slice(0, 3),
                  emergency.municipalHotlines.slice(3),
                ].map((column, columnIndex) => (
                  <ul
                    key={columnIndex}
                    className="overflow-hidden rounded-2xl border border-line bg-surface-raised"
                  >
                    {column.map(hotline => (
                      // The split is `flex` at EVERY width — not `sm:flex-row`.
                      // The agency block is squeezed to the START side and the
                      // numbers held against the END side on a phone exactly as
                      // on a desktop. `items-start`, not `baseline`, so a
                      // two-line agency name does not drag its numbers down.
                      <li
                        key={hotline.label}
                        className="flex items-start justify-between gap-x-4 border-t border-line px-4 py-3 first:border-t-0 sm:px-5"
                      >
                        {/* `min-w-0` is what actually lets this side be
                            squeezed: without it a long agency name sets a
                            min-content floor and pushes the numbers off the end
                            rather than wrapping. */}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-balance text-ink">
                            {hotline.label}
                          </h3>
                          {/* What the agency actually handles, in a resident's
                              words. The name tells somebody who already knows
                              which one they want; this is for the reader who
                              knows their situation and not the org chart. */}
                          <p className="mt-0.5 text-xs text-ink-secondary">
                            {hotline.role}
                          </p>
                        </div>
                        {/* `shrink-0`: a number must never wrap mid-digits. */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {hotline.numbers.map(number => (
                            <a
                              key={number}
                              href={telHref(number)}
                              aria-label={t('callAria', {
                                organisation: hotline.label,
                                number,
                              })}
                              // No min-height: three stacked 44px rows would
                              // make the disaster office tower over the
                              // others. NOTE this drops below the 44px floor —
                              // a listed exemption in e2e/home.a11y.spec.ts.
                              className="inline-flex items-center py-0.5 font-display text-base font-semibold whitespace-nowrap text-ink-link tabular-nums hover:text-ink-link-hover"
                            >
                              {number}
                            </a>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </>
          ) : null}

          {/* The national line, promoted to a full-width band at the BOTTOM of
              the section. It is the one number that is real, sourced and
              works from any phone — so it closes the section rather than
              competing with the six above it. */}
          <div className="mt-6">
            <EmergencyCallBand
              label={t('nationalLine')}
              number={emergency.nationalLine}
              callLabel={t('callAria', {
                organisation: t('nationalLine'),
                number: emergency.nationalLine,
              })}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
