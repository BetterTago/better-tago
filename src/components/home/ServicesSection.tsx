import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Section } from '@/components/ui/Section';
import { Link } from '@/i18n/navigation';
import { getCharterSections } from '@/lib/content';

/**
 * Services — the strongest content this portal has.
 *
 * The whole Citizen's Charter is transcribed: 99 services for residents across
 * 11 categories, each carrying the charter's own requirements, fees, processing
 * times and client steps, at `V3`, with the source document and its retrieval
 * date attached. So this section renders **real cards to live routes**.
 *
 * ## What is deliberately not decided here
 *
 * The reference portal ranks a featured service and a "most asked" set. That
 * ranking is a CONTENT decision — it belongs to the frozen task vocabulary and
 * to whatever frequency data exists — and none is recorded. So this section
 * does not invent one: the featured card is the index itself, and the grid is
 * the categories in the charter's own order with their real counts.
 *
 * Ranking by what looks impressive would be a guess wearing the clothes of
 * data, which is the specific failure this portal exists to avoid.
 *
 * ## ⚠️ The transcription is not second-person verified, and this section no
 * longer says so
 *
 * Every figure here was transcribed once and checked by nobody: the two-person
 * rule (PROG-101) stands and the Verifier role is vacant. That caveat used to
 * be stated on the face of this section — removed by instruction on
 * 2026-08-10, along with its link back to the charter. Nothing about the
 * underlying fact changed: `VerificationBadge` (TAGO-104) is the mechanism
 * this project has for surfacing that on the pages themselves, and it is not
 * yet wired into these cards. Recorded here rather than silently dropped,
 * because the next person reading this file should know the disclosure was a
 * deliberate choice to remove, not an oversight.
 */
export async function ServicesSection() {
  const t = await getTranslations('services');
  const tHome = await getTranslations('home');
  const sections = await getCharterSections();

  const total = sections.reduce((sum, one) => sum + one.pages.length, 0);
  const transcribed = sections.reduce(
    (sum, one) => sum + one.pages.filter(page => page.content !== null).length,
    0
  );

  return (
    <Section
      id="services"
      eyebrow={tHome('eyebrowServices')}
      heading={tHome('servicesHeading')}
      intro={
        <p className="mb-6 leading-relaxed text-ink-secondary">{t('lead')}</p>
      }
      aside={
        <Link
          href="/services"
          className="inline-flex min-h-11 items-center gap-1.5 text-cta font-semibold text-ink-link hover:text-ink-link-hover"
        >
          {tHome('allServices')}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      }
      className="page-measure"
    >
      {/* The featured card, on the gold ground. `data-surface="accent"`
          re-points ink and links inside it, so nothing here carries a colour
          of its own. */}
      <Link
        href="/services"
        data-surface="accent"
        className="block rounded-2xl bg-accent-400 p-6 text-ink hover:bg-accent-300 sm:p-8 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1"
      >
        <p className="text-2xs font-semibold tracking-label uppercase">
          {tHome('featuredEyebrow')}
        </p>
        <p className="mt-2 font-display text-feature font-bold text-balance">
          {t('counts', { total, transcribed })}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-cta font-semibold">
          {tHome('browseByTask')}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </span>
      </Link>

      <h3 className="mt-8 text-sm font-semibold text-ink">
        {tHome('byCategory')}
      </h3>
      {/* Card titles nest under the group heading that names them, not directly
          under the section h2 — a screen reader browsing by heading gets the
          grouping for free. */}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(section => (
          <li key={section.category}>
            <Link
              href={`/services/${section.category}`}
              className="flex h-full min-h-11 flex-col rounded-xl border border-line bg-surface-raised p-4 hover:border-ink-link motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1"
            >
              <span className="font-semibold text-ink">
                {t(`categories.${section.category}`)}
              </span>
              <span className="mt-1 text-sm text-ink-secondary tabular-nums">
                {tHome('serviceCount', { count: section.pages.length })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
