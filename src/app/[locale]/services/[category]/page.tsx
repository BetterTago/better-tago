import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { CategoryRail } from '@/components/services/CategoryRail';
import { OfficeChips } from '@/components/services/OfficeChips';
import { OfficePanel } from '@/components/services/OfficePanel';
import { PageMasthead } from '@/components/services/PageMasthead';
import { ServiceRow } from '@/components/services/ServiceRow';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import {
  getCharterCheckedAt,
  getCharterManifest,
  getCharterSections,
  getManifest,
} from '@/lib/content';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';

/**
 * ★ TAGO-204 / TAGO-207 — one task category.
 *
 * Every service in it, which office provides each, and whether the charter's
 * requirements, fees and steps are on the page yet. The last of those is stated
 * per service rather than only in aggregate, because somebody scanning a list
 * needs to know which of these will actually answer them.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services/[category]'>): Promise<Metadata> {
  const { locale, category } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const pages = await getCharterManifest('services', category);
  if (pages.length === 0) notFound();

  const t = await getTranslations({ locale, namespace: 'services' });
  return {
    // "Civil registry services", not "Civil registry" — the tab and the search
    // result both have to say what KIND of page this is without the H1 beside
    // them to explain it.
    title: t('categoryMetaTitle', { category: t(`categories.${category}`) }),
    description: t(`categoryDescriptions.${category}`),
    alternates: { canonical: `/${locale}/services/${category}` },
  };
}

export async function generateStaticParams() {
  const sections = await getCharterSections();
  return routing.locales.flatMap(locale =>
    sections.map(section => ({ locale, category: section.category }))
  );
}

export default async function CategoryPage({
  params,
}: PageProps<'/[locale]/services/[category]'>) {
  const { locale, category } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const pages = await getCharterManifest('services', category);
  // A category with no manifest is a 404, never an empty page rendered at 200.
  if (pages.length === 0) notFound();

  const [t, tCommon, sections, directory, checkedAt, format] =
    await Promise.all([
      getTranslations('services'),
      getTranslations('common'),
      getCharterSections(),
      getManifest('government', 'offices'),
      getCharterCheckedAt(),
      getFormatter(),
    ]);

  const label = t(`categories.${category}`);
  const transcribed = pages.filter(page => page.content !== null).length;

  /*
   * The offices providing this category, in document order of first appearance.
   * Six of the eleven categories have more than one, which is why the panel and
   * the chips are both plural — the design sheet's single-office card is right
   * for five of them and wrong for the rest.
   */
  const slugOf = new Map(directory.map(office => [office.name, office.slug]));
  const offices = [...new Set(pages.map(page => page.office))]
    .filter((name): name is string => name !== undefined)
    .map(name => ({
      name,
      slug: slugOf.get(name),
      count: pages.filter(page => page.office === name).length,
    }))
    .filter(
      (office): office is { name: string; slug: string; count: number } =>
        office.slug !== undefined
    );

  const railItems = sections
    .map(section => ({
      slug: section.category,
      label: t(`categories.${section.category}`),
      count: section.pages.length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <>
      <PageMasthead
        aside={
          <OfficePanel
            footer={
              <p className="flex items-start gap-2 text-2xs text-ink-tertiary">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-meter"
                />
                {t('coverageInCategory', { transcribed, total: pages.length })}
              </p>
            }
            heading={t('whoProvidesThese')}
            offices={offices}
          />
        }
        eyebrow={t('categoryEyebrow', { count: pages.length })}
        lead={t(`categoryDescriptions.${category}`)}
        title={label}
        trail={[
          { href: '/', label: tCommon('home') },
          { href: '/services', label: t('title') },
          { label },
        ]}
      />

      <Container className="flex flex-col gap-8 py-10 lg:flex-row lg:items-start lg:gap-14 lg:py-14">
        {/* Hidden below the desktop breakpoint. Every sibling category stays
            reachable through the breadcrumb's "Services" link and the cards on
            that page — a second eleven-item list above the services a reader
            came here to read would cost more than it gives. */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-60 lg:shrink-0">
          <CategoryRail
            current={category}
            heading={t('allCategories')}
            items={railItems}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <OfficeChips offices={offices} total={pages.length} />

          {/* Every service, never a page of them. The largest category holds 23
              rows; a "show the rest" control that works without JavaScript is a
              second route for no benefit, and truncating a civic index hides
              answers from the people least able to go looking for them. */}
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface-raised">
            {pages.map(page => (
              <li key={page.slug}>
                <ServiceRow
                  description={page.description}
                  href={`/services/${category}/${page.slug}`}
                  meta={page.office ?? ''}
                  name={page.name}
                  transcribed={page.content !== null}
                />
              </li>
            ))}
          </ul>

          {checkedAt && (
            <p className="text-sm text-ink-tertiary">
              {t('readFromCharter', {
                date: format.dateTime(calendarDate(checkedAt), CALENDAR_DATE),
              })}
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
