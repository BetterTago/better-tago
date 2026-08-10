import { useTranslations } from 'next-intl';
import type { NavItem } from '@/data/navigation';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ComingSoonBadge } from './ComingSoonBadge';

/**
 * A navigation destination that may not exist yet.
 *
 * Most of this portal's route map is still unbuilt, so those entries render as
 * NON-LINKS rather than links that 404 — a 404 reached from a site's own
 * navigation reads as a broken site, and this portal cannot afford to look
 * broken while it is asking to be trusted.
 *
 * `aria-disabled` plus a hint in text, never colour alone. `variant="badge"`
 * shows the visible marker where there is room; the desktop header row uses the
 * quieter `inline`, which puts the same information in an `sr-only` span.
 */
export function NavLink({
  item,
  className,
  variant = 'inline',
}: {
  item: NavItem;
  className?: string;
  variant?: 'inline' | 'badge';
}) {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const label = tNav(item.messageKey);

  if (item.status === 'coming-soon') {
    return (
      <span
        aria-disabled="true"
        className={cn('cursor-default text-ink-tertiary', className)}
      >
        {label}
        {variant === 'badge' ? (
          <ComingSoonBadge className="ms-2" />
        ) : (
          <span className="sr-only"> — {tCommon('comingSoon')}</span>
        )}
      </span>
    );
  }

  // In-page anchors stay a plain <a>; next-intl's Link is for routed paths and
  // would prefix an anchor with the locale.
  if (item.href.startsWith('#')) {
    return (
      <a
        href={item.href}
        className={cn(
          'text-ink-secondary hover:text-ink-link-hover',
          className
        )}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn('text-ink-secondary hover:text-ink-link-hover', className)}
    >
      {label}
    </Link>
  );
}
