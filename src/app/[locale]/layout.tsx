import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { HtmlLang } from '@/components/ui/HtmlLang';
import { SkipLink } from '@/components/ui/SkipLink';
import { routing } from '@/i18n/routing';
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
    title: { default: t('title'), template: `%s · ${name}` },
    description: t('description'),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map(other => [other, `/${other}`])
      ),
    },
    openGraph: {
      type: 'website',
      siteName: name,
      locale,
      title: t('title'),
      description: t('description'),
      url: `/${locale}`,
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

  return (
    <NextIntlClientProvider>
      <HtmlLang locale={locale} />
      <SkipLink />
      <SiteHeader locale={locale} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
