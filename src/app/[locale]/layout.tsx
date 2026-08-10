import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdvisoryBar } from '@/components/layout/AdvisoryBar';
import { HotlineTicker } from '@/components/layout/HotlineTicker';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BackToTop } from '@/components/ui/BackToTop';
import { HtmlLang } from '@/components/ui/HtmlLang';
import { SkipLink } from '@/components/ui/SkipLink';
import { routing } from '@/i18n/routing';
import { getAdvisory } from '@/lib/advisory';
import { lguConfig } from '@/lib/lgu-config';

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'meta' });
  const { domain, name } = lguConfig.portal;

  return {
    metadataBase: new URL(domain),
    /*
     * `BetterTago | <page>` — the mark first, then the page.
     *
     * A tab strip truncates from the RIGHT, so the portal's name has to lead or
     * a reader with eight tabs open sees eight identical stubs. The `default` is
     * the only title with no page of its own to name, so it carries the whole
     * claim instead: what this is, whose information it indexes, and that it
     * covers services, government and public data. Templates never apply to a
     * `default`, so it states the brand itself.
     */
    title: { default: t('title'), template: `${name} | %s` },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map(other => [other, `/${other}`])
      ),
    },
    /*
     * 🔴 The card a shared link produces, and what is DELIBERATELY absent here.
     *
     * These pages are meant to travel — TAGO-204 asks for a filtered view that
     * can be sent to somebody in a message, and a service page is the thing a
     * resident forwards to a relative. This block is inherited by every route,
     * so anything stated flatly here is stated on all 300 of them.
     *
     * `title`, `description` and `url` are all omitted ON PURPOSE, and each was
     * WRONG here before:
     *
     * · a flat `title` was inherited verbatim, so every one of the ~300 pages
     *   shared as "BetterTago | Municipality of Tago Services, Government Info
     *   & Public Data". Declaring it as `{default, template}` does not help —
     *   Next resolves an openGraph title against its own default, not against
     *   the page's document title, so every page still got the default. Omitted,
     *   Next fills `og:title` from the page's RESOLVED title, template and all.
     * · a flat `description` put the home page's summary on every service page.
     *   Omitted, Next fills it from that page's own `description`.
     * · a flat `url` pointed every card at the home page. Omitted, a consumer
     *   uses the URL it fetched, which is the page it is actually sharing.
     *
     * All three were verified in a browser rather than reasoned about. If any is
     * ever reinstated, it belongs on a route, never here.
     */
    openGraph: {
      type: 'website',
      siteName: name,
      locale,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  /*
   * Required in every page and layout under this segment. next-intl reads the
   * locale from async storage; a segment that skips this makes it read the
   * REQUEST instead, which under `cacheComponents` is runtime data accessed
   * outside <Suspense> — the route silently stops prerendering. It does not
   * throw and the page looks perfect, which is exactly why it needs a rule.
   */
  setRequestLocale(locale);

  const [t, advisory] = await Promise.all([
    getTranslations({ locale, namespace: 'advisory' }),
    getAdvisory(),
  ]);

  return (
    <NextIntlClientProvider>
      <HtmlLang locale={locale} />
      <SkipLink />

      {/* Above the header, and above the advisory: in an emergency the number
          is the first thing on the page. */}
      <HotlineTicker />

      {/*
        Renders only when a verified advisory exists in content, which is not
        the case today. A permanent specimen bar is worse than none — a bar that
        is always there teaches people to ignore the one that matters.
      */}
      {advisory && (
        <AdvisoryBar
          advisoryId={advisory.id}
          body={advisory.body}
          regionLabel={t('regionLabel')}
          badgeLabel={t('badge')}
          dismissLabel={t('dismiss')}
        />
      )}

      <SiteHeader locale={locale} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </NextIntlClientProvider>
  );
}
