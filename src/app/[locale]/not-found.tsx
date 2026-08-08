import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { Link } from '@/i18n/navigation';

export default async function LocaleNotFound() {
  const [t, tCommon] = await Promise.all([
    getTranslations('notFound'),
    getTranslations('common'),
  ]);

  return (
    <Container className="py-16">
      <h1 className="text-2xl font-bold">{t('heading')}</h1>
      <p className="mt-3 max-w-prose text-ink-secondary">{t('body')}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-ink-link px-6 font-semibold text-ink-inverse hover:bg-ink-link-hover"
      >
        {tCommon('home')}
      </Link>
    </Container>
  );
}
