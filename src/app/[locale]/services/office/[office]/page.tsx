import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { OfficePanel } from '@/components/services/OfficePanel';
import { PageMasthead } from '@/components/services/PageMasthead';
import { ServiceRow } from '@/components/services/ServiceRow';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCharterCheckedAt, getServicesByOffice } from '@/lib/content';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';

/**
 * ★ TAGO-204 — the task index, narrowed to one office.
 *
 * ## 🔴 Why the filter is a route SEGMENT and not `?office=`
 *
 * TAGO-204 wants filter state in the URL **and** the index working with
 * JavaScript disabled. Those two are in direct tension under `cacheComponents`,
 * which will not let a prerendered route read a search parameter outside
 * `<Suspense>` — and a Suspense boundary streams as a `hidden` div plus an
 * inline script that moves it into place, so with scripting off the rows are in
 * the HTML and invisible. That exact version was built, measured and rejected on
 * the search route; this route exists so it is not rebuilt here.
 *
 * A segment is known at render start. Eighteen offices prerender, the filtered
 * view is an ordinary shareable URL, and there is nothing to hydrate.
 *
 * ## What this route is NOT
 *
 * It is not the office directory (TAGO-107), and it must not become one: no
 * mandate, no personnel, no organisational description. The office here is a
 * FILTER over resident tasks, which is the distinction TAGO-204's second
 * criterion protects — offices never become the way services are found.
 *
 * ## An unknown office redirects; an unknown CATEGORY 404s
 *
 * Those look inconsistent and are not. A category is a page — TAGO-108's third
 * criterion makes an unknown one a real 404, because it names content that does
 * not exist. This segment is a FILTER VALUE, and TAGO-204's fifth criterion says
 * an unknown or malformed one renders the unfiltered list rather than an error.
 * So it redirects to `/services`, which IS the unfiltered list.
 *
 * The distinction is worth keeping: a stale link to a renamed office lands the
 * reader on every service instead of on an error, and a mistyped category still
 * says plainly that there is no such thing.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services/office/[office]'>): Promise<Metadata> {
  const { locale, office } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const entry = (await getServicesByOffice()).find(
    group => group.office.slug === office
  );
  // Metadata for a URL the page itself redirects away from is never rendered.
  if (!entry) redirect(`/${locale}/services`);

  const t = await getTranslations({ locale, namespace: 'services' });
  return {
    // The office's own name, not a translated string: it is the name printed on
    // the door and on the charter, and translating it would stop a reader
    // matching this page to either (TAGO-206 criterion 4).
    title: entry.office.name,
    description: t('officeLead'),
    alternates: { canonical: `/${locale}/services/office/${office}` },
  };
}

export async function generateStaticParams() {
  const groups = await getServicesByOffice();
  return routing.locales.flatMap(locale =>
    groups.map(group => ({ locale, office: group.office.slug }))
  );
}

export default async function OfficeServicesPage({
  params,
}: PageProps<'/[locale]/services/office/[office]'>) {
  const { locale, office } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tCommon, groups, checkedAt, format] = await Promise.all([
    getTranslations('services'),
    getTranslations('common'),
    getServicesByOffice(),
    getCharterCheckedAt(),
    getFormatter(),
  ]);

  const entry = groups.find(group => group.office.slug === office);
  // TAGO-204 criterion 5: an unknown filter value falls back to the unfiltered
  // list, never to an error or an empty page.
  if (!entry) redirect(`/${locale}/services`);

  return (
    <>
      <PageMasthead
        aside={
          <OfficePanel
            heading={t('whoProvidesThese')}
            offices={[{ name: entry.office.name }]}
          />
        }
        eyebrow={t('officeEyebrow', { count: entry.pages.length })}
        lead={t('officeLead')}
        title={entry.office.name}
        trail={[
          { href: '/', label: tCommon('home') },
          { href: '/services', label: t('title') },
          { label: entry.office.name },
        ]}
      />

      <Container className="flex flex-col gap-5 py-10 lg:py-14">
        <ul className="divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {entry.pages.map(page => (
            <li key={`${page.category}/${page.slug}`}>
              <ServiceRow
                description={page.description}
                href={`/services/${page.category}/${page.slug}`}
                // The CATEGORY, not the office — every row on this page has the
                // same office, and repeating it eighteen times says nothing.
                meta={t(`categories.${page.category}`)}
                name={page.name}
                transcribed={page.content !== null}
              />
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-tertiary">
          <Link
            className="min-h-11 content-center text-ink-link hover:text-ink-link-hover"
            href="/services"
          >
            {t('officeBackToAll')}
          </Link>
          {checkedAt && (
            <p>
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
