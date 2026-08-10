import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryCard } from '@/components/services/CategoryCard';
import { CategoryRail } from '@/components/services/CategoryRail';
import { CoverageMeter } from '@/components/services/CoverageMeter';
import { PageMasthead } from '@/components/services/PageMasthead';
import { SearchForm } from '@/components/home/SearchForm';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCharterCheckedAt, getCharterSections } from '@/lib/content';

/**
 * ★ TAGO-204 / TAGO-209 — the services index, re-indexed by task.
 *
 * Organised by what a resident is trying to DO, never by the org chart. The
 * categories come from the frozen task vocabulary, so which one a service sits
 * in is a decision taken once rather than re-argued per page.
 *
 * ## Why the coverage figure is in the masthead
 *
 * A partial transcription that does not say it is partial reads as a complete
 * one. The count, the source and the check date sit beside the search field
 * rather than at the foot of the page, because a claim made below the fold is a
 * claim most readers never meet.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'services' });

  return {
    title: t('title'),
    description: t('lead'),
    alternates: { canonical: `/${locale}/services` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function ServicesIndex({
  params,
}: PageProps<'/[locale]/services'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tCommon, tNav, sections, checkedAt] = await Promise.all([
    getTranslations('services'),
    getTranslations('common'),
    getTranslations('nav'),
    getCharterSections(),
    getCharterCheckedAt(),
  ]);

  // Sorted by the LABEL the reader sees, not by the slug — the two agree in
  // English today and there is no reason they should in Filipino.
  const categories = sections
    .map(section => ({
      slug: section.category,
      label: t(`categories.${section.category}`),
      description: t(`categoryDescriptions.${section.category}`),
      count: section.pages.length,
      examples: section.pages.slice(0, 3).map(page => page.name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const total = sections.reduce((sum, one) => sum + one.pages.length, 0);
  const transcribed = sections.reduce(
    (sum, one) => sum + one.pages.filter(page => page.content !== null).length,
    0
  );

  return (
    <>
      <PageMasthead
        aside={
          <div className="flex flex-col gap-4">
            <SearchForm locale={locale} variant="compact" />
            <CoverageMeter
              checkedAt={checkedAt}
              total={total}
              transcribed={transcribed}
            />
          </div>
        }
        eyebrow={t('eyebrow')}
        lead={t('lead')}
        title={t('title')}
        trail={[{ href: '/', label: tCommon('home') }, { label: t('title') }]}
      />

      <Container className="flex flex-col gap-10 py-10 lg:flex-row lg:items-start lg:gap-14 lg:py-14">
        {/*
         * Hidden below the desktop breakpoint, and nothing becomes unreachable:
         * every category the rail lists is a CARD in the column beside it. An
         * eleven-item list stacked above the cards would push the page's actual
         * content most of a phone screen down to duplicate what is already
         * there. (TAGO-209 criterion 4.)
         */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-60 lg:shrink-0">
          <CategoryRail
            footer={
              <Link
                className="text-ink-link hover:text-ink-link-hover"
                href="/gaps"
              >
                {tNav('gaps')}
              </Link>
            }
            heading={t('categoriesCount', { count: categories.length })}
            items={categories}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-feature font-bold text-ink">
              {t('browseHeading')}
            </h2>
            <p className="text-sm text-ink-tertiary">{t('sortedAZ')}</p>
          </div>

          <ul className="grid gap-5 md:grid-cols-2">
            {categories.map(category => (
              <li key={category.slug} className="flex">
                <CategoryCard {...category} />
              </li>
            ))}
          </ul>

          {/* The register is the honest counterpart of an index: this one
              carries what the municipality has published, and what it has not
              is listed openly rather than left as a silence. */}
          <div
            className="mt-2 flex flex-col gap-5 rounded-2xl bg-surface-inverse p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7"
            data-surface="inverse"
          >
            <div className="flex flex-col gap-1.5">
              <p className="font-display text-lg font-bold text-ink">
                {t('missingCtaTitle')}
              </p>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {t('missingCtaBody')}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-accent-400 px-5 text-sm font-semibold text-ink-on-accent hover:opacity-90"
              href="/gaps"
            >
              {t('missingCtaAction')}
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
