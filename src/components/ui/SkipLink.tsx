import { getTranslations } from 'next-intl/server';

/**
 * First tab stop on every page. Visually hidden until focused, then it has to
 * be genuinely visible — a skip link that stays invisible on focus is worse
 * than none, because a keyboard user cannot tell it fired.
 */
export async function SkipLink() {
  const t = await getTranslations('common');

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface-page focus:px-4 focus:font-semibold focus:text-ink-link focus:shadow-lg"
    >
      {t('skipToContent')}
    </a>
  );
}
