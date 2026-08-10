import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ExternalNavItem } from '@/data/navigation';
import { cn } from '@/lib/utils';

/**
 * A link off this site.
 *
 * A sibling to `NavLink` rather than a mode inside it: `NavLink` resolves
 * `nav.*`, routes through next-intl's locale-aware `<Link>`, and treats
 * `coming-soon` as "this route will exist HERE". None of that applies to a
 * national portal or to the municipality's own site.
 *
 * `href: null` means the body exists and its website does not — rendered as a
 * non-link, never as a guessed URL. That is not a placeholder: it is the
 * honest state, and it is what the Sangguniang Bayan row is.
 *
 * Leaving the site is signalled twice — the arrow for sighted readers, text for
 * screen readers, because an icon alone is not an accessible indication. Same
 * tab, matching every citation link in this portal: a forced new window takes
 * the Back button away from the reader.
 */
export function ExternalNavLink({
  item,
  className,
}: {
  item: ExternalNavItem;
  className?: string;
}) {
  const t = useTranslations('resources');
  const tCommon = useTranslations('common');
  const label = t(item.messageKey);

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        className={cn('cursor-default text-ink-tertiary', className)}
      >
        {label}
        <span className="sr-only"> — {tCommon('noWebsite')}</span>
      </span>
    );
  }

  return (
    <a
      href={item.href}
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-ink-secondary hover:text-ink-link-hover',
        className
      )}
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">({tCommon('opensExternalSite')})</span>
    </a>
  );
}
