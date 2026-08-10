import { lguConfig } from '@/lib/lgu-config';
import { cn } from '@/lib/utils';

/**
 * The portal name, set as a two-line lockup beside the mark.
 *
 *     Better
 *     TAGO
 *
 * One component rather than the same two spans copied into the header and the
 * footer: the two marks diverging is a bug that only shows when somebody
 * scrolls the whole page, which is to say almost never during development.
 *
 * ## The pieces
 *
 * `lead` is de-emphasised by SIZE alone — same family, same weight — because
 * that is what makes two lines read as one object rather than as a label above
 * a title.
 *
 * `main` is uppercased in CSS, not in the configuration, so the accessible text
 * stays "Tago". The link that wraps this carries its own `aria-label`, and the
 * visible text still concatenates to "BetterTago" — which is what keeps
 * WCAG 2.5.3 (Label in Name) satisfied.
 *
 * ## Colour
 *
 * `--ink` and `--ink-secondary`, so the lockup follows every surface scope
 * automatically and reads correctly on the near-black footer without a second
 * rule. It deliberately does NOT use `--ink-link`, which resolves to GOLD on an
 * inverse surface — a wordmark that changes hue by context is two wordmarks.
 */
export function Wordmark({ className }: { className?: string }) {
  const { lead, main } = lguConfig.portal.wordmark;

  return (
    <span className={cn('flex flex-col font-wordmark', className)}>
      {/*
        14px over 20px — exactly 70%, one pair at every width, and the same pair
        in the header and the footer.

        `leading-none` sits on EACH LINE, not on the stack: Tailwind v4
        registers `--tw-leading` as non-inheriting and every `text-*` utility
        re-reads it, so a `leading-none` on the parent is silently overridden by
        the child's own size utility and the two words drift apart.
      */}
      <span className="text-sm leading-none font-bold tracking-tight text-ink-secondary">
        {lead}
      </span>
      <span className="text-xl leading-none font-black tracking-tight text-ink uppercase">
        {main}
      </span>
    </span>
  );
}
