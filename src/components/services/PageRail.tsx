'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  RAIL_ITEM,
  RAIL_ITEM_CURRENT,
  RAIL_ITEM_LINK,
} from '@/components/services/rail-item';
import type { Heading } from '@/lib/markdown-outline';
import { cn } from '@/lib/utils';

/**
 * "On this page" — the article's own `##` headings, as in-page anchors, with the
 * section you are looking at marked.
 *
 * Derived from the body rather than declared, because a charter body carries the
 * sections the document actually had. See `markdown-outline.ts` for why that
 * matters more here than on a hand-authored page.
 *
 * ## Why this one leaf is a Client Component
 *
 * "Which section am I looking at" is a fact about the viewport, and the server
 * has no viewport. Everything else about the rail — which headings exist, their
 * ids, their order, their text — is computed on the server and arrives as props;
 * the only thing that happens in the browser is reading scroll position.
 *
 * ## Why a scroll listener and not `IntersectionObserver`
 *
 * A charter page's sections are wildly uneven — *What the charter says* runs to
 * three tables and *If something goes wrong* to two paragraphs. An observer
 * answers "is this visible", and with sections that size several are visible at
 * once and the tall one is visible almost always; picking a winner from that
 * needs ratio bookkeeping that still guesses wrong at the ends of the document.
 *
 * Reading `getBoundingClientRect().top` answers the question actually being
 * asked — *which heading did I most recently pass* — in one pass, with the same
 * answer whether the reader clicked a rail link or scrolled there themselves,
 * and with no special case at the bottom of the page. It is throttled to one
 * measurement per animation frame and the listener is passive, so it never
 * blocks a scroll.
 *
 * ## Degrading
 *
 * 🔴 With JavaScript off there is no active item and every link still works —
 * the marking is an orientation aid, not a route. The rail is also `hidden`
 * below the desktop breakpoint by its caller, and nothing is lost there either:
 * every heading it lists is in the article beside it, in the same order.
 */
export function PageRail({
  heading,
  headings,
  footer,
}: {
  heading: string;
  headings: Heading[];
  footer?: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    /*
     * Matches `scroll-mt-24` on the rendered `h2` (6rem). A heading that has
     * just been scrolled to sits exactly at this line, so it counts as passed
     * and the item the reader clicked lights up rather than the one above it.
     */
    const LINE = 96;
    let frame = 0;

    const measure = () => {
      frame = 0;

      let current = headings[0].id;
      for (const item of headings) {
        const element = document.getElementById(item.id);
        if (!element) continue;
        // The LAST heading whose top has crossed the line — which is the
        // section the reader is inside, at the top of the document and at the
        // bottom alike.
        if (element.getBoundingClientRect().top <= LINE + 1) current = item.id;
      }
      setActive(current);
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [headings]);

  if (headings.length === 0) return footer ? <div>{footer}</div> : null;

  return (
    <nav aria-label={heading} className="flex flex-col gap-2.5">
      <p className="border-b border-line-subtle pb-2 text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
        {heading}
      </p>

      <ul className="flex flex-col">
        {headings.map(item => (
          <li key={item.id}>
            <a
              /*
               * `location`, not `page`. These are sections WITHIN the current
               * page, which is exactly the distinction the value exists for —
               * `aria-current="page"` here would tell a screen-reader user they
               * were on a different page.
               *
               * It is also what carries the state to a reader who cannot see
               * the tint and the 4px rule, which is the only reason marking a
               * section is worth doing at all.
               */
              aria-current={item.id === active ? 'location' : undefined}
              className={cn(
                RAIL_ITEM,
                item.id === active ? RAIL_ITEM_CURRENT : RAIL_ITEM_LINK
              )}
              href={`#${item.id}`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>

      {footer && (
        <div className="mt-2.5 border-t border-line-subtle pt-3.5 text-sm font-semibold">
          {footer}
        </div>
      )}
    </nav>
  );
}
