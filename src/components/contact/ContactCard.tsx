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
  /**
   * The level for the card's label. `3` under the home page's section `h2`, `2`
   * on `/contact`, where the section's title has moved up to the masthead's
   * `h1` and there is no `h2` between the two.
   */
  headingLevel?: 2 | 3;
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
 * The HEADING is the LABEL, not the value — "Phone" is what a reader browsing
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
  headingLevel = 3,
}: ContactCardProps) {
  const Label = `h${headingLevel}` as const;

  const body: ReactNode = (
    <>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface-control">
        <Icon aria-hidden="true" className="size-5 text-ink-accent" />
      </span>
      <div>
        {/*
         * 🔴 `-strong`, not `--ink-accent`. This is 11px bold — body-size
         * accent text — and the design system's own rule is that body-size
         * accent text uses the strong token: unscoped `--ink-accent` is the
         * display-only gold, 3.67:1 on a light ground and therefore correct
         * only at ≥24px.
         *
         * It WAS `--ink-accent`, and passed, for as long as this card only ever
         * rendered inside the home page's `data-surface="inverse"` slab — where
         * the scope re-points the token to `accent-400` on a dark ground. The
         * `/contact` route put the same card on the light page surface and axe
         * measured it at 3.96:1 against white. Both grounds are now measured in
         * theme-tokens.test.ts, so this cannot regress silently the next time
         * the card is reused somewhere new.
         */}
        <Label className="mb-1.5 text-2xs font-bold tracking-label text-ink-accent-strong uppercase">
          {label}
        </Label>
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

  /*
   * A new tab only for the card that actually leaves the site — the map pin.
   * `tel:` and `mailto:` hand off to a dialer or a mail client and never paint
   * a document, so `target="_blank"` on those leaves the reader staring at an
   * empty tab behind the app that just opened.
   */
  const outbound = external
    ? { rel: 'noopener noreferrer', target: '_blank' }
    : {};

  return (
    <a
      href={href}
      {...outbound}
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
