import { ArrowUpRight, TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { lguConfig } from '@/lib/lgu-config';
import { telHref } from '@/lib/tel';
import { EmergencyCallBand } from './EmergencyCallBand';

/**
 * Who to call, as a directory — the BODY of the emergency surface, with no
 * frame of its own.
 *
 * ## Why it is a component and not a section
 *
 * It renders in two places: inside `EmergencySection` on the home page's dark
 * slab, and inside `/emergency`, which is the same directory under a masthead.
 * Two copies of a list of emergency numbers is two lists that can disagree
 * about what a resident should dial, and the one that is wrong will be the one
 * nobody remembered to update. So the frame is what differs and the directory
 * is shared.
 *
 * 🔴 **It sets no ground and no measure**, deliberately. Every colour here is a
 * ROLE token — `text-ink`, `bg-surface-raised`, `border-line` — so the same
 * markup is correct on the home page's `data-surface="inverse"` slab and on the
 * ordinary page surface of `/emergency` without a single conditional. A literal
 * or a `dark:` utility would have made it right in exactly one of them.
 *
 * What renders:
 *
 * · A **provenance callout**, above the numbers, linking the source.
 * · **Six agencies**, two columns, each one row however many numbers it has.
 * · The **national line**, as a full-width band at the BOTTOM — the one number
 *   that works from any phone anywhere.
 *
 * What never renders: a provincial number substituted FOR a missing municipal
 * one, an undated number, or a plausible guess. Two entries ARE
 * provincial/national bodies (the Coast Guard station, the Red Cross) — listed
 * because they serve Tago and a resident needs them, which is a different thing
 * from substitution.
 */
export async function EmergencyDirectory({
  /* Defaulted from the configuration so the populated state is reachable from a
     fixture — see HotlineTicker for the reasoning. */
  emergency = lguConfig.emergency,
  headingLevel = 3,
}: {
  emergency?: (typeof lguConfig)['emergency'];
  /**
   * The level for each agency's name. `3` under the home page's section `h2`,
   * `2` on `/emergency`, where the section's title has moved up to the
   * masthead's `h1` and there is no `h2` between the two.
   *
   * A prop rather than a fixed tag because a heading level is a fact about
   * where a component SITS, not about what it is — and a page that jumps from
   * `h1` to `h3` tells a screen-reader user a level is missing that is not.
   */
  headingLevel?: 2 | 3;
} = {}) {
  const [t, tCommon] = await Promise.all([
    getTranslations('emergency'),
    getTranslations('common'),
  ]);

  const AgencyHeading = `h${headingLevel}` as const;

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
   * agency is ever re-sourced, this callout would silently misattribute it, and
   * the per-row verification line removed on 2026-08-10 is what has to come
   * back.
   */
  const hotlineSource = emergency.municipalHotlines[0]?.source;

  return (
    <>
      {hasMunicipal ? (
        <>
          {/* 🔴 The provenance callout sits ABOVE the numbers, never in a
              footnote. A reader deciding whether to trust a number needs it
              BEFORE they read one — and it links the source so they can check
              it themselves rather than taking this page's word. */}
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-line-control bg-surface-sunken px-4 py-3.5">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4.5 shrink-0 text-ink-accent"
            />
            <p className="text-sm leading-relaxed text-ink-secondary">
              {t('sourced')}{' '}
              {hotlineSource?.url && (
                <a
                  href={hotlineSource.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-1 underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
                >
                  {hotlineSource.label}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  {/* The arrow is for sighted readers; this is the same fact
                      for everyone else. An icon alone is not an accessible
                      indication that a link leaves the site and opens a tab. */}
                  <span className="sr-only">
                    ({tCommon('opensExternalSite')})
                  </span>
                </a>
              )}
            </p>
          </div>

          {/*
            ONE panel, rows divided by a rule — not six separate cards. Six
            bordered cards read as six unrelated things; a single bounded list
            reads as one directory, which is what it is.

            Each row splits: the agency on the START side, its numbers on the
            END side. An agency is ONE row however many numbers it publishes — a
            reader scanning for "who do I call" reads the agency first, and
            repeating its name beside each number would bury exactly that.

            Two columns at `lg`, so the six sit three and three; the rule
            between rows is drawn with `border-t` on every row but the first in
            each column.
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
                  // The split is `flex` at EVERY width — not `sm:flex-row`. The
                  // agency block is squeezed to the START side and the numbers
                  // held against the END side on a phone exactly as on a
                  // desktop. `items-start`, not `baseline`, so a two-line agency
                  // name does not drag its numbers down.
                  <li
                    key={hotline.label}
                    className="flex items-start justify-between gap-x-4 border-t border-line px-4 py-3 first:border-t-0 sm:px-5"
                  >
                    {/* `min-w-0` is what actually lets this side be squeezed:
                        without it a long agency name sets a min-content floor
                        and pushes the numbers off the end rather than
                        wrapping. */}
                    <div className="min-w-0 flex-1">
                      <AgencyHeading className="text-base font-semibold text-balance text-ink">
                        {hotline.label}
                      </AgencyHeading>
                      {/* What the agency actually handles, in a resident's
                          words. The name tells somebody who already knows which
                          one they want; this is for the reader who knows their
                          situation and not the org chart. */}
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
                          // No min-height: three stacked 44px rows would make
                          // the disaster office tower over the others. NOTE this
                          // drops below the 44px floor — a listed exemption in
                          // e2e/home.a11y.spec.ts.
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

      {/* The national line, promoted to a full-width band at the BOTTOM. It is
          the one number that is real, sourced and works from any phone — so it
          closes the directory rather than competing with the six above it. */}
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
    </>
  );
}
