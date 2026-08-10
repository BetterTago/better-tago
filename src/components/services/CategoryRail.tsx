import {
  RAIL_ITEM,
  RAIL_ITEM_CURRENT,
  RAIL_ITEM_LINK,
} from '@/components/services/rail-item';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * The wayfinding rail — every category, with how many services each holds.
 *
 * 97 services is a set you navigate, not a page you scroll, and the count beside
 * each label is what makes the rail worth reading: a reader deciding between
 * *Health* and *Social welfare* learns that one holds twenty-three tasks and the
 * other seven before spending a click on either.
 *
 * 🔴 **The current category is a `<span>`, not a `<Link>`.** A link to the page
 * you are on is a control that announces itself as operable and then does
 * nothing. It also carries `aria-current="page"`, so the state is conveyed
 * without relying on the tint and the 4px rule — TAGO-209 criterion 5.
 *
 * The rail is never the only route to anything it lists. It is hidden below the
 * desktop breakpoint by the caller, and the same categories are reachable from
 * the index's cards and from the breadcrumb.
 */

export type RailItem = {
  slug: string;
  label: string;
  count: number;
};

export async function CategoryRail({
  heading,
  items,
  current,
  footer,
}: {
  heading: string;
  items: RailItem[];
  /** The category slug the reader is on, if any. */
  current?: string;
  footer?: React.ReactNode;
}) {
  return (
    <nav aria-label={heading} className="flex flex-col gap-2.5">
      <p className="border-b border-line-subtle pb-2 text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
        {heading}
      </p>

      <ul className="flex flex-col">
        {items.map(item => {
          return (
            <li key={item.slug}>
              {item.slug === current ? (
                <span
                  aria-current="page"
                  className={cn(RAIL_ITEM, RAIL_ITEM_CURRENT)}
                >
                  {item.label}
                  <span className="text-2xs tabular-nums text-ink-secondary">
                    {item.count}
                  </span>
                </span>
              ) : (
                <Link
                  className={cn(RAIL_ITEM, RAIL_ITEM_LINK)}
                  href={`/services/${item.slug}`}
                >
                  {item.label}
                  <span className="text-2xs tabular-nums text-ink-tertiary">
                    {item.count}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {footer && (
        <div className="mt-2.5 border-t border-line-subtle pt-3.5 text-sm font-semibold">
          {footer}
        </div>
      )}
    </nav>
  );
}
