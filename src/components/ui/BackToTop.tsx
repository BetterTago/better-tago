'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/** Far enough down that the header is well out of reach. */
const SHOW_AFTER_PX = 700;

/**
 * The floating return-to-top control.
 *
 * Returns `null` below the threshold rather than hiding itself, so there is
 * nothing to tab into and nothing for a screen reader to find while it is not
 * offered.
 *
 * 🔴 **The one non-obvious thing, and it is a real WCAG 2.3.3 failure if it is
 * missed:** `prefers-reduced-motion` governs the CSS `scroll-behavior` property,
 * NOT the `window.scrollTo` API. The global reduced-motion rule in globals.css
 * cannot reach a scroll issued from JavaScript, so a `behavior: 'smooth'` here
 * animates for a reader who explicitly asked not to be moved. The media query
 * has to be matched again, in JavaScript, at the call site — which is what the
 * handler below does.
 *
 * It is invisible in review and green in every automated check; it only shows
 * up for the readers it hurts.
 */
export function BackToTop() {
  const t = useTranslations('common');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Evaluated once on mount as well as on scroll: a reader who arrives at a
    // deep anchor, or whose browser restores a scrolled position, should see
    // the control immediately rather than after their first scroll event.
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  function scrollToTop() {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      // Logical inset, so it moves corner with the writing direction rather
      // than being pinned to the right. 48px clears the 44px touch floor with
      // no exemption needed.
      className="fixed end-4 bottom-4 z-50 grid size-12 place-items-center rounded-full border border-line-control bg-surface-raised text-ink shadow-panel hover:border-ink-link motion-safe:animate-rise sm:end-6 sm:bottom-6"
    >
      <ArrowUp aria-hidden="true" className="size-4.5" />
      <span className="sr-only">{t('backToTop')}</span>
    </button>
  );
}
