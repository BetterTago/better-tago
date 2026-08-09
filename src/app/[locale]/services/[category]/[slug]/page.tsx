import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Markdown } from '@/components/content/Markdown';
import { SourceDocument } from '@/components/content/SourceDocument';
import { VerificationBadge } from '@/components/content/VerificationBadge';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { getCharterPage, getCharterSections } from '@/lib/content';

/**
 * ★ TAGO-109 — one service, as the charter describes it.
 *
 * The body is generated markdown: the eight headings where the transcription
 * could be stood behind, and an honest account of what is missing where it
 * could not. The page's own job is the frame around it — the citation, the
 * verification state, and the Filipino fallback notice.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/services/[category]/[slug]'>): Promise<Metadata> {
  const { locale, category, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = await getCharterPage('services', category, slug, locale);
  if (!page) notFound();

  return {
    title: page.entry.name,
    description: page.entry.description,
    alternates: {
      canonical: `/${locale}/services/${category}/${slug}`,
      languages: Object.fromEntries(
        routing.locales.map(other => [
          other,
          `/${other}/services/${category}/${slug}`,
        ])
      ),
    },
  };
}

export async function generateStaticParams() {
  const sections = await getCharterSections();
  return routing.locales.flatMap(locale =>
    sections.flatMap(section =>
      section.pages.map(page => ({
        locale,
        category: section.category,
        slug: page.slug,
      }))
    )
  );
}

export default async function ServicePage({
  params,
}: PageProps<'/[locale]/services/[category]/[slug]'>) {
  const { locale, category, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = await getCharterPage('services', category, slug, locale);
  // An unknown slug is a 404, never a soft 200 with a message inside it.
  if (!page) notFound();

  const t = await getTranslations('services');
  const { entry, body, usedFallback } = page;

  return (
    <Container className="py-12 sm:py-16">
      <p className="text-sm">
        <Link
          href={`/services/${category}`}
          className="text-ink-link hover:text-ink-link-hover"
        >
          {t(`categories.${category}`)}
        </Link>
      </p>

      <h1 className="mt-3 text-3xl font-bold text-balance sm:text-4xl">
        {entry.name}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <VerificationBadge verification={entry.verification} />
      </div>

      {/* The fallback is deliberate and it is never silent. A Filipino reader
          looking at English is told why, on the page, before the content. */}
      {usedFallback ? (
        <p
          role="note"
          className="mt-6 rounded-lg border border-line bg-surface-tint p-4 leading-relaxed text-ink-secondary"
        >
          {t('fallbackNotice')}
        </p>
      ) : null}

      <article className="mt-8">
        <Markdown>{body}</Markdown>
      </article>

      <div className="mt-12">
        <SourceDocument
          source={entry.source}
          verification={entry.verification}
          office={entry.office}
        />
      </div>
    </Container>
  );
}
