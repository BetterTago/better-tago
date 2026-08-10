import { Phone } from 'lucide-react';
import { telHref } from '@/lib/tel';

/**
 * The national line, promoted to a full-width call band.
 *
 * A single, unmissable, one-handed target — this is the one thing on the page
 * somebody might need in a storm, and it is real, sourced and dialable.
 *
 * ## On the gold ground, by instruction
 *
 * It sat on `--surface-inverse-deep` until 2026-08-10: a deep green band on the
 * emergency section's deep green ground, which is a quiet card at the foot of a
 * section rather than the one number that works from any phone. The mark's gold
 * is the loudest ground the palette has, and this is what it is for.
 *
 * `data-surface="accent"` rather than a set of one-off text classes — the scope
 * re-points `--ink`, `--ink-accent` and `--focus-ring` to `--ink-on-accent`,
 * the emergency section's own deep green, so BOTH the label and the number come
 * out in it and neither can drift. Every pair is measured in
 * theme-tokens.test.ts (12.02:1), and gold is one of the few grounds that is
 * the same colour in light and dark, so one set of classes is right in both.
 *
 * The accessible name carries the ORGANISATION as well as the number, because
 * "911" read alone tells a screen-reader user nothing about what they are about
 * to dial.
 */
export function EmergencyCallBand({
  label,
  number,
  callLabel,
}: {
  label: string;
  number: string;
  callLabel: string;
}) {
  return (
    <a
      href={telHref(number)}
      aria-label={callLabel}
      data-surface="accent"
      className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-400 px-5 py-4 text-ink hover:bg-accent-300"
    >
      <span className="flex items-center gap-3 font-semibold text-ink">
        <Phone aria-hidden="true" className="size-5 shrink-0" />
        {label}
      </span>
      {/* `tabular-nums` and explicit normal tracking: at this size the display
          face's inherited negative tracking collides the digits. */}
      <span className="font-display text-stat font-bold text-ink-accent tabular-nums">
        {number}
      </span>
    </a>
  );
}
