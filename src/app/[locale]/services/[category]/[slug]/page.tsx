import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Markdown } from '@/components/content/Markdown';
import { SourceDocument } from '@/components/content/SourceDocument';
import { VerificationBadge } from '@/components/content/VerificationBadge';
import { PageMasthead } from '@/components/services/PageMasthead';
import { OfficePanel } from '@/components/services/OfficePanel';
import { PageRail } from '@/components/services/PageRail';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import {
  getCharterDocumentSlug,
  getCharterPage,
  getCharterSections,
} from '@/lib/content';
import { markdownOutline } from '@/lib/markdown-outline';

/**
 * ★ TAGO-109 / TAGO-206 / TAGO-207 — one service, as the charter describes it.
 *
 * The body is generated markdown: the headings where the transcription could be
 * stood behind, and an honest account of what is missing where it could not. The
 * page's own job is the frame around it — where you are, who provides this, what
 * it was read from, and the Filipino fallback notice.
 *
 * ## What the page will NOT do to the charter's tables
 *
 * They are reproduced as the document prints them: ragged continuation rows,
 * empty cells, a fee-particulars table that runs into the client-steps grid.
 * They look tidier in the design sheet than they do here, and the sheet is
 * wrong — normalising a figure or merging a row to improve the layout is the
 * failure `transcription-integrity.test.ts` fails the build on.
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

  const { entry, body, usedFallback } = page;
  const [t, tCommon, documentSlug] = await Promise.all([
    getTranslations('services'),
    getTranslations('common'),
    getCharterDocumentSlug(entry.charterDocument.sha256),
  ]);

  const categoryLabel = t(`categories.${category}`);
  const headings = markdownOutline(body);

  return (
    <>
      <PageMasthead
        aside={
          <OfficePanel
            footer={<VerificationBadge verification={entry.verification} />}
            heading={t('whoProvidesIt')}
            offices={entry.office ? [{ name: entry.office }] : []}
          />
        }
        eyebrow={t('serviceEyebrow', { category: categoryLabel })}
        lead={entry.description}
        title={entry.name}
        trail={[
          { href: '/', label: tCommon('home') },
          { href: '/services', label: t('title') },
          { href: `/services/${category}`, label: categoryLabel },
          { label: entry.name },
        ]}
      />

      <Container className="flex flex-col gap-10 py-10 lg:flex-row lg:items-start lg:gap-14 lg:py-14">
        {/* Hidden below the desktop breakpoint, and nothing is lost: every
            heading it lists is in the article immediately beside it, in the same
            order. The rail is a shortcut, never a route. */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-60 lg:shrink-0">
          <PageRail
            footer={
              <Link
                className="text-ink-link hover:text-ink-link-hover"
                href={`/services/${category}`}
              >
                {t('backToCategory', { category: categoryLabel })}
              </Link>
            }
            heading={t('onThisPage')}
            headings={headings}
          />
        </aside>

        <article className="flex min-w-0 flex-1 flex-col gap-8">
          {/* The fallback is deliberate and it is never silent. A Filipino
              reader looking at English is told why, on the page, before the
              content — and by an icon-free, colour-independent notice, because
              a banner distinguishable only by colour is not conveyed at all. */}
          {usedFallback && (
            <p
              className="rounded-xl border border-line-control bg-surface-tint p-4 leading-relaxed text-ink"
              role="note"
            >
              {t('fallbackNotice')}
            </p>
          )}

          <Markdown>{body}</Markdown>

          {documentSlug && (
            <p>
              <Link
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink-link hover:text-ink-link-hover"
                href={`/charter/documents/${documentSlug}`}
              >
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                {entry.charterDocument.title}
              </Link>
            </p>
          )}

          <SourceDocument
            office={entry.office}
            source={entry.source}
            verification={entry.verification}
          />
        </article>
      </Container>
    </>
  );
}
