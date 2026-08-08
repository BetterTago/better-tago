import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { routing } from '@/i18n/routing';

/**
 * The 404 a visitor actually gets.
 *
 * `app/[locale]/not-found.tsx` only renders when `notFound()` is called from
 * inside that segment — and `proxy.ts` negotiates the locale before a request
 * can reach it, so an unmatched URL (`/nope`, `/xx`) falls through to here
 * instead. Without this file that visitor gets Next's built-in, untranslated
 * "404: This page could not be found."
 *
 * It cannot know the locale: a URL that matched no route has none to negotiate
 * from, so next-intl resolves to the default. That is why the copy is
 * deliberately plain — it has to work for a reader who asked for Filipino.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: 'meta',
  });
  return { title: t('notFoundTitle'), robots: { index: false } };
}

export default async function NotFound() {
  /*
   * Required, and easy to miss out here. The `[locale]` layout calls this for
   * every route inside the segment; this file is outside it, so without the
   * call next-intl resolves the locale by READING THE REQUEST — runtime data
   * accessed outside <Suspense> under `cacheComponents`, which silently stops
   * this route prerendering.
   */
  setRequestLocale(routing.defaultLocale);

  const [t, tCommon] = await Promise.all([
    getTranslations({ locale: routing.defaultLocale, namespace: 'notFound' }),
    getTranslations({ locale: routing.defaultLocale, namespace: 'common' }),
  ]);

  return (
    <Container className="py-16">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <p className="mt-3 max-w-prose text-ink-secondary">{t('body')}</p>
      {/*
        Unprefixed href and `next/link` rather than the localised helper:
        outside the [locale] segment there is no locale to prefix with, and
        `proxy.ts` negotiates `/` to the reader's own locale anyway.
      */}
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink-link px-6 font-semibold text-ink-inverse hover:bg-ink-link-hover"
      >
        {tCommon('home')}
      </Link>
    </Container>
  );
}
