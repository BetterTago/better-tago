import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
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
          className="inline-flex min-h-11 items-center font-semibold tracking-tight"
        >
          <span className="text-ink-secondary">{wordmark.lead}</span>
          <span className="text-ink uppercase">{wordmark.main}</span>
        </Link>
        <LocaleSwitcher current={locale} />
      </Container>
    </header>
  );
}
