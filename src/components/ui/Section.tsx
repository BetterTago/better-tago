import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A numbered page section with its eyebrow and h2.
 *
 * `reveal-on-scroll` is a CSS scroll-driven animation that exists only behind
 * `prefers-reduced-motion: no-preference` AND `@supports (animation-timeline)`.
 * Content is VISIBLE by default and the animation is added on top — the
 * reference design ran it the other way, which meant a blocked or slow script
 * left everything below the fold invisible.
 *
 * `scroll-mt-24` because the header is sticky: without it every in-page link
 * lands with its own heading tucked underneath the bar that just scrolled over
 * it.
 */
export function Section({
  id,
  eyebrow,
  heading,
  aside,
  intro,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  heading: string;
  aside?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('reveal-on-scroll scroll-mt-24 pt-14 sm:pt-16', className)}
    >
      <div
        className={cn(
          'mb-6 flex flex-col gap-4',
          aside && 'sm:flex-row sm:items-end sm:justify-between'
        )}
      >
        <div>
          <p className="mb-2 text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
            {eyebrow}
          </p>
          <h2
            id={headingId}
            className="font-display text-section font-bold text-balance"
          >
            {heading}
          </h2>
        </div>
        {aside}
      </div>
      {intro}
      {children}
    </section>
  );
}
