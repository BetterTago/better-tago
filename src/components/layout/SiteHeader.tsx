import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations('header');
  const { wordmark, name } = lguConfig.portal;

  return (
    <header className="border-b border-line">
      {/*
       * `flex-wrap` and `min-w-0` are what make this row's width independent of
       * the font, and both are load-bearing.
       *
       * Neither child could shrink before: a flex item defaults to
       * `min-width: auto`, so the wordmark forced its full text width and the
       * control group forced 145px, and the row fitted 320px only because the
       * developer machine resolved `ui-sans-serif` to something narrow. A bare
       * Linux runner resolves it to DejaVu Sans, which is wider, and the page
       * scrolled sideways by 7px — caught by the 320px assertion on the first
       * CI run this project ever had.
       *
       * The fix is not a tighter gap, which would only move the threshold. With
       * the wordmark allowed to shrink and the row allowed to wrap, there is no
       * font wide enough to make this overflow.
       */}
      <Container className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 sm:gap-x-4">
        <Link
          href="/"
          aria-label={t('homeLink', { portal: name })}
          className="inline-flex min-h-11 min-w-0 items-center gap-3 font-semibold tracking-tight"
        >
          {/* aria-hidden inside the mark, because this link is already labelled
              — an <svg role="img"> here would make it announce twice.

              gap-3, not gap-2: the mark's clear-space rule is one emblem radius
              on every side, and the emblem is r=12 at scale 2.2105 = 26.5 units
              of a 114-unit box — 8.4px once the mark is drawn at 36. 8px would
              sit inside its own keep-out field. */}
          <Logo idPrefix="site-header" />
          {/* The two halves are one word — they must not pick up the flex gap
              that separates the wordmark from the mark. */}
          <span>
            <span className="text-ink-secondary">{wordmark.lead}</span>
            <span className="text-ink uppercase">{wordmark.main}</span>
          </span>
        </Link>
        {/* A Server Component holding two client leaves. The header itself
            stays server-rendered; only the two controls that need a browser
            cross the boundary. */}
        <div className="flex items-center gap-1">
          <LocaleSwitcher current={locale} />
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
