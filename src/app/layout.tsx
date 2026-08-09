import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { THEME_INIT_SCRIPT } from '@/lib/theme-init';
import './globals.css';

/**
 * The document shell.
 *
 * `<html>` lives HERE, not in `app/[locale]/layout.tsx`. With the shell inside
 * the `[locale]` segment, a client-side switch between locales makes React
 * render a second document into the live one — it cannot reconcile two `<html>`
 * elements, so it appends, and the page ends up with two headers. A root layout
 * is not re-rendered when only a child segment changes, so the shell mounts
 * exactly once per tab and the locale switch stays an ordinary navigation.
 *
 * The cost is that this layout cannot know the locale, so `lang` ships as the
 * default. Two things correct it: the pre-paint script below, which reads the
 * first path segment before anything renders, and `<HtmlLang>` in the locale
 * layout, which handles every later client-side switch. The
 * `alternates.languages` hreflang set in that layout's metadata is what covers
 * a crawler that does not run JavaScript.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang={routing.defaultLocale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {/*
         * Resolves the theme and corrects `lang` BEFORE first paint, so no
         * route renders in the wrong theme for a frame.
         *
         * This is the one and only permitted `dangerouslySetInnerHTML` in the
         * app, and it is safe for exactly one reason: `THEME_INIT_SCRIPT` is a
         * static literal with nothing interpolated into it. A unit test fails
         * on the first `${`. Do not make this script take a parameter.
         *
         * There is deliberately no `<meta name="color-scheme">` beside it: the
         * meta would let the UA paint a dark canvas for a reader whose stored
         * choice is light. `color-scheme` is set per theme in globals.css
         * instead, where the attribute this script writes governs it.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-surface-page font-sans text-ink">{children}</body>
    </html>
  );
}
