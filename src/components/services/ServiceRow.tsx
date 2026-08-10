import { ArrowRight } from 'lucide-react';
import { Highlight } from '@/components/ui/Highlight';
import { StatusPill } from '@/components/services/StatusPill';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * One service, in a list — the row pattern shared by a category and a search
 * result.
 *
 * The two variants differ only in their frame: inside a category the rows sit in
 * one bordered card divided by hairlines, and a search result is a card of its
 * own because results are not a continuous set. The CONTENT is identical on
 * purpose — a reader who learns to read one has learned to read the other.
 *
 * `query` is what a search result highlights. Passing it here rather than
 * pre-marking the strings keeps the untrusted value as data all the way to the
 * element that renders it; see `highlight.ts`.
 */
export async function ServiceRow({
  href,
  name,
  description,
  meta,
  transcribed,
  query,
  variant = 'listed',
}: {
  href: string;
  name: string;
  description: string;
  /** The office in a category list; the category in a search result. */
  meta: string;
  /** Omit to render no pill — a search result shows the category instead. */
  transcribed?: boolean;
  query?: string;
  variant?: 'listed' | 'card';
}) {
  return (
    <Link
      className={cn(
        // Stacks on a phone and splits at `sm`, so the pill is never hidden to
        // save space — a reader on a small screen needs "not yet transcribed"
        // more than a reader with room for a wide row, not less.
        'flex flex-col gap-2 p-5 text-ink sm:flex-row sm:items-start sm:gap-5',
        variant === 'listed'
          ? 'hover:bg-surface-tint'
          : 'rounded-xl border border-line bg-surface-raised hover:border-ink-link hover:bg-surface-tint'
      )}
      href={href}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            'font-semibold',
            variant === 'listed' ? 'text-ink-link' : 'text-ink'
          )}
        >
          <Highlight query={query} text={name} />
        </span>
        <span className="text-sm leading-relaxed text-ink-secondary">
          {description}
        </span>
        <span
          className={cn(
            'text-ink-tertiary',
            variant === 'listed'
              ? 'text-sm'
              : 'text-2xs font-semibold tracking-label uppercase'
          )}
        >
          {meta}
        </span>
      </span>

      {transcribed === undefined ? (
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 self-start text-ink-tertiary sm:mt-1"
        />
      ) : (
        <StatusPill className="self-start" transcribed={transcribed} />
      )}
    </Link>
  );
}
