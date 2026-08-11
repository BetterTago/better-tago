import { getTranslations } from 'next-intl/server';
import { EmergencyDirectory } from '@/components/emergency/EmergencyDirectory';
import { Section } from '@/components/ui/Section';
import type { lguConfig } from '@/lib/lgu-config';
import { cn } from '@/lib/utils';

/**
 * Emergency — section 03 of the home page, and the whole of `/emergency`.
 *
 * 🔴 **On this portal the emergency section's content IS a gap, and a gap about
 * emergency numbers in a municipality facing the Pacific is the most important
 * thing this page has to say.** That has not changed. What changed, by
 * instruction on 2026-08-10, is where the section SITS: it was originally
 * promoted to position 02, ahead of history, on the strength of that argument.
 * It now runs after history instead. The argument for building it as a
 * first-class section rather than an empty state stands regardless of where it
 * sits in the page — that part of this comment was never about ordering.
 *
 * ## One section, two surfaces
 *
 * `variant="page"` renders the SAME section — the same dark slab, the same
 * glow, the same measure and the same directory — under `/emergency`'s masthead
 * instead of inside the home page. By instruction: the section's format is
 * preserved rather than reinterpreted as a light-ground page, so a reader who
 * knows the home page recognises the page they arrive at from the menu.
 *
 * The two differ in exactly two ways, both of which follow from the masthead
 * above it:
 *
 * · **No eyebrow and no heading.** "03 — Emergency" is a position on the home
 *   page and means nothing on its own URL, and the section's title has been
 *   TRANSFERRED to the masthead's `h1` rather than repeated under it.
 * · **No top margin.** On the home page the slab is separated from history; on
 *   the page it butts against the masthead's own bottom rule.
 *
 * Because the heading moved up, the directory's agency names move up a level
 * with it — see `headingLevel`. A page whose only heading below the `h1` is an
 * `h3` tells a screen-reader user a level is missing that is not.
 *
 * ## Six agencies render here, at `V3`
 *
 * Until 2026-08-10 this section rendered a `GapNotice` and nothing else: four
 * sweeps — the official site, the provincial site and two national police
 * directories — had all come back empty, so the honest content was the absence.
 * The numbers were then found on the municipality's own official Facebook page,
 * which is the municipality publishing them on its own channel: `V3` by this
 * project's definition, not a hand-off taken on trust.
 *
 * The "where this project looked" list of failed sweeps was removed on
 * 2026-08-10, by instruction, now that the search has succeeded.
 * `emergency.sourcesChecked` is unchanged in the configuration and still
 * carries all four, so the record of the search is intact — it is simply no
 * longer rendered.
 *
 * The slab is full-bleed in both themes (`data-surface="inverse"`), so its ink,
 * link and line roles all re-point. `text-ink` is applied ON that element and
 * not left to inherit: `body` sets `color` from `--ink`, which resolves to the
 * LIGHT theme's near-black there and inherits down as a fixed value, so without
 * this the headings inside the slab render black on a dark ground.
 */
export async function EmergencySection({
  /* Defaulted inside the directory, and passed straight through, so the
     populated state stays reachable from a fixture. */
  emergency,
  variant = 'home',
}: {
  emergency?: (typeof lguConfig)['emergency'];
  variant?: 'home' | 'page';
} = {}) {
  const [t, tHome] = await Promise.all([
    getTranslations('emergency'),
    getTranslations('home'),
  ]);

  const onPage = variant === 'page';

  return (
    <div
      data-surface="inverse"
      className={cn(
        'relative overflow-hidden bg-surface-inverse text-ink',
        !onPage && 'mt-14 sm:mt-16'
      )}
    >
      <div aria-hidden="true" className="slab-glow absolute inset-0" />
      <div className="relative">
        {onPage ? (
          // No `Section`: its eyebrow and heading are exactly what the masthead
          // above already carries. The measure and the vertical rhythm are the
          // section's own, so the slab reads identically on both surfaces.
          <div className="page-measure py-14 sm:py-16">
            <EmergencyDirectory emergency={emergency} headingLevel={2} />
          </div>
        ) : (
          <Section
            id="emergency"
            eyebrow={tHome('eyebrowEmergency')}
            /* The section's own title, and — since the `/emergency` route
               shipped — that page's heading too. One key, so the destination a
               reader reaches from the menu is named the same as the section
               they may have read first. */
            heading={t('heading')}
            className="page-measure pb-14 sm:pb-16"
            intro={
              <p className="mb-6 leading-relaxed text-ink-secondary">
                {t('intro')}
              </p>
            }
          >
            <EmergencyDirectory emergency={emergency} />
          </Section>
        )}
      </div>
    </div>
  );
}
