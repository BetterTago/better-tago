'use client';

import { useTranslations } from 'next-intl';
import { Container } from '@/components/ui/Container';

/** Next requires error boundaries to be Client Components. */
export default function LocaleError({ reset }: { reset: () => void }) {
  const t = useTranslations('error');

  return (
    <Container className="py-16">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <p className="mt-3 max-w-prose text-ink-secondary">{t('body')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-surface-band px-6 font-semibold text-ink-on-band hover:bg-surface-band-hover"
      >
        {t('retry')}
      </button>
    </Container>
  );
}
