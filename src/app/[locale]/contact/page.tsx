import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactSection } from '@/components/home/ContactSection';
import { LocalConditions } from '@/components/home/LocalConditions';
import { PageMasthead } from '@/components/services/PageMasthead';
import { routing } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';

/**
 * How to reach the municipality — on its own page.
 *
 * 🔴 **The municipality, never this project.** Every route on this page reaches
 * the municipal hall. The portal is an independent index and is not a channel
 * to the LGU; nothing here should read as though a message sent to us reaches
 * them.
 *
 * ## Why it is a route and not only a section
 *
 * The header's Contact entry pointed at `#contact`, which sent a reader on any
 * other page back to the home page and then most of the way down it. A contact
 * address is exactly the kind of thing somebody arrives looking for, from a
 * search result or a link, and it now has a URL they can be sent straight to.
 *
 * ## Nothing here is copied
 *
 * The page renders `ContactSection` itself, at `variant="page"` — the same dark
 * slab, the same glow, the same cropped mark and the same three cards the home
 * page shows. By instruction: the section's format is preserved rather than
 * reinterpreted as a light-ground page, so a reader who knows the home page
 * recognises what they arrive at from the menu, and a phone number cannot be
 * current on one surface and stale on the other because there is only one of
 * them.
 *
 * What this route adds is the masthead every secondary page opens with, carrying
 * the trail, the eyebrow, the lead, and the section's own title promoted to the
 * page's `h1`. The section below therefore renders no heading of its own rather
 * than repeating it.
 */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'contact' });

  return {
    title: t('heading', { municipality: lguConfig.lgu.officialName }),
    description: t('intro'),
    alternates: { canonical: `/${locale}/contact` },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function ContactPage({
  params,
}: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, tCommon, tNav] = await Promise.all([
    getTranslations('contact'),
    getTranslations('common'),
    getTranslations('nav'),
  ]);

  return (
    <>
      <PageMasthead
        eyebrow={t('eyebrow')}
        lead={t('intro')}
        title={t('heading', { municipality: lguConfig.lgu.officialName })}
        trail={[
          { href: '/', label: tCommon('home') },
          { label: tNav('contact') },
        ]}
      />

      {/*
        The map and the conditions card, directly under the hero — the same
        panel the home page carries, mounted here by instruction on 2026-08-21.
        It belongs on this route more than on any other: a reader who has opened
        "Contact" is asking where the hall is and how to reach it, which is what
        the map answers, and whether it is worth the trip today, which is what
        the card answers.

        🔴 It is a COMPONENT reused, not a copy. The marker, the address and the
        directions link all resolve from `config/lgu.config.json` through
        `LocalConditions`, so this page cannot drift from the home page's answer
        to the same question.

        ⚠️ This is the second route to fetch OpenStreetMap tiles from a reader's
        browser, and it is now a deliberate short list rather than one exception.
        The panel states that on the page itself, here as on the home page. It
        must not be promoted into the locale layout — that would put a
        third-party request on all ~380 routes and inherit the emergency layer's
        meaning; see the component's own note.
      */}
      <LocalConditions />

      <ContactSection variant="page" />
    </>
  );
}
