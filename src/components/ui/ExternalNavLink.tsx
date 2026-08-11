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
 * screen readers, because an icon alone is not an accessible indication.
 *
 * ⚠️ **A new tab, by instruction — this used to be the same tab, deliberately.**
 * The argument recorded here was that a forced new window takes the Back button
 * away from the reader, and that argument has not stopped being true; it was
 * overruled, and every outbound link in the portal now behaves this way rather
 * than this one differing from the rest. What makes it survivable is that the
 * announcement says so: `common.opensExternalSite` names the new tab, so a
 * screen-reader user is told before they follow it rather than discovering it
 * when Back does nothing.
 *
 * `rel="noopener noreferrer"` is not optional alongside it — a new tab with an
 * opener is a real, if small, hole.
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
      rel="noopener noreferrer"
      target="_blank"
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
