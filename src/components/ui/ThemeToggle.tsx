'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toggleTheme } from '@/lib/theme-init';

/**
 * The one client leaf involved in theming.
 *
 * ## It renders both states and lets CSS pick
 *
 * Both icons and both accessible names ship in the markup; `globals.css` hides
 * the wrong pair. Reading the theme in an effect instead would paint the wrong
 * icon on the first frame and then flip it — the hydration mismatch the
 * pre-paint init script exists to prevent, reintroduced by the component that
 * depends on it most.
 *
 * `display: none` on the hidden name also takes it out of the accessibility
 * tree, so the button has exactly one accessible name at any moment.
 *
 * ## The announcement is a sibling, not a child
 *
 * A live region inside the button would become part of its accessible name and
 * the button would start announcing its own last announcement. It sits outside,
 * empty on the server, and is populated only by a real click — so nothing is
 * announced on page load.
 *
 * The theme itself is written by `src/lib/theme-init.ts`, which is the only
 * module that knows the attribute or the storage key. This component never
 * touches `document`.
 */
export function ThemeToggle() {
  const t = useTranslations('header');
  const [announcement, setAnnouncement] = useState('');

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const next = toggleTheme();
          setAnnouncement(
            next === 'dark' ? t('themeNowDark') : t('themeNowLight')
          );
        }}
        data-control
        // A bare icon with no boundary does not read as a button. The border
        // and raised ground give it one in BOTH themes — `--line-control` is
        // measured at 3.42:1 on the raised surface in light and 3.30:1 in
        // dark, so the edge is visible either way rather than only on paper.
        //
        // 28px to match the locale switch beside it, by instruction. Below the
        // 44px floor, so it carries `data-control` and is a listed exemption
        // in e2e/home.a11y.spec.ts — the boundary is what makes it findable at
        // this size, which is why the border is not the thing that gave way.
        className="inline-flex size-7 items-center justify-center rounded-md border border-line-control bg-surface-raised text-ink motion-safe:transition-colors motion-safe:duration-150 hover:border-ink-link hover:text-ink-link"
      >
        {/* Each pair is named for the theme it belongs to, not for the icon:
            the moon offers dark and therefore belongs to the light theme. */}
        <Moon aria-hidden="true" className="theme-only-light size-4" />
        <Sun aria-hidden="true" className="theme-only-dark size-4" />
        <span className="theme-only-light sr-only">{t('themeToDark')}</span>
        <span className="theme-only-dark sr-only">{t('themeToLight')}</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
