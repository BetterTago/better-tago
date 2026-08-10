import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContactCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
  /** `null` when there is nowhere to go — the card is then not a link. */
  href: string | null;
  external?: boolean;
  externalLabel?: string;
};

const SHELL =
  'flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5';

/**
 * One contact route: an icon tile, an uppercase label, the value, a muted note.
 *
 * Ported from BetterTandag's `ContactCard` (2026-08-10, by instruction) — same
 * shape, same mechanics, this portal's own tokens.
 *
 * The whole card is the target when there is somewhere to go — a 44px `tel:`
 * link inside a 160px card means a thumb that lands anywhere else does
 * nothing. When `href` is `null` there is nowhere to go, so the card renders
 * as a plain `<div aria-disabled>`: a `tel:` to a number that does not exist
 * is worse than no link at all, because it looks like it works right up until
 * someone is on the phone to nobody.
 *
 * The `<h3>` is the LABEL, not the value — "Phone" is what a reader browsing
 * by heading is looking for, and the number is the answer to it. It sits
 * inside the anchor in the linked branch, which is valid: `<a>` takes flow
 * content, and only nested INTERACTIVE content is disallowed.
 */
export function ContactCard({
  icon: Icon,
  label,
  value,
  note,
  href,
  external = false,
  externalLabel,
}: ContactCardProps) {
  const body: ReactNode = (
    <>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface-control">
        <Icon aria-hidden="true" className="size-5 text-ink-accent" />
      </span>
      <div>
        <h3 className="mb-1.5 text-2xs font-bold tracking-label text-ink-accent uppercase">
          {label}
        </h3>
        {/* `wrap-anywhere`, not `wrap-break-word`. An email address is one
            unbreakable token, and `overflow-wrap: break-word` does not reduce
            an element's min-content width — it only breaks the rendered line
            once a width is already fixed. In a grid track sized from its
            contents that is the difference between a card that fits at 320px
            and one whose overflow gets silently clipped by the section's
            `overflow-hidden`. */}
        <p className="text-sm font-bold text-ink wrap-anywhere">{value}</p>
        {note && (
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {note}
          </p>
        )}
      </div>
    </>
  );

  if (href === null) {
    return (
      <div aria-disabled="true" className={SHELL}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={href}
      {...(external ? { rel: 'noreferrer' } : {})}
      className={cn(
        SHELL,
        'motion-safe:transition-colors motion-safe:duration-200 hover:border-ink-link hover:bg-surface-sunken'
      )}
    >
      {body}
      {external && externalLabel && (
        <span className="sr-only">({externalLabel})</span>
      )}
    </a>
  );
}
