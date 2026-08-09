import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { getCharterManifest, getCharterSections } from '@/lib/content';

/** One task category — every service in it, and which office provides each. */
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
    title: t(`categories.${category}`),
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

  const t = await getTranslations('services');

  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm">
        <Link
          href="/services"
          className="text-ink-link hover:text-ink-link-hover"
        >
          {t('title')}
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-bold text-balance sm:text-4xl">
        {t(`categories.${category}`)}
      </h1>

      <ul className="mt-10 divide-y divide-line-subtle border-y border-line-subtle">
        {pages.map(page => (
          <li key={page.slug} className="py-4">
            <Link
              href={`/services/${category}/${page.slug}`}
              className="font-semibold text-ink-link hover:text-ink-link-hover"
            >
              {page.name}
            </Link>
            <p className="mt-1 leading-relaxed text-ink-secondary">
              {page.description}
            </p>
            <p className="mt-1 text-sm text-ink-tertiary">
              {page.office}
              {/* Stated on the index, not only on the page: somebody scanning a
                  list needs to know which of these will actually answer them. */}
              {page.content === null ? ` · ${t('notYetTranscribed')}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
