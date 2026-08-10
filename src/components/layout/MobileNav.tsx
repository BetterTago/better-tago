'use client';

import { Menu, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * The burger and its dropdown panel.
 *
 * A NON-MODAL disclosure hanging under the sticky header: the page stays
 * visible beneath it, and it makes no promise that the page is inert.
 *
 * ## Why it is not a dialog
 *
 * A modal IS a promise — everything behind it is unreachable. A panel that
 * leaves the page visible must not claim one, so there is no `role="dialog"`,
 * no `aria-modal`, no body scroll lock and no focus trap. Trapping Tab inside a
 * non-modal disclosure produces the specific bug where a keyboard reader cannot
 * get back out to the page at all.
 *
 * What is kept, because none of it depends on being modal:
 *
 * · `aria-expanded` + `aria-controls` on the burger.
 * · Escape closes and returns focus to the burger.
 * · Opening moves focus into the panel.
 * · Focus LEAVING the panel closes it — the non-modal equivalent of a trap:
 *   Tab walks out to the rest of the page and the panel shuts behind you.
 * · It closes itself if the viewport grows past `lg`, where it is
 *   `display: none` — otherwise it is left open-but-invisible with the burger
 *   still claiming `aria-expanded="true"`.
 *
 * The links are server-rendered and passed as `children`, so no navigation data
 * crosses the client boundary.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const t = useTranslations('header');
  const tNav = useTranslations('nav');
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) burgerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('a[href], button')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      // The submenus inside call `stopPropagation` on their own Escape, so one
      // press collapses the innermost open thing and only a second reaches here.
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    }

    // Non-modal: focus is free to leave, and when it does the panel goes with
    // it. `relatedTarget` is null when focus leaves the document entirely,
    // which is not a reason to close.
    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget;
      if (!(next instanceof Node)) return;
      if (panel?.contains(next) || burgerRef.current?.contains(next)) return;
      close(false);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panel?.contains(target) || burgerRef.current?.contains(target))
        return;
      close(false);
    }

    // Open it on a phone, rotate past `lg`, and it vanishes while `open` is
    // still true. 64rem is Tailwind's `lg`.
    const desktop = window.matchMedia('(min-width: 64rem)');
    const onBreakpoint = () => {
      if (desktop.matches) close(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    panel?.addEventListener('focusout', onFocusOut);
    desktop.addEventListener('change', onBreakpoint);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      panel?.removeEventListener('focusout', onFocusOut);
      desktop.removeEventListener('change', onBreakpoint);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={burgerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-line-control bg-surface-raised text-ink hover:border-ink-link lg:hidden"
      >
        {open ? (
          <X aria-hidden="true" className="size-4" />
        ) : (
          <Menu aria-hidden="true" className="size-4" />
        )}
        {/* One control, so its accessible name follows its state. */}
        <span className="sr-only">{open ? t('closeMenu') : t('openMenu')}</span>
      </button>

      {/*
        Rendered in place, directly under the header — no portal. `absolute`
        against the header rather than `fixed`, so it hangs off the sticky bar
        and travels with it. `mobile-nav-panel` bounds it by the DYNAMIC
        viewport height, which is the case a retracting mobile URL bar breaks,
        and lets it scroll itself without locking the body behind it.
      */}
      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        className="mobile-nav-panel absolute inset-x-0 top-full border-b border-line bg-surface-page shadow-panel lg:hidden"
      >
        <nav aria-label={tNav('mobileLabel')} className="page-measure py-3">
          {children}
        </nav>
      </div>
    </>
  );
}
