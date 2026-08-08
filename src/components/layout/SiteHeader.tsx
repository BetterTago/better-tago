import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { Logo } from '@/components/ui/Logo';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { lguConfig } from '@/lib/lgu-config';

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations('header');
  const { wordmark, name } = lguConfig.portal;

  return (
    <header className="border-b border-line">
      <Container className="flex items-center justify-between gap-4 py-2">
        <Link
          href="/"
          aria-label={t('homeLink', { portal: name })}
          className="inline-flex min-h-11 items-center gap-3 font-semibold tracking-tight"
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
        <LocaleSwitcher current={locale} />
      </Container>
    </header>
  );
}
