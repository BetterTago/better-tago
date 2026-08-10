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
export function LocaleSwitcher({
  current,
  className,
}: {
  current: Locale;
  className?: string;
}) {
  const t = useTranslations('header');
  const pathname = usePathname();

  const label: Record<Locale, { short: string; full: string }> = {
    en: { short: t('english'), full: t('englishFull') },
    fil: { short: t('filipino'), full: t('filipinoFull') },
  };

  return (
    <nav aria-label={t('language')} className={className}>
      {/*
       * A SEGMENTED control with a real boundary, not two bare words.
       *
       * The active option used to be marked with `bg-surface-sunken`, which
       * sits about 1.02:1 against the page ground — a difference that is real
       * in the token table and invisible on a screen. Neither option had a
       * border either, so the pair read as body text rather than as something
       * you could operate.
       *
       * (The two values are deliberately NOT quoted here: the guardrail scan
       * bans colour literals outside globals.css, comments included, and it is
       * right to — a hex in a comment is the first step to a hex in a class.)
       *
       * The group now carries the boundary and the active segment is FILLED
       * with the brand band (white on green, 6.45:1 — the pair measured in
       * theme-tokens.test.ts). Every token here re-points per theme, so this is
       * one set of classes that is correct in light and dark alike.
       */}
      <ul
        data-control
        className="flex items-center gap-0.5 rounded-lg border border-line-control bg-surface-raised p-0.5"
      >
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
                  // 28px, by instruction — the 44px version was too heavy for
                  // the header. Below the touch floor, so it carries
                  // `data-control` and is a LISTED exemption in
                  // e2e/home.a11y.spec.ts rather than a silent shrink. The
                  // reference portal sizes its own switcher the same way.
                  'inline-flex min-h-7 items-center justify-center rounded-md px-2 text-xs font-semibold motion-safe:transition-colors motion-safe:duration-150',
                  // Never colour alone: the active option also carries
                  // `aria-current`, which is what a screen reader announces.
                  active
                    ? 'bg-surface-band text-ink-on-band'
                    : 'text-ink-secondary hover:bg-surface-control hover:text-ink'
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
