import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { getCharterSections } from '@/lib/content';

/**
 * The services index — every task the charter describes, by category.
 *
 * Organised by what a resident is trying to DO, never by the org chart. The
 * categories come from the frozen task vocabulary, so which one a service sits
 * in is a decision taken once rather than re-argued per page.
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

  const t = await getTranslations('services');
  const sections = await getCharterSections();
  const total = sections.reduce((sum, one) => sum + one.pages.length, 0);
  const transcribed = sections.reduce(
    (sum, one) => sum + one.pages.filter(page => page.content !== null).length,
    0
  );

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-balance sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-secondary">
        {t('lead')}
      </p>
      {/* The count is stated because a partial transcription that does not say
          it is partial reads as a complete one. */}
      <p className="mt-3 max-w-prose leading-relaxed text-ink-secondary">
        {t('counts', { total, transcribed })}
      </p>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {sections.map(section => (
          <section
            key={section.category}
            aria-labelledby={`category-${section.category}`}
          >
            <h2
              id={`category-${section.category}`}
              className="text-lg font-semibold"
            >
              <Link
                href={`/services/${section.category}`}
                className="text-ink-link hover:text-ink-link-hover"
              >
                {t(`categories.${section.category}`)}
              </Link>
            </h2>
            <ul className="mt-3 space-y-1">
              {section.pages.map(page => (
                <li key={page.slug}>
                  <Link
                    href={`/services/${section.category}/${page.slug}`}
                    className="inline-flex min-h-11 items-center leading-snug text-ink-secondary hover:text-ink-link"
                  >
                    {page.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  );
}
