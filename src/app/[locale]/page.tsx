import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactSection } from '@/components/home/ContactSection';
import { EmergencySection } from '@/components/home/EmergencySection';
import { GettingHere } from '@/components/home/GettingHere';
import { Hero } from '@/components/home/Hero';
import { HistorySection } from '@/components/home/HistorySection';
import { ServicesSection } from '@/components/home/ServicesSection';
import { StatBand } from '@/components/home/StatBand';
import { routing } from '@/i18n/routing';

/**
 * The home page.
 *
 * ## It replaced the holding page
 *
 * Until 2026-08-10 this route served a single notice saying nothing had been
 * published. That was correct when it was written and stopped being correct the
 * day the Citizen's Charter was transcribed: 99 service guides became reachable
 * at `/services` while the front door still told every arriving reader there
 * was nothing here.
 *
 * ⚠️ **The independence section that replaced that notice was removed by
 * instruction on 2026-08-10.** It sat directly under the hero and carried what
 * this project is, what it is not, what has actually been published, and the
 * deference clause. `TAGO-110`'s fourth criterion — *the page states what this
 * project is and is not, and links the official record, ABOVE THE FOLD* — is
 * therefore **unmet**, and that box is un-ticked rather than quietly dropped.
 *
 * What still carries the claim: the footer's independence statement, which
 * renders on every page in the page's own language and is asserted by
 * `guardrails.test.ts`. It is below the fold, which is the difference.
 *
 * ## Section order — reversed by instruction on 2026-08-10
 *
 * History was 02 and emergency was 03 for exactly one design reason:
 * "on this portal the emergency section's content IS a gap, and a gap about
 * emergency numbers in a municipality facing the Pacific is the most
 * important thing this page has to say." That reasoning has not gone away —
 * `emergency.municipalHotlines` is still `[]` — but the ORDER now runs
 * history before emergency, by direct instruction, and this doc comment says
 * so plainly rather than leaving the old argument standing unchallenged next
 * to code that no longer follows it.
 *
 * There is no analytics, no tracking pixel and no third-party script here, and
 * there will not be: this is a civic site and traffic is deliberately not a
 * measured outcome.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <Hero locale={locale} />
      <StatBand locale={locale} />
      <ServicesSection />
      <HistorySection />
      <EmergencySection />
      <GettingHere />
      <ContactSection />
    </>
  );
}
