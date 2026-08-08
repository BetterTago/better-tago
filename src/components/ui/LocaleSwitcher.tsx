'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Two links, not a dropdown.
 *
 * With exactly two locales a select is more machinery than the problem needs,
 * and links keep the switch working as an ordinary navigation — no JavaScript
 * required to change language, which matters on the connections this portal is
 * built for.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const t = useTranslations('header');
  const pathname = usePathname();

  const label: Record<Locale, { short: string; full: string }> = {
    en: { short: t('english'), full: t('englishFull') },
    fil: { short: t('filipino'), full: t('filipinoFull') },
  };

  return (
    <nav aria-label={t('language')}>
      <ul className="flex items-center gap-1">
        {routing.locales.map(locale => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                hrefLang={locale}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-semibold',
                  active
                    ? 'bg-surface-inset text-ink'
                    : 'text-ink-secondary hover:text-ink-link'
                )}
              >
                <span aria-hidden="true">{label[locale].short}</span>
                <span className="sr-only">{label[locale].full}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
