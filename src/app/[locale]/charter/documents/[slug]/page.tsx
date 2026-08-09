import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Markdown } from '@/components/content/Markdown';
import { SourceDocument } from '@/components/content/SourceDocument';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';
import { getManifest, getPage } from '@/lib/content';

/**
 * CONT-213 — one archived charter document, transcribed in full.
 *
 * The fidelity layer. It carries every service the document sets out, in the
 * document's own order and wording, including the sixty-eight internal ones
 * that have no resident counter. A task page is what somebody reads to get
 * something done; this is what they read to check it.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/charter/documents/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = await getPage('charter', 'documents', slug, locale);
  if (!page) notFound();

  return {
    title: page.entry.name,
    description: page.entry.description,
    alternates: {
      canonical: `/${locale}/charter/documents/${slug}`,
      languages: Object.fromEntries(
        routing.locales.map(other => [
          other,
          `/${other}/charter/documents/${slug}`,
        ])
      ),
    },
    // The transcript duplicates the task pages by design. It is for checking,
    // not for finding, so it does not compete with them in a search result.
    robots: { index: false, follow: true },
  };
}

export async function generateStaticParams() {
  const pages = await getManifest('charter', 'documents');
  return routing.locales.flatMap(locale =>
    pages.map(page => ({ locale, slug: page.slug }))
  );
}

export default async function CharterDocumentPage({
  params,
}: PageProps<'/[locale]/charter/documents/[slug]'>) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const page = await getPage('charter', 'documents', slug, locale);
  if (!page) notFound();

  const t = await getTranslations('services');
  const { entry, body, usedFallback } = page;

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-balance sm:text-4xl">
        {entry.name}
      </h1>

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
