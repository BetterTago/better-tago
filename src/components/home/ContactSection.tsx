import { getTranslations } from 'next-intl/server';
import { ContactDirectory } from '@/components/contact/ContactDirectory';
import { Logo } from '@/components/ui/Logo';
import { Section } from '@/components/ui/Section';
import { lguConfig } from '@/lib/lgu-config';

/**
 * How to reach the municipality — section 05 of the home page, and the whole of
 * `/contact`.
 *
 * ## One section, two surfaces
 *
 * `variant="page"` renders the SAME section — the same dark slab, the same
 * glow, the same cropped mark and the same three cards — under `/contact`'s
 * masthead instead of inside the home page. By instruction: the section's
 * format is preserved rather than reinterpreted as a light-ground page, so a
 * reader who knows the home page recognises the page they arrive at from the
 * menu.
 *
 * The two differ in exactly two ways, both following from the masthead above
 * it: no eyebrow and no heading (the section's title has been TRANSFERRED to
 * the masthead's `h1` rather than repeated under it), and no top margin, since
 * on the page the slab butts against the masthead's own bottom rule.
 *
 * Because the heading moved up, the cards' labels move up a level with it — see
 * `headingLevel`. A page whose only heading below the `h1` is an `h3` tells a
 * screen-reader user a level is missing that is not.
 *
 * Cards and mark ported from BetterTandag's `ContactSection` (2026-08-10, by
 * instruction) — the whole-card-as-link mechanic, the icon-tile layout, and the
 * `contact-mark` silhouette sizing/position are the same; the content, palette
 * and gradient stops are this portal's own.
 */
export async function ContactSection({
  variant = 'home',
}: { variant?: 'home' | 'page' } = {}) {
  const [t, tHome] = await Promise.all([
    getTranslations('contact'),
    getTranslations('home'),
  ]);

  const onPage = variant === 'page';

  return (
    <div
      data-surface="inverse"
      /*
       * No top margin, and that is a change rather than an omission.
       *
       * The slab is full-bleed, so it carried `mt-14 sm:mt-16` to separate
       * itself from the measured content above — which had no bottom padding of
       * its own. `LocalConditions` now precedes it on the home page and brings
       * `py-14 sm:py-16`, so the margin stacked on top of that padding and this
       * seam ran to twice the size of every other one on the page.
       *
       * ⚠️ The gap here is now the PRECEDING section's bottom padding. If this
       * slab is ever moved to follow a section that has none, it needs its
       * margin back — `EmergencySection` is the live example: `HistorySection`
       * runs into it with no bottom padding, so that slab keeps its margin.
       */
      className="relative overflow-hidden bg-surface-inverse text-ink"
    >
      <div aria-hidden="true" className="slab-glow absolute inset-0" />
      {/* Cropped silhouette. `Logo` is `aria-hidden` by construction and the
          utility adds `pointer-events-none` — texture, not content. It needs
          no colour of its own: this ground is `data-surface="inverse"`,
          where the mark's role tokens already resolve to white, so the
          three-tone emblem flattens to one shape on its own. */}
      <Logo idPrefix="contact-mark" className="contact-mark opacity-5" />

      <div className="relative">
        {onPage ? (
          // No `Section`: its eyebrow and heading are exactly what the masthead
          // above already carries. The measure and the vertical rhythm are the
          // section's own, so the slab reads identically on both surfaces.
          <div className="page-measure py-14 sm:py-16">
            <ContactDirectory headingLevel={2} />
          </div>
        ) : (
          <Section
            id="contact"
            eyebrow={tHome('eyebrowContact')}
            /* The section's own title, and — since the `/contact` route
               shipped — that page's heading too. One key, so the destination a
               reader reaches from the menu is named the same as the section
               they may have read first. */
            heading={t('heading', { municipality: lguConfig.lgu.officialName })}
            className="page-measure py-14 sm:py-16"
          >
            <ContactDirectory />
          </Section>
        )}
      </div>
    </div>
  );
}
