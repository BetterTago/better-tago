import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmergencySection } from '@/components/home/EmergencySection';
import { PageMasthead } from '@/components/services/PageMasthead';
import { routing } from '@/i18n/routing';

/**
 * Who to call in Tago — the emergency directory, on its own page.
 *
 * ## Why it is a route and not only a section
 *
 * The header's Emergency entry pointed at `#emergency` on the home page. An
 * in-page anchor is fine on the page it belongs to and poor everywhere else: a
 * reader three levels into the service guides who taps Emergency was sent back
 * to the front door and then scrolled most of the way down it. On the one
 * surface somebody might reach in a storm, that is the wrong number of steps.
 * It is now a URL a resident can bookmark, share, or open cold.
 *
 * ## Nothing here is copied
 *
 * The page renders `EmergencySection` itself, at `variant="page"` — the same
 * dark slab, the same glow, the same measure and the same directory the home
 * page shows. By instruction: the section's format is preserved rather than
 * reinterpreted as a light-ground page, so a reader who knows the home page
 * recognises what they arrive at from the menu, and the six agencies cannot
 * drift between the two surfaces because there is only one of them.
 *
 * What this route adds is the masthead every secondary page opens with
 * (TAGO-209 criterion 1 — no route styles its own header), carrying the trail,
 * the eyebrow, the lead, and the section's own title promoted to the page's
 * `h1`. The section below therefore renders no heading of its own rather than
 * repeating it.
 *
 * The provenance callout stays where it is, INSIDE the directory and above the
 * numbers, rather than moving into the masthead's aside slot. That slot carries
 * the source on the services routes, and it would be defensible here — but a
 * reader deciding whether to trust a number needs the citation immediately
 * above the number, not beside the title.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/emergency'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'emergency' });

  return {
    title: t('heading'),
    description: t('intro'),
    alternates: { canonical: `/${locale}/emergency` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function EmergencyPage({
  params,
}: PageProps<'/[locale]/emergency'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tCommon, tNav] = await Promise.all([
    getTranslations('emergency'),
    getTranslations('common'),
    getTranslations('nav'),
  ]);

  return (
    <>
      <PageMasthead
        eyebrow={t('eyebrow')}
        lead={t('intro')}
        title={t('heading')}
        trail={[
          { href: '/', label: tCommon('home') },
          { label: tNav('emergency') },
        ]}
      />

      <EmergencySection variant="page" />
    </>
  );
}
